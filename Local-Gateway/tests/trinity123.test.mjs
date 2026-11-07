import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp, readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {sessionPayload, profile, redact} from '../src/trinity123/config.mjs';
import {SSEParser, CurlTransport} from '../src/trinity123/curl.mjs';
import {LocalBridge} from '../src/trinity123/bridge.mjs';
import {Trinity123, actionStatus} from '../src/trinity123/runtime.mjs';
import {createTrinity123Routes} from '../src/trinity123/gateway-route.mjs';
import {TrinityAccess} from '../src/trinity123/access.mjs';

const env = {...process.env, OPENAI_API_KEY: 'fixture-openai-secret', TRINITY_LOCAL_TOKEN: 'fixture-bridge-secret'};
const action = {type: 'function_call', name: 'local_tool_execute', turn_id: 'turn_test', call_id: 'call_test',
  arguments: {action_type: 'read_file', action_params: {file_path: 'Trinity/readme.txt'}}};
const temp = () => mkdtemp(path.join(os.tmpdir(), 'trinity123-tests-'));
const body = async request => { let value = ''; for await (const chunk of request) value += chunk; return JSON.parse(value || '{}'); };
const json = (response, value, status = 200) => { response.writeHead(status, {'Content-Type': 'application/json'}); response.end(JSON.stringify(value)); };
const sse = (response, value) => response.write('data: ' + JSON.stringify(value) + '\n\n');
const root = (id, status = 'in_progress') => ({id, subagent_id: null, status});
async function fixture(t, {failedTool = false, disconnect = false, terminal = 'completed', missingText = false, follow = false, observe = false, lifecycleFailed = false, httpError = false} = {}) {
  const captured = {requests: [], executions: 0, submits: 0}; let stream;
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      captured.requests.push(request.method + ' ' + url.pathname);
      if (url.pathname.startsWith('/v1/')) {
        assert.equal(request.headers.authorization, 'Bearer ' + env.OPENAI_API_KEY);
        assert.equal(request.headers['openai-project'], profile.project_id);
        assert.equal(request.headers['openai-beta'], 'agents=v1');
      } else assert.equal(request.headers.authorization, 'Bearer ' + env.TRINITY_LOCAL_TOKEN);
      const finish = () => {
        if (!missingText) {
          sse(stream, {type: 'agent.session.turn.output_text.delta', session_id: 'sess_test', item_id: 'msg_test', output_index: 0, content_index: 0, delta: 'Over'});
          sse(stream, {type: 'agent.session.turn.output_text.done', session_id: 'sess_test', item_id: 'msg_test', output_index: 0, content_index: 0, text: 'Overené podľa dokladu.'});
        }
        sse(stream, {type: 'agent.session.turn.' + terminal, session_id: 'sess_test', turn: root('turn_test', terminal)});
      };
      if (request.method === 'POST' && url.pathname === '/v1/agents/sessions') {
        if (httpError) return json(response, {error: {message: 'Fixture access denied'}}, 403);
        captured.payload = await body(request); stream = response;
        response.writeHead(200, {'Content-Type': 'text/event-stream'});
        sse(response, {type: 'agent.session.created', session: {id: 'sess_test'}});
        sse(response, {type: 'agent.session.turn.completed', session_id: 'sess_test', turn: {id: 'turn_child', subagent_id: 'child'}});
        sse(response, {type: 'agent.session.turn.started', session_id: 'sess_test', turn: root('turn_test')});
        if (lifecycleFailed) return sse(response, {type: 'agent.session.environment.failed', session_id: 'sess_test', error: {message: 'Fixture provisioning failed'}});
        if (disconnect) return response.end();
        if (terminal !== 'completed' || missingText) return finish();
        return sse(response, {type: 'agent.session.requires_action', session_id: 'sess_test'});
      }
      if (request.method === 'GET' && url.pathname === '/v1/agents/sessions/sess_test/events') {
        stream = response; response.writeHead(200, {'Content-Type': 'text/event-stream'}); response.write(': subscribed\n\n');
        sse(response, {type: 'agent.session.turn.completed', session_id: 'sess_test', turn: root('turn_previous', 'completed')});
        return;
      }
      if (request.method === 'GET' && url.pathname === '/v1/agents/sessions/sess_test') return json(response, {id: 'sess_test', status: follow ? 'idle' : 'requires_action', required_actions: follow ? [] : [action]});
      if (request.method === 'GET' && url.pathname === '/v1/agents/sessions/sess_test/turns') return json(response, {data: observe ? [root('turn_test', 'completed'), root('turn_previous', 'completed')] : follow ? [root('turn_previous', 'completed')] : [], has_more: false});
      if (request.method === 'GET' && url.pathname === '/v1/agents/sessions/sess_test/turns/turn_test/items') return json(response, {data: missingText ? [] : [{id: 'msg_test', type: 'message', role: 'assistant', content: [{type: 'output_text', text: 'Overené podľa dokladu.'}]}], has_more: false});
      if (request.method === 'POST' && url.pathname === '/v1/agents/sessions/sess_test/events') {
        const input = await body(request); captured.submits++;
        if (input.events[0].type === 'agent.session.input.message') {
          assert.ok(request.headers['idempotency-key']); captured.message = input;
          json(response, {}); sse(stream, {type: 'agent.session.turn.started', session_id: 'sess_test', turn: root('turn_test')}); finish(); return;
        }
        captured.toolResult = input.events[0]; json(response, {}); finish(); return;
      }
      if (request.method === 'POST' && url.pathname === '/api/proposals') {
        captured.proposal = await body(request); return json(response, {proposal: {id: 'fixture_proposal', status: 'approved'}});
      }
      if (request.method === 'POST' && url.pathname === '/api/proposals/fixture_proposal/execute') {
        captured.executions++;
        if (failedTool) return json(response, {status: 'failed', receipt: {success: false, exitCode: 1}});
        const content = 'skutočný výstup lokálneho HTTP fixture\n';
        return json(response, {status: 'completed', receipt: {content, sha256: createHash('sha256').update(content).digest('hex'), bytes: Buffer.byteLength(content)}});
      }
      json(response, {error: 'Unexpected fixture request'}, 404);
    } catch (error) { captured.error = error; if (!response.headersSent) json(response, {error: error.message}, 500); else response.destroy(error); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const configuredEnv = {...env, TRINITY123_BRIDGE_URL: base};
  const dataDir = await temp();
  const client = new Trinity123({env: configuredEnv, dataDir,
    transport: new CurlTransport({env: configuredEnv, baseUrl: base + '/v1', allowTestLoopback: true})});
  return {client, captured, dataDir};
}

test('saved agent retains tools and other settings; four requested fields override each session', () => {
  const value = sessionPayload('Ahoj');
  assert.equal(value.agent_id, profile.agent_id);
  assert.equal(value.agent.model, 'gpt-6-astra');
  assert.deepEqual(value.agent.reasoning, {effort: 'max', summary: 'auto'});
  assert.equal(value.agent.text.verbosity, 'medium');
  assert.deepEqual(Object.keys(value.agent).sort(), ['instructions', 'model', 'reasoning', 'text']);
  assert.equal(value.environment.type, 'openai_hosted');
  assert.match(value.agent.instructions, /Nikdy si ID ani výsledok nevymýšľaj/);
  assert.equal(value.stream, true);
});

test('missing key prevents session creation and is not reported as completion', async () => {
  const client = new Trinity123({env: {}, dataDir: await temp()});
  assert.equal(client.configuration().live_connection, 'not_verified');
  await assert.rejects(client.run({message: 'Ahoj'}), /Chýba OPENAI_API_KEY/);
});

test('SSE accepts CRLF, multiline data and done-only output', async () => {
  const seen = []; const parser = new SSEParser(event => seen.push(event));
  await parser.push(': heartbeat\r\n');
  await parser.push('data: {"type":\r\ndata: "done", "text":"žluťoučký"}\r\n\r');
  await parser.push('\n');
  await parser.push('data: [DONE]\n\n');
  assert.deepEqual(seen, [{type: 'done', text: 'žluťoučký'}]);
});

test('real curl streams a fixture session, executes authenticated bridge read, verifies content hash', async t => {
  const {client, captured, dataDir} = await fixture(t); const events = [];
  const result = await client.run({message: 'Prečítaj súbor.', onEvent: event => events.push(event)});
  assert.equal(captured.error, undefined);
  assert.equal(result.status, 'completed');
  assert.equal(result.turn_id, 'turn_test'); // a completed subagent cannot complete the root turn
  assert.equal(result.output_text, 'Overené podľa dokladu.'); // done is not duplicated after deltas
  assert.equal(result.output_verified, false);
  assert.equal(result.receipts[0].execution_id, 'fixture_proposal');
  assert.equal(captured.executions, 1);
  assert.equal(captured.toolResult.success, true);
  assert.equal(captured.toolResult.turn_id, 'turn_test');
  assert.equal(captured.payload.agent_id, profile.agent_id);
  assert.ok(events.some(e => e.type === 'trinity123.tool.receipt'));
  const persisted = await readFile(path.join(dataDir, 'runs', result.run_id + '.json'), 'utf8');
  assert.ok(!persisted.includes(env.OPENAI_API_KEY));
  assert.ok(!persisted.includes(env.TRINITY_LOCAL_TOKEN));
});

test('completed model turn after failed tool remains failed with real error receipt', async t => {
  const {client, captured} = await fixture(t, {failedTool: true});
  const result = await client.run({message: 'Prečítaj súbor.'});
  assert.equal(result.turn_status, 'completed');
  assert.equal(result.status, 'failed');
  assert.equal(result.actions_status, 'failed');
  assert.equal(captured.toolResult.success, false);
  assert.match(captured.toolResult.error, /nepotvrdil dokončené/);
});

test('disconnected stream with no terminal root turn is unverified', async t => {
  const {client} = await fixture(t, {disconnect: true});
  const result = await client.run({message: 'Ahoj'});
  assert.equal(result.status, 'unverified'); assert.equal(result.turn_status, 'unknown');
  assert.match(result.recovery, /automaticky neopakuj/);
});

test('cancelled root turn is failed even without a tool failure', async t => {
  const {client} = await fixture(t, {terminal: 'cancelled'});
  const result = await client.run({message: 'Ahoj'});
  assert.equal(result.status, 'failed'); assert.equal(result.turn_status, 'cancelled');
});

test('empty completed answer is unverified after persisted items are checked', async t => {
  const {client, captured} = await fixture(t, {missingText: true});
  const result = await client.run({message: 'Ahoj'});
  assert.equal(result.status, 'unverified');
  assert.ok(captured.requests.some(p => p.endsWith('/turns/turn_test/items')));
});

test('follow-up subscribes before input, saves idempotency key and ignores previous completion', async t => {
  const {client, captured} = await fixture(t, {follow: true});
  const result = await client.run({sessionId: 'sess_test', message: 'Pokračuj'});
  assert.equal(result.status, 'completed'); assert.equal(result.turn_id, 'turn_test');
  const subscribe = captured.requests.indexOf('GET /v1/agents/sessions/sess_test/events');
  const send = captured.requests.indexOf('POST /v1/agents/sessions/sess_test/events');
  assert.ok(subscribe >= 0 && send > subscribe);
  assert.equal(captured.message.events[0].input[0].content[0].text, 'Pokračuj');
});

test('tool results are durable; retry never executes the same side effect twice', async () => {
  let executions = 0, submits = 0;
  const client = new Trinity123({env, dataDir: await temp(),
    bridge: {execute: async () => { executions++; return {success: true, status: 'completed', execution_id: 'actual_fixture_id', output: 'fixture'}; }},
    transport: {json: async () => { submits++; return {}; }}});
  await client.toolResult('sess_test', action); await client.toolResult('sess_test', action);
  assert.equal(executions, 1); assert.equal(submits, 2);
});

test('crash marker refuses blind execution and returns an explicit uncertain result', async () => {
  let executions = 0, submitted;
  const dataDir = await temp(); await mkdir(path.join(dataDir, 'calls'));
  await writeFile(path.join(dataDir, 'calls/sess_test--turn_test--call_test.json'), '{"state":"started"}');
  const client = new Trinity123({env, dataDir,
    bridge: {execute: async () => { executions++; }}, transport: {json: async (_m, _p, value) => { submitted = value; }}});
  const receipt = await client.toolResult('sess_test', action);
  assert.equal(executions, 0); assert.equal(receipt.success, false);
  assert.match(submitted.events[0].error, /neistý/);
});

test('pending proposal never becomes a successful API tool result', async () => {
  let requests = 0;
  const bridge = new LocalBridge({env, fetcher: async () => { requests++; return Response.json({proposal: {id: 'proposal_pending', status: 'proposed'}}); }});
  const receipt = await bridge.execute({...action, arguments: {action_type: 'run_command', action_params: {command: 'npm test'}}});
  assert.equal(receipt.success, false); assert.equal(receipt.status, 'pending'); assert.equal(requests, 1);
  assert.equal(actionStatus([receipt]), 'pending');
});

test('bridge rejects secrets paths, unsupported commands, missing authentication and forged hashes', async () => {
  let requests = 0;
  const bridge = new LocalBridge({env, fetcher: async () => { requests++; return Response.json(requests === 1
    ? {proposal: {id: 'fixture', status: 'approved'}}
    : {status: 'completed', receipt: {content: 'mismatch', sha256: 'a'.repeat(64)}}); }});
  for (const file of ['.env', '../.env', '.secrets/key.txt', 'Local-Gateway/data/proposals.json', 'Local-Gateway/./data/proposals.json', '.env.', '.env ', 'Trinity/f.txt:ads', 'C:/x']) {
    const result = await bridge.execute({...action, arguments: {action_type: 'read_file', action_params: {file_path: file}}});
    assert.equal(result.success, false);
  }
  assert.equal(requests, 0);
  const invalid = await bridge.execute({...action, arguments: {action_type: 'run_command', action_params: {command: 'npm test; echo unsafe'}}});
  assert.equal(invalid.success, false); assert.equal(requests, 0);
  const forged = await bridge.execute(action); assert.match(forged.error, /nezodpovedá hashu/);
  const missing = await new LocalBridge({env: {}}).execute(action); assert.match(missing.error, /TRINITY_LOCAL_TOKEN/);
});

test('API credentials are never sent to an arbitrary base URL', () => {
  assert.throws(() => new CurlTransport({env, baseUrl: 'https://example.com/v1'}), /oficiálny/);
  assert.throws(() => new CurlTransport({env, baseUrl: 'http://example.com/v1', allowTestLoopback: true}), /oficiálny/);
  assert.throws(() => new LocalBridge({env: {TRINITY123_BRIDGE_URL: 'http://example.com'}}), /lokálna/);
  assert.equal(redact('token=' + env.OPENAI_API_KEY, env), 'token=[REDACTED]');
});

test('gateway registration reports missing configuration and blocks session creation', async () => {
  const route = createTrinity123Routes({env: {}, dataDir: await temp()});
  const response = {writeHead(status) {this.status = status;}, end(text) {this.value = JSON.parse(text);}};
  assert.equal(await route({method: 'GET'}, response, new URL('http://localhost/api/agents/trinity123'), body), true);
  assert.equal(response.value.installed, true); assert.equal(response.value.api_key_configured, false);
  await route({method: 'POST'}, response, new URL('http://localhost/api/agents/trinity123/sessions'), body);
  assert.equal(response.status, 503); assert.equal(response.value.status, 'blocked');
});

test('explicit API access denial is failed and reports the real HTTP status', async t => {
  const {client} = await fixture(t, {httpError: true});
  const result = await client.run({message: 'Ahoj'});
  assert.equal(result.status, 'failed'); assert.equal(result.session_id, null);
  assert.match(result.error, /HTTP 403: Fixture access denied/);
});

test('hosted environment failure cannot be reported as successful provisioning', async t => {
  const {client} = await fixture(t, {lifecycleFailed: true});
  const result = await client.run({message: 'Ahoj'});
  assert.equal(result.status, 'failed'); assert.match(result.error, /Fixture provisioning failed/);
});

test('reconnect buffers live events, restores the latest root turn and never resends input', async t => {
  const {client, captured} = await fixture(t, {follow: true, observe: true});
  const result = await client.run({mode: 'observe', sessionId: 'sess_test'});
  assert.equal(result.status, 'completed'); assert.equal(result.turn_id, 'turn_test');
  assert.equal(result.output_text, 'Overené podľa dokladu.'); assert.equal(captured.submits, 0);
});

test('disconnected observer does not stop the function responder', async t => {
  const {client, captured} = await fixture(t);
  const result = await client.run({message: 'Ahoj', onEvent: async () => { throw new Error('observer closed'); }});
  assert.equal(result.status, 'completed'); assert.equal(captured.executions, 1);
});

test('reconnect retains failed tool receipts instead of turning a completed model turn into success', async t => {
  const {client, dataDir} = await fixture(t, {follow: true, observe: true});
  await mkdir(path.join(dataDir, 'calls'));
  await writeFile(path.join(dataDir, 'calls/sess_test--turn_test--call_saved.json'), JSON.stringify({state: 'result_saved',
    session_id: 'sess_test', turn_id: 'turn_test', root_turn_id: 'turn_test', call_id: 'call_saved', tool: 'local_tool_execute',
    receipt: {success: false, status: 'failed', error: 'Saved actual fixture tool failure'}}));
  const result = await client.run({mode: 'observe', sessionId: 'sess_test'});
  assert.equal(result.turn_status, 'completed'); assert.equal(result.status, 'failed');
  assert.equal(result.actions_status, 'failed'); assert.equal(result.receipts[0].call_id, 'call_saved');
});

test('credential broker keeps secrets server-side and blocks mutating cloud tools',async()=>{
  const broker=new TrinityAccess({env:{OPENAI_API_KEY:'fixture'},readSecrets:async()=>({TRINITY_MCP_API_KEY:'private_fixture_secret'}),fetcher:async()=>Response.json({result:{content:[{type:'text',text:'{"status":"completed","receipt_id":"fixture_receipt"}'}]}})});
  const inventory=await broker.execute({operation:'inventory'});assert.ok(!JSON.stringify(inventory).includes('private_fixture_secret'));
  const blocked=await broker.execute({operation:'mcp_call',tool:'edit_source_file',arguments:{}});assert.equal(blocked.success,false);
  const result=await broker.execute({operation:'mcp_call',tool:'diagnostic_ping',arguments:{}});assert.equal(result.success,true);assert.match(JSON.stringify(result.output),/fixture_receipt/);
});

test('Trinity human-facing route aliases the original endpoint',async()=>{
  const route=createTrinity123Routes({env:{},dataDir:await temp()});const response={writeHead(status){this.status=status;},end(text){this.data=JSON.parse(text);}};
  assert.equal(await route({method:'GET'},response,new URL('http://localhost/api/agents/trinity'),body),true);assert.equal(response.status,200);assert.equal(response.data.name,'Trinity');
});
