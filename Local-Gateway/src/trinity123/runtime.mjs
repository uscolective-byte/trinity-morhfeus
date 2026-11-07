import path from 'node:path';
import {mkdir, readFile, writeFile, rename, appendFile, unlink, readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {profile, sessionPayload, safeId, redact} from './config.mjs';
import {CurlTransport} from './curl.mjs';
import {LocalBridge} from './bridge.mjs';

const terminalTypes = new Map([['agent.session.turn.completed', 'completed'],
  ['agent.session.turn.failed', 'failed'], ['agent.session.turn.cancelled', 'cancelled']]);

export function actionStatus(receipts) {
  if (receipts.some(r => r.status === 'failed' || r.success === false && r.status !== 'pending')) return 'failed';
  if (receipts.some(r => r.status === 'pending')) return 'pending';
  return receipts.length ? 'completed' : 'not_verified';
}

export class Trinity123 {
  constructor({env = process.env, dataDir = env.TRINITY123_DATA || path.resolve('data/trinity123'), transport, bridge} = {}) {
    this.env = env; this.dir = path.resolve(dataDir);
    this.transport = transport || new CurlTransport({env});
    this.bridge = bridge || new LocalBridge({env});
    this.active = new Map();
  }
  configuration() {
    return {name: profile.name, project_id: profile.project_id, agent_id: profile.agent_id,
      model: profile.agent.model, environment: profile.environment.type,
      installed: true, api_key_configured: Boolean(this.env.OPENAI_API_KEY?.trim()),
      pc_bridge_token_configured: Boolean(this.env.TRINITY_LOCAL_TOKEN),
      live_connection: 'not_verified', executor: 'OpenAI-managed; no local exec-server required',
      state_directory: this.dir};
  }
  async save(file, data) {
    await mkdir(path.dirname(file), {recursive: true});
    const temp = `${file}.${randomUUID()}.tmp`;
    await writeFile(temp, redact(data, this.env) + '\n', {mode: 0o600});
    await rename(temp, file);
  }
  async load(file) { try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
  runFile(id) { return path.join(this.dir, 'runs', safeId(id) + '.json'); }
  async getRun(id) { return this.load(this.runFile(id)); }
  async emit(record, event, observer) {
    const safe = JSON.parse(redact(event, this.env));
    await mkdir(path.join(this.dir, 'events'), {recursive: true});
    await appendFile(path.join(this.dir, 'events', record.run_id + '.jsonl'), JSON.stringify(safe) + '\n', {mode: 0o600});
    // Observers may disconnect. They never own the responder's lifetime.
    try { await observer?.(safe); } catch {}
  }
  async toolResult(sessionId, action, {rootTurnId = action.turn_id} = {}) {
    const session = safeId(sessionId), turn = safeId(action.turn_id), call = safeId(action.call_id);
    const file = path.join(this.dir, 'calls', `${session}--${turn}--${call}.json`);
    await mkdir(path.dirname(file), {recursive: true});
    let saved = await this.load(file);
    if (!saved) {
      try {
        await writeFile(file, JSON.stringify({state: 'started', session_id: session, turn_id: turn, call_id: call}) + '\n', {flag: 'wx', mode: 0o600});
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        saved = await this.load(file);
      }
      if (!saved) {
        const receipt = JSON.parse(redact(await this.bridge.execute(action), this.env));
        saved = {state: 'result_saved', session_id: session, turn_id: turn, root_turn_id: rootTurnId, call_id: call, tool: action.name, receipt};
        await this.save(file, saved);
      }
    }
    const receipt = saved?.state === 'result_saved' ? saved.receipt : {
      success: false, status: 'failed', execution_id: null, output: null,
      error: 'Predchádzajúce vykonanie nemá uložený výsledok; výsledok je neistý. Automatické opakovanie je zablokované. Najprv over skutočný stav v PC Bridge.'};
    const result = {type: 'agent.session.input.tool_result', turn_id: turn, call_id: call,
      success: receipt.success === true && receipt.status === 'completed'};
    if (result.success) result.output = JSON.stringify(receipt);
    else result.error = JSON.stringify(receipt);
    // Save before submitting: retries return the same result without re-execution.
    await this.transport.json('POST', `/agents/sessions/${session}/events`, {events: [result]});
    return {turn_id: turn, call_id: call, tool: action.name, ...receipt};
  }
  async restoreReceipts(record) {
    if (!record.session_id || !record.turn_id) return;
    let names;
    try { names = await readdir(path.join(this.dir, 'calls')); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const name of names) {
      if (!name.startsWith(safeId(record.session_id) + '--') || !name.endsWith('.json')) continue;
      const saved = await this.load(path.join(this.dir, 'calls', name));
      if (saved?.state !== 'result_saved' || (saved.root_turn_id || saved.turn_id) !== record.turn_id) continue;
      if (record.receipts.some(r => r.call_id === saved.call_id && r.turn_id === saved.turn_id)) continue;
      record.receipts.push({turn_id: saved.turn_id, call_id: saved.call_id, tool: saved.tool, ...saved.receipt});
    }
  }
  async list(resource) {
    const items = []; let after;
    do {
      const page = await this.transport.json('GET', resource + (resource.includes('?') ? '&' : '?') +
        'limit=100' + (after ? '&after=' + encodeURIComponent(after) : ''));
      if (!Array.isArray(page.data)) throw new Error('API vrátilo neplatný zoznam.');
      items.push(...page.data);
      const next = page.has_more ? page.last_id || page.data.at(-1)?.id : null;
      if (page.has_more && (!next || next === after)) throw new Error('API stránkovanie neposkytlo nový kurzor.');
      after = next;
      if (items.length > 100_000) throw new Error('História prekročila limit; zúž rozsah.');
    } while (after);
    return items;
  }
  async restoreText(record) {
    if (!record.session_id || !record.turn_id) return;
    const items = await this.list(`/agents/sessions/${safeId(record.session_id)}/turns/${safeId(record.turn_id)}/items?order=asc`);
    const text = items.filter(item => item.type === 'message' && item.role === 'assistant')
      .flatMap(item => item.content || []).filter(part => part.type === 'output_text' && typeof part.text === 'string')
      .map(part => part.text).join('\n');
    if (text) record.output_text = text;
  }
  async run({message, sessionId, mode = sessionId ? 'message' : 'start', onEvent} = {}) {
    // Validate credentials before creating a run or a remote resource.
    if (!this.env.OPENAI_API_KEY?.trim()) throw Object.assign(new Error('Chýba OPENAI_API_KEY; relácia OpenAI nebola vytvorená.'), {status: 503});
    if (!['start', 'message', 'observe'].includes(mode)) throw new Error('Neplatný režim.');
    if (sessionId) safeId(sessionId);
    if (mode !== 'start' && !sessionId) throw new Error('Chýba session ID.');
    const payload = mode === 'observe' ? null : sessionPayload(message);
    const lockName = sessionId || 'new-session';
    if (this.active.has(lockName)) throw Object.assign(new Error('Táto relácia má aktívny lokálny responder.'), {status: 409});
    this.active.set(lockName, true);
    const record = {run_id: randomUUID(), agent: profile.name, session_id: sessionId || null,
      turn_id: null, status: 'in_progress', turn_status: 'unknown', actions_status: 'not_verified',
      receipts: [], output_text: '', output_verified: false, created_at: new Date().toISOString(),
      submission_key: mode === 'message' ? randomUUID() : null};
    record.input = payload?.input || null;
    record.submission_state = mode === 'message' ? 'prepared' : null;
    let sessionLock, operation;
    try {
      if (sessionId) {
        sessionLock = path.join(this.dir, 'locks', safeId(sessionId) + '.lock');
        await mkdir(path.dirname(sessionLock), {recursive: true});
        try { await writeFile(sessionLock, record.run_id, {flag: 'wx', mode: 0o600}); }
        catch (e) { if (e.code === 'EEXIST') throw new Error('Relácia je zamknutá iným procesom alebo prerušeným behom. Najprv over jej stav; zámok nemaž naslepo.'); throw e; }
      }
      await this.save(this.runFile(record.run_id), record);
      await this.emit(record, {type: 'trinity123.run.started', ...record}, onEvent);
      const knownTurns = new Set();
      if (mode === 'message') {
        const before = await this.transport.json('GET', `/agents/sessions/${sessionId}`);
        if (before.status !== 'idle') throw new Error('Relácia nie je idle. Použi observe na dokončenie alebo cancel; správa nebola odoslaná.');
        for (const turn of await this.list(`/agents/sessions/${sessionId}/turns`)) knownTurns.add(turn.id);
      }
      const parts = new Map(), seenCalls = new Set(), buffered = [];
      let reconciling = mode === 'observe';
      const handle = async event => {
        if (event.session_id) record.session_id = safeId(event.session_id);
        if (event.session?.id) record.session_id = safeId(event.session.id);
        const turn = event.turn;
        const rootTurn = turn?.subagent_id === null && !knownTurns.has(turn.id);
        if (rootTurn && !record.turn_id) record.turn_id = safeId(turn.id);
        if (event.type === 'agent.session.turn.output_text.delta' || event.type === 'agent.session.turn.output_text.done') {
          // Each part is independent; done replaces deltas, it is never appended twice.
          const key = `${event.item_id}:${event.output_index}:${event.content_index}`;
          if (event.type.endsWith('.done')) parts.set(key, event.text || '');
          else parts.set(key, (parts.get(key) || '') + (event.delta || ''));
          record.output_text = [...parts.values()].join('\n');
        }
        await this.emit(record, {...event, _trinity: {source: 'openai_event', model_text_verified: false}}, onEvent);
        await this.save(this.runFile(record.run_id), record);
        if (['error', 'agent.session.failed', 'agent.session.environment.failed'].includes(event.type)) {
          record.turn_status = 'failed';
          record.error_code = event.error?.code || event.session?.last_error?.code || null;
          record.error_type = event.error?.type || event.session?.last_error?.type || null;
          throw new Error(event.error?.message || event.session?.last_error?.message || event.type);
        }
        if (event.type === 'agent.session.requires_action') {
          if (!record.session_id) throw new Error('API neposkytlo session ID pre požadovanú akciu.');
          const session = await this.transport.json('GET', `/agents/sessions/${record.session_id}`);
          for (const action of session.required_actions || []) {
            if (action.type !== 'function_call') throw new Error(`Nevyriešená required_action ${action.type}. OpenAI-hosted prostredie spravuje OpenAI; žiadny vlastný executor sa nepredstiera.`);
            const key = `${action.turn_id}:${action.call_id}`;
            if (seenCalls.has(key)) continue;
            const receipt = await this.toolResult(record.session_id, action, {rootTurnId: record.turn_id || action.turn_id});
            seenCalls.add(key); record.receipts.push(receipt);
            await this.save(this.runFile(record.run_id), record);
            await this.emit(record, {type: 'trinity123.tool.receipt', receipt}, onEvent);
          }
        }
        if (rootTurn && turn.id === record.turn_id && terminalTypes.has(event.type)) {
          record.turn_status = terminalTypes.get(event.type);
          if (turn.error) record.error = turn.error.message || JSON.stringify(turn.error);
          return true;
        }
        return false;
      };
      if (mode === 'start') {
        operation = this.transport.request('POST', '/agents/sessions', {body: payload, stream: true, onEvent: handle});
      } else {
        operation = this.transport.request('GET', `/agents/sessions/${sessionId}/events`, {stream: true, onEvent: async event => {
          if (!reconciling) return handle(event);
          if (buffered.length >= 2000) throw new Error('Rekonciliačný buffer prekročil limit.');
          buffered.push(event); return false;
        }});
        await operation.ready; // HTTP subscription is established BEFORE submitting input.
        if (mode === 'message') {
          await this.transport.json('POST', `/agents/sessions/${sessionId}/events`, {
            events: [{type: 'agent.session.input.message', input: [{role: 'user', content: [{type: 'input_text', text: message}]}]}]
          }, {idempotencyKey: record.submission_key});
          record.submission_state = 'accepted';
          await this.save(this.runFile(record.run_id), record);
        } else {
          // Reconnect first, then reconcile persisted turns/items. Never resend input.
          const snapshot = await this.transport.json('GET', `/agents/sessions/${sessionId}`);
          if (snapshot.status === 'failed') throw new Error('Uložená relácia je failed.');
          const turns = (await this.list(`/agents/sessions/${sessionId}/turns?order=desc`)).filter(t => t.subagent_id === null);
          if (turns[0]) {
            record.turn_id = turns[0].id;
            for (const turn of turns.slice(1)) knownTurns.add(turn.id);
            if (['completed', 'failed', 'cancelled'].includes(turns[0].status)) {
              record.turn_status = turns[0].status; operation.stop();
            }
          }
          reconciling = false;
          if (record.turn_status === 'unknown') {
            for (const event of buffered) { if (await handle(event)) { operation.stop(); break; } }
            if (snapshot.required_actions?.length && record.turn_status === 'unknown') await handle({type: 'agent.session.requires_action', session_id: sessionId});
          }
        }
      }
      await operation.result;
      if (record.turn_status === 'unknown') throw new Error('Stream sa skončil bez výsledku zamýšľaného ťahu. Výsledok je zatiaľ neoverený.');
      if (record.turn_status === 'completed') await this.restoreText(record);
      await this.restoreReceipts(record);
      record.actions_status = actionStatus(record.receipts);
      record.status = record.turn_status !== 'completed' ? 'failed'
        : record.actions_status === 'failed' ? 'failed' : record.actions_status === 'pending' ? 'pending' : 'completed';
      record.verification_scope = 'turn_status opisuje iba ťah OpenAI; receipts dokazujú iba uvedené lokálne akcie. Text modelu nie je nezávisle overený.';
      if (record.turn_status === 'completed' && !record.output_text) {
        record.status = 'unverified'; record.error = 'Ťah skončil, ale chýba text aj uložený textový výsledok.';
      }
    } catch (error) {
      operation?.stop();
      const rejected = Number(error.status) >= 400;
      record.status = record.turn_status === 'failed' || record.turn_status === 'cancelled' || rejected ? 'failed' : 'unverified';
      record.error = redact(error.message, this.env);
      await this.restoreReceipts(record);
      record.actions_status = actionStatus(record.receipts);
      record.recovery = record.session_id ? `Pozri uložený stav alebo observe ${record.session_id}; pôvodný vstup automaticky neopakuj.`
        : rejected ? 'API odmietlo požiadavku. Oprav uvedenú konfiguráciu alebo oprávnenie.'
        : 'Session ID nebolo prijaté. Pred novým pokusom skontroluj relácie v projekte; vytvorenie mohlo prebehnúť.';
    } finally {
      this.active.delete(lockName);
      if (sessionLock) {
        // Only remove the lock if this run actually owns it.
        try { if (await readFile(sessionLock, 'utf8') === record.run_id) await unlink(sessionLock); } catch {}
      }
    }
    record.finished_at = new Date().toISOString();
    await this.save(this.runFile(record.run_id), record);
    await this.emit(record, {type: 'trinity123.run.result', ...record}, onEvent);
    return JSON.parse(redact(record, this.env));
  }
  async inspect(sessionId) {
    const id = safeId(sessionId);
    return {session: await this.transport.json('GET', `/agents/sessions/${id}`),
      turns: await this.list(`/agents/sessions/${id}/turns?order=desc`)};
  }
  async cancel(sessionId) {
    return this.transport.json('POST', `/agents/sessions/${safeId(sessionId)}/events`, {events: [{type: 'agent.session.input.cancel'}]});
  }
  async remove(sessionId) {
    return this.transport.json('DELETE', `/agents/sessions/${safeId(sessionId)}`);
  }
}
