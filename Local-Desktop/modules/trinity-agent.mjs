import path from 'node:path';
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Trinity123} from '../../Local-Gateway/src/trinity123/runtime.mjs';

export class DesktopTrinityAgent {
  constructor({dataDir, clientFactory} = {}) {
    this.dir = path.resolve(dataDir);
    this.factory = clientFactory || (async () => {
      await import('../../Local-Gateway/src/trinity123/environment.mjs');
      return new Trinity123({dataDir: process.env.TRINITY123_DATA || fileURLToPath(new URL('../../Local-Gateway/data/trinity123',import.meta.url))});
    });
  }
  async client() { return this.instance ||= await this.factory(); }
  async bindings() {
    try { return JSON.parse(await readFile(path.join(this.dir, 'sessions.json'), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
  }
  async bind(id, remote) {
    const bindings = await this.bindings(); bindings[id] = remote;
    await mkdir(this.dir, {recursive: true});
    const temp = path.join(this.dir, 'sessions.' + randomUUID() + '.tmp');
    await writeFile(temp, JSON.stringify(bindings), {mode: 0o600});
    await rename(temp, path.join(this.dir, 'sessions.json'));
  }
  async configuration() {
    const config = (await this.client()).configuration();
    return {...config, last_outcome: this.last?.status || 'not_checked', last_error: this.last?.error || null};
  }
  async chat({session_id, message, onEvent}) {
    const bindings = await this.bindings();
    const result = await (await this.client()).run({sessionId: bindings[session_id], message,
      onEvent: async event => {
        const remote = event.session_id || event.session?.id;
        if (remote && bindings[session_id] !== remote) {
          bindings[session_id] = remote; await this.bind(session_id, remote);
        }
        await onEvent?.(event);
      }});
    this.last = {status: result.status, error: result.error || null};
    if (!['completed', 'pending'].includes(result.status)) {
      const detail = result.error || result.receipts.find(r => !r.success)?.error || 'Relácia alebo nástroj nemajú potvrdený úspech.';
      throw Object.assign(new Error('Trinity / OpenAI: ' + detail), {status: 503});
    }
    return {content: result.output_text, model: (await this.client()).configuration().model,
      remote_session_id: result.session_id, run_id: result.run_id, operation_status: result.status,
      receipts: result.receipts.map(r => ({...r, path: r.output?.path || null, id: r.execution_id || null})),
      output_verified: false};
  }
}
