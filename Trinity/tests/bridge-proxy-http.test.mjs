import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { BRIDGE_AUTH_VERSION } from '../../packages/contracts/src/bridge-auth.js';

let mf, host, fixture, limits, kv;
const origin = 'https://proxy-auth.test';
const bridge = 'fixture-explicit-bridge-credential', owner = 'fixture-owner-ops-credential';
async function request(path, body, headers = {}) {
  return host.fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
const records = async () => (await (await fixture.fetch('https://fixture.test/records')).json()).records;

before(async () => {
  const modules = readdirSync('dist').filter(n => !n.endsWith('.map') && !n.endsWith('.md')).map(name => ({ type: name === 'index.js' ? 'ESModule' : 'Text', path: resolve('dist', name) }));
  modules.sort((a, b) => a.type === 'ESModule' ? -1 : b.type === 'ESModule' ? 1 : 0);
  mf = new Miniflare(convertV4MiniflareOptions({ workers: [
    { name: 'host', modules, compatibilityDate: '2026-10-01', compatibilityFlags: ['nodejs_compat'],
      bindings: { TRINITY_ENV: 'production', TRINITY_BRIDGE_TOKEN: bridge, TRINITY_OPS_KEY: owner },
      d1Databases: { DB: 'bridge-auth-db' }, kvNamespaces: { PC_STATE: 'bridge-auth-kv' }, outboundService: { name: 'fixture' } },
    { name: 'fixture', modules: true, compatibilityDate: '2026-10-01', script: `const records=[];export default {async fetch(req){
      if(new URL(req.url).pathname==='/records')return Response.json({records});
      const body=await req.json();records.push({url:req.url,token:req.headers.get('X-Trinity-Bridge-Token'),body});
      if(body.payload?.fixture_response==='missing')return Response.json({status:'completed'});
      if(body.payload?.fixture_response==='failed')return Response.json({status:'failed',exit_code:1});
      return Response.json({status:'completed',exit_code:0,text:'local provider fixture',receipt_id:'fixture-read-receipt',local_ledger_receipt:{receipt_id:'fixture-local-ledger',exit_code:0,block_hash:'a'.repeat(64)}});
    }};` }
  ] }));
  host = await mf.getWorker('host'); fixture = await mf.getWorker('fixture');
  kv = await mf.getKVNamespace('PC_STATE', 'host'); await kv.put('bridge:tunnel_meta', JSON.stringify({ tunnel_url: 'https://bridge-fixture.test', auth_version: BRIDGE_AUTH_VERSION }));
  limits = await mf.getD1Database('DB', 'host');
  await limits.prepare('CREATE TABLE ops_limits(key TEXT PRIMARY KEY,window INTEGER,count INTEGER)').run();
  const sql = readFileSync('migrations/0055_sovereign_ledger_v3.sql', 'utf8');
  for (const statement of sql.replace(/--[^\n]*/g, '').split(/;\s*(?:\r?\n|$)/).filter(s => s.trim())) await limits.prepare(statement).run();
});
after(async () => { await mf?.dispose(); });

test('public proxy paths deny anonymous or forged identities before outbound traffic or rate-limit writes', async () => {
  for (const [path, body] of [['/api/ollama/chat', { messages: [] }], ['/api/launch', { target: 'notepad', verifiedGoogleToken: true }], ['/api/command', { command: 'otvor notepad' }], ['/api/command', { command: 'ping' }]]) {
    const res = await request(path, body, { 'x-trinity-email': 'owner@example.test' });
    assert.equal(res.status, 401, `${path}: ${await res.text()}`);
  }
  assert.deepEqual(await records(), []);
  assert.equal((await limits.prepare('SELECT COUNT(*) AS count FROM ops_limits').first()).count, 0);
});
test('a forged local token prefix cannot borrow the server credential', async () => {
  const before = (await records()).length;
  const res = await request('/api/ollama/chat', { messages: [] }, { 'X-Trinity-Bridge-Token': 'trinity-local-fixture-forged' });
  assert.equal(res.status, 401); assert.equal((await records()).length, before);
});
test('explicit bridge credential and authenticated owner preserve the actual Ollama proxy path', async () => {
  for (const headers of [{ 'X-Trinity-Bridge-Token': bridge }, { Authorization: 'Bearer ' + owner }]) {
    const res = await request('/api/ollama/chat', { messages: [{ role: 'user', content: 'fixture' }] }, headers);
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal((await res.json()).text, 'local provider fixture');
    const last = (await records()).at(-1); assert.equal(last.token, bridge);
  }
});
test('launch and command forward only allowlisted action payload, never asserted identity flags or caller PII', async () => {
  for (const [path, body] of [['/api/launch', { target: 'notepad', email: 'spoof@example.test', verifiedWindowsToken: true }], ['/api/command', { command: 'otvor notepad' }]]) {
    const res = await request(path, body, { Authorization: 'Bearer ' + owner, 'x-trinity-email': 'spoof@example.test', 'x-trinity-phone': 'fixture' });
    assert.equal(res.status, 200, await res.clone().text());
    const last = (await records()).at(-1);
    assert.deepEqual(last.body, { action: 'open_app', payload: { app: 'notepad' } });
    assert.equal(last.token, bridge);
  }
});
test('authenticated non-PC commands retain their cloud path without forwarding a bridge credential', async () => {
  const before = (await records()).length;
  const res = await request('/api/command', { command: 'ping' }, { Authorization: 'Bearer ' + owner });
  assert.equal(res.status, 200); assert.equal((await records()).length, before);
});
test('valid credentials do not bypass cross-origin checks', async () => {
  const before = (await records()).length;
  const res = await request('/api/launch', { target: 'notepad' }, { Origin: 'https://attacker.test', 'X-Trinity-Bridge-Token': bridge });
  assert.equal(res.status, 403); assert.equal((await records()).length, before);
});
test('registration and bridge execution cannot be authorized by legacy identity assertions or a public token prefix', async () => {
  const before = (await records()).length;
  const meta = await kv.get('bridge:tunnel_meta');
  for (const path of ['/api/bridge/register-tunnel', '/api/bridge', '/api/bridge/execute']) {
    const res = await request(path, { tunnel_url: 'https://untrusted.example.test', email: 'owner@example.test', verifiedGoogleToken: true, verifiedWindowsToken: true, auth_version: BRIDGE_AUTH_VERSION }, { 'X-Trinity-Bridge-Token': 'trinity-local-fixture-forged' });
    assert.equal(res.status, 401, path);
  }
  assert.equal(await kv.get('bridge:tunnel_meta'), meta); assert.equal((await records()).length, before);
});
test('only the authenticated server registration stamps usable tunnel metadata and ignores caller identity flags', async () => {
  const res = await request('/api/bridge/register-tunnel', { tunnel_url: 'https://bridge-fixture.test', sid: 'forged-sid', verifiedGoogleToken: true, verifiedWindowsToken: true, email: 'spoof@example.test' }, { Authorization: 'Bearer ' + owner });
  assert.equal(res.status, 200, await res.clone().text());
  const meta = JSON.parse(await kv.get('bridge:tunnel_meta'));
  assert.equal(meta.auth_version, BRIDGE_AUTH_VERSION); assert.equal(meta.channel, 'authenticated-owner-session');
  assert.equal(meta.windows_sid, undefined); assert.equal(meta.email, undefined);
  const execution = await request('/api/bridge/execute', { action: 'e2e_truth_verify', payload: {}, verifiedGoogleToken: true, email: 'spoof@example.test' }, { Authorization: 'Bearer ' + owner });
  assert.equal(execution.status, 200, await execution.clone().text());
  assert.deepEqual((await records()).at(-1).body, { action: 'e2e_truth_verify', payload: {} });
});
test('legacy cache cannot cause the authenticated proxy to send a real token to an old poisoned host', async () => {
  const previous = await kv.get('bridge:tunnel_meta'); const before = (await records()).length;
  try {
    await kv.put('bridge:tunnel_meta', JSON.stringify({ tunnel_url: 'https://untrusted.example.test' }));
    const res = await request('/api/ollama/chat', { messages: [] }, { Authorization: 'Bearer ' + owner });
    assert.equal(res.status, 503); assert.equal((await records()).length, before);
  } finally { await kv.put('bridge:tunnel_meta', previous); }
});
test('registration cannot accept a credential-bearing URL or an arbitrary path', async () => {
  const previous = await kv.get('bridge:tunnel_meta');
  for (const url of ['https://user:password@bridge-fixture.test', 'https://bridge-fixture.test/path', 'https://bridge-fixture.test/?token=x']) {
    const res = await request('/api/bridge/register-tunnel', { tunnel_url: url }, { Authorization: 'Bearer ' + owner });
    assert.equal(res.status, 400);
  }
  assert.equal(await kv.get('bridge:tunnel_meta'), previous);
});

test('bridge refuses a success claim when authenticated execution lacks its original evidence',async()=>{
  for(const fixture_response of ['missing','failed']) {
    const response=await request('/api/bridge/execute',{action:'e2e_truth_verify',payload:{fixture_response}},{Authorization:'Bearer '+owner});
    assert.equal(response.status,502);
    const body=await response.json();
    assert.equal(body.ok,false);
    assert.equal(body.status,'EXECUTION_NOT_VERIFIED');
    assert.equal(body.lifecycle_guard.state,'FAILED');
  }
});
