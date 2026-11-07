import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { executeTapTask, TAP_AGENTS, TapStore } from '../src/tap-runtime.js';
import { fromLegacy, digest, verifyReceipt } from '../../packages/contracts/src/tap.js';
import { runTapMcpDiagnostic } from '../src/tap-mcp-adapter.js';

let mf, db, bucket;
before(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default { fetch() { return new Response("test fixture"); } };',
    compatibilityDate: '2026-10-01', d1Databases: { TAP_DB: 'tap-test-db' }, r2Buckets: { TAP_ARTIFACTS: 'tap-test-artifacts' } }));
  db = await mf.getD1Database('TAP_DB'); bucket = await mf.getR2Bucket('TAP_ARTIFACTS');
  const sql = await readFile(new URL('../docs/omni12/tap-foundation.sql', import.meta.url), 'utf8');
  for (const statement of sql.replace(/--[^\n]*/g, '').split(';').filter(s => s.trim())) await db.prepare(statement).run();
  await db.prepare('CREATE TABLE ops_events (action TEXT, details TEXT)').run();
});
after(async () => { await mf?.dispose(); });
function fixture(overrides = {}) {
  const m = fromLegacy({ agent_id: 'orchestrator', tool_id: 'diagnostic_ping', arguments: { message: 'local execution proof' } }, {
    sender_id: 'orchestrator', environment: 'local', authorization_ref: 'local-test-grant', idempotency_key: crypto.randomUUID()
  });
  const context = { principal: { authenticated: true, agent_id: m.sender.id }, environment: 'local',
    grant: { subject_id: m.sender.id, receiver_id: m.receiver.id, environment: 'local', authorization_ref: m.authorization_ref,
      expires_at: Date.now() + 60000, scopes: ['tool:diagnostic_ping'] } };
  return { m, context, env: { DB: db, TAP_DB: db, TAP_ARTIFACTS: bucket, ...overrides } };
}
const runRow = async m => db.prepare('SELECT * FROM tap_runs WHERE run_id=?').bind(m.run_id).first();
const audit = async m => (await db.prepare('SELECT status,error_code FROM tap_audit_events WHERE run_id=? ORDER BY id').bind(m.run_id).all()).results;
test('real Registry -> runTool diagnostic_ping -> D1/R2 readback -> VERIFIED; replay executes once', async () => {
  const { m, env, context } = fixture();
  const first = await executeTapTask(env, m, context);
  assert.equal(first.status, 'VERIFIED', JSON.stringify(first));
  assert.equal(first.run_id, m.run_id); assert.equal(first.result.echo, m.payload.arguments.message);
  assert.equal(await verifyReceipt(first.evidence[0], m, first.result), true);
  assert.deepEqual((await audit(m)).map(e => e.status), ['QUEUED', 'RUNNING', 'COMPLETED', 'VERIFIED']);
  assert.equal((await runRow(m)).status, 'VERIFIED');
  const second = await executeTapTask(env, m, context);
  assert.deepEqual(second, first);
  const oldAudit = await db.prepare('SELECT details FROM ops_events WHERE details LIKE ?').bind(`%${first.result.receipt_id}%`).all();
  assert.equal(oldAudit.results.length, 1);
  const row = await db.prepare('SELECT artifact_key FROM tap_evidence_receipts WHERE run_id=?').bind(m.run_id).first();
  assert.deepEqual(JSON.parse(await (await bucket.get(row.artifact_key)).text()), first.evidence[0]);
});
test('concurrent duplicate requests have one execution owner', async () => {
  const { m, env, context } = fixture();
  const outcomes = await Promise.all([executeTapTask(env, m, context), executeTapTask(env, m, context)]);
  assert.equal(outcomes.filter(o => o.status === 'VERIFIED').length >= 1, true);
  assert.equal(outcomes.every(o => ['VERIFIED', 'UNKNOWN_OUTCOME'].includes(o.status)), true);
  assert.equal((await audit(m)).filter(e => e.status === 'RUNNING').length, 1);
});
test('omitted legacy message uses existing schema default and remains verifiable', async () => {
  const { m, env, context } = fixture(); m.payload.arguments = {};
  const outcome = await executeTapTask(env, m, context);
  assert.equal(outcome.status, 'VERIFIED'); assert.equal(outcome.result.echo, 'ping');
  assert.equal(await verifyReceipt(outcome.evidence[0], m, outcome.result), true);
});
test('host legacy DB is never inherited by diagnostic execution', async () => {
  let accesses = 0;
  const { m, env, context } = fixture({ DB: { prepare() { accesses++; throw new Error('must not reach production-like legacy DB'); } } });
  assert.equal((await executeTapTask(env, m, context)).status, 'VERIFIED');
  assert.equal(accesses, 0);
});
test('stale state transition cannot append an audit event', async () => {
  const { m, env, context } = fixture(); await executeTapTask(env, m, context);
  const old = await audit(m);
  await assert.rejects(new TapStore(db, bucket).advance(m, 'RUNNING', 'COMPLETED'), /TAP_STATE_CONFLICT/);
  assert.deepEqual(await audit(m), old); assert.equal((await runRow(m)).status, 'VERIFIED');
});
test('same idempotency key with changed request or run is a conflict, never a new execution', async () => {
  const { m, env, context } = fixture(); await executeTapTask(env, m, context);
  await assert.rejects(executeTapTask(env, { ...m, run_id: crypto.randomUUID() }, context), /TAP_IDEMPOTENCY_CONFLICT/);
  await assert.rejects(executeTapTask(env, { ...m, payload: { ...m.payload, arguments: { message: 'changed' } } }, context), /TAP_IDEMPOTENCY_CONFLICT/);
});
test('identity, scope, expiry and production denial happen before storage/execution', async () => {
  const { m, env, context } = fixture();
  for (const ctx of [{ ...context, principal: { authenticated: false } }, { ...context, principal: { authenticated: true, agent_id: 'forged' } },
    { ...context, grant: { ...context.grant, scopes: ['*'] } }, { ...context, grant: { ...context.grant, expires_at: 0 } },
    { ...context, environment: 'production' }]) await assert.rejects(executeTapTask(env, m, ctx), /TAP_/);
  assert.equal(await runRow(m), null);
});
test('Meta auru-dev-agent is a single declared identity with no inherited tool/PC/production permissions', async () => {
  assert.equal(TAP_AGENTS['auru-dev-agent'].availability, 'NOT_TESTED');
  assert.deepEqual(TAP_AGENTS['auru-dev-agent'].scopes, []);
  const { m, env, context } = fixture();
  const meta = { ...m, environment: 'staging', receiver: { type: 'agent', id: 'auru-dev-agent' } };
  await assert.rejects(executeTapTask(env, meta, { ...context, environment: 'staging', grant: { ...context.grant, receiver_id: 'auru-dev-agent', environment: 'staging' } }), /TAP_SCOPE_DENIED/);
  assert.equal(await runRow(m), null);
});
test('legacy DB/R2 bindings alone cannot activate TAP', async () => {
  const { m, context } = fixture();
  await assert.rejects(executeTapTask({ DB: db, ARTIFACTS: bucket }, m, context), /TAP_ISOLATED_STORAGE_REQUIRED/);
});
test('unimplemented natural-language criteria cannot be silently marked verified', async () => {
  const { m, env, context } = fixture(); m.payload.acceptance_criteria = ['Deploy production successfully'];
  await assert.rejects(executeTapTask(env, m, context), /TAP_UNSUPPORTED_ACCEPTANCE_CRITERIA/);
  assert.equal(await runRow(m), null);
});
test('unknown tool or PC shell is refused even if grant requests it', async () => {
  const { m, env, context } = fixture(); m.payload.tool_id = 'pc_shell_exec';
  context.grant.scopes.push('tool:pc_shell_exec');
  await assert.rejects(executeTapTask(env, m, context), /TAP_SCOPE_DENIED/); assert.equal(await runRow(m), null);
});
test('R2 write failure becomes durable UNKNOWN_OUTCOME, logs safe codes, and is not retried', async () => {
  let puts = 0;
  const { m, env, context } = fixture({ TAP_ARTIFACTS: { put: async () => { puts++; throw new Error('Bearer never-log-this-secret'); } } });
  const first = await executeTapTask(env, m, context);
  assert.equal(first.status, 'UNKNOWN_OUTCOME'); assert.equal((await runRow(m)).status, 'UNKNOWN_OUTCOME');
  const second = await executeTapTask(env, m, context); assert.deepEqual(second, first); assert.equal(puts, 1);
  assert.equal(JSON.stringify(await audit(m)).includes('never-log-this-secret'), false);
  assert.equal(JSON.stringify(first).includes('never-log-this-secret'), false);
});
test('R2 readback tampering refuses VERIFIED after actual legacy execution', async () => {
  const { m, env, context } = fixture({ TAP_ARTIFACTS: { put: (...a) => bucket.put(...a), get: async () => ({ text: async () => '{"forged":true}' }) } });
  assert.equal((await executeTapTask(env, m, context)).status, 'UNKNOWN_OUTCOME');
});
test('lost R2 evidence on replay degrades to UNKNOWN_OUTCOME without a second execution', async () => {
  const { m, env, context } = fixture(); await executeTapTask(env, m, context);
  const row = await db.prepare('SELECT artifact_key FROM tap_evidence_receipts WHERE run_id=?').bind(m.run_id).first();
  await bucket.delete(row.artifact_key);
  assert.equal((await executeTapTask(env, m, context)).status, 'UNKNOWN_OUTCOME');
  assert.equal((await audit(m)).filter(e => e.status === 'RUNNING').length, 1);
});
test('D1 failure is fail-closed before execution', async () => {
  const { m, env, context } = fixture({ TAP_DB: { prepare: () => { throw new Error('test DB unavailable'); } } });
  await assert.rejects(executeTapTask(env, m, context), /unavailable/); assert.equal(await runRow(m), null);
});
test('D1 receipt failure after execution is UNKNOWN_OUTCOME and cannot be replayed', async () => {
  const badDb = { batch: (...a) => db.batch(...a), prepare: sql => {
    if (sql.includes('INSERT INTO tap_evidence_receipts')) return { bind: () => ({ run: async () => ({ success: false }) }) };
    return db.prepare(sql);
  } };
  const { m, env, context } = fixture({ TAP_DB: badDb });
  assert.equal((await executeTapTask(env, m, context)).status, 'UNKNOWN_OUTCOME');
  assert.equal((await executeTapTask(env, m, context)).status, 'UNKNOWN_OUTCOME');
  assert.equal((await audit(m)).filter(e => e.status === 'RUNNING').length, 1);
});
test('interrupted durable RUNNING is reconciled as unknown without automatic takeover', async () => {
  const { m, env, context } = fixture();
  await db.prepare(`INSERT INTO tap_runs(run_id,task_id,environment,sender_id,agent_id,idempotency_key,request_hash,status) VALUES(?,?,?,?,?,?,?,'RUNNING')`)
    .bind(m.run_id, m.task_id, m.environment, m.sender.id, m.receiver.id, m.idempotency_key, await digest(m)).run();
  assert.equal((await executeTapTask(env, m, context)).status, 'UNKNOWN_OUTCOME'); assert.deepEqual(await audit(m), []);
});
test('production needs explicit diagnostic-only activation in addition to a server grant', async () => {
  const { m, env, context } = fixture(); m.environment = context.environment = context.grant.environment = 'production';
  await assert.rejects(executeTapTask(env, m, context), /TAP_ENVIRONMENT_DENIED/);
  env.TRINITY_TAP_PRODUCTION = 'diagnostic-only';
  assert.equal((await executeTapTask(env, m, context)).status, 'VERIFIED');
});
test('MCP adapter keeps legacy output and deterministic replay, isolates principals and rejects changed requests', async () => {
  const { env } = fixture(); Object.assign(env, { TRINITY_TAP_ENABLED: 'true', TRINITY_ENV: 'staging' });
  const args = { idempotency_key: crypto.randomUUID() }, access = { projectControl: true, principal: 'api-key:fixture-a' };
  const first = await runTapMcpDiagnostic(env, args, access), replay = await runTapMcpDiagnostic(env, args, access);
  assert.equal(first.data.status, 'healthy'); assert.equal(first.data.echo, 'ping'); assert.equal(first.isError, false);
  assert.deepEqual(replay, first); assert.equal(await verifyReceipt(first.data.tap.evidence[0], first.data.tap_request, first.data.tap.result), true);
  const other = await runTapMcpDiagnostic(env, args, { ...access, principal: 'api-key:fixture-b' });
  assert.notEqual(other.data.tap.run_id, first.data.tap.run_id);
  await assert.rejects(runTapMcpDiagnostic(env, { ...args, message: 'changed' }, access), /TAP_IDEMPOTENCY_CONFLICT/);
});
test('MCP adapter never accepts forged principal/grants in body or read-only host access', async () => {
  const { env } = fixture(); Object.assign(env, { TRINITY_TAP_ENABLED: 'true', TRINITY_ENV: 'staging' });
  const access = { projectControl: true, principal: 'api-key:fixture' };
  await assert.rejects(runTapMcpDiagnostic(env, {}, { ...access, projectControl: false }), /TAP_MCP_IDENTITY_REQUIRED/);
  await assert.rejects(runTapMcpDiagnostic(env, {}, { projectControl: true }), /TAP_MCP_IDENTITY_REQUIRED/);
  await assert.rejects(runTapMcpDiagnostic(env, { principal: 'owner', grant: { scopes: ['*'] } }, access));
});
test('MCP adapter reports evidence storage failure as isError UNKNOWN_OUTCOME, never healthy', async () => {
  const { env } = fixture({ TAP_ARTIFACTS: { put: async () => { throw new Error('fixture failure'); } } });
  Object.assign(env, { TRINITY_TAP_ENABLED: 'true', TRINITY_ENV: 'staging' });
  const outcome = await runTapMcpDiagnostic(env, {}, { projectControl: true, principal: 'api-key:failure' });
  assert.equal(outcome.isError, true); assert.equal(outcome.data.status, 'unknown_outcome'); assert.equal(outcome.data.tap.status, 'UNKNOWN_OUTCOME');
});
