import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MessageSchema, ReceiptSchema, fromLegacy, transition, createReceipt, verifyReceipt, canonicalJson, digest } from '../src/tap.js';
const request = () => fromLegacy({ agent_id: 'orchestrator', tool_id: 'diagnostic_ping', arguments: { message: 'proof' } }, {
  sender_id: 'orchestrator', environment: 'local', authorization_ref: 'test-grant', idempotency_key: crypto.randomUUID()
});
test('legacy adapter preserves task/run and never promotes status or old evidence', () => {
  const m = request();
  const out = fromLegacy({ agent_id: 'orchestrator', tool_id: 'diagnostic_ping', status: 'VERIFIED', _evidence: { receipt_id: 'old' } }, {
    sender_id: 'orchestrator', environment: 'local', authorization_ref: 'g', idempotency_key: 'stable', task_id: m.task_id, run_id: m.run_id
  });
  assert.equal(out.status, 'REQUESTED'); assert.equal(out.task_id, m.task_id); assert.equal(out.run_id, m.run_id); assert.deepEqual(out.evidence, []);
});
test('strict message rejects version, invalid IDs, unknown fields and non-JSON arguments', () => {
  const m = request();
  for (const mutation of [{ protocol: 'v2' }, { run_id: 'fake' }, { extra: true }, { payload: { ...m.payload, arguments: { f() {} } } }]) {
    assert.equal(MessageSchema.safeParse({ ...m, ...mutation }).success, false);
  }
});
test('requests cannot fabricate completion, errors or evidence', async () => {
  const m = request(), r = await createReceipt(m, { ok: true });
  for (const mutation of [{ status: 'VERIFIED' }, { result: 437 }, { evidence: [r] }, { error: { code: 'E', message: '' } }]) {
    assert.equal(MessageSchema.safeParse({ ...m, ...mutation }).success, false);
  }
});
test('state machine rejects skips, terminal retries and UNKNOWN_OUTCOME retries', () => {
  assert.equal(transition('RUNNING', 'UNKNOWN_OUTCOME'), 'UNKNOWN_OUTCOME');
  for (const [a, b] of [['REQUESTED', 'VERIFIED'], ['UNKNOWN_OUTCOME', 'RUNNING'], ['FAILED', 'RUNNING'], ['VERIFIED', 'RUNNING']]) {
    assert.throws(() => transition(a, b), /TAP_INVALID_TRANSITION/);
  }
});
test('canonical hash independent of object key order, sensitive to data changes', async () => {
  assert.equal(await digest({ b: [1, null], a: true }), await digest({ a: true, b: [1, null] }));
  assert.notEqual(await digest({ a: 1 }), await digest({ a: 2 }));
  assert.throws(() => canonicalJson({ a: undefined }), /TAP_NON_JSON_VALUE/);
});
test('receipt binds request/result/identity/environment; plain checksum is not provider authentication', async () => {
  const m = request(), result = { exitCode: 0, value: 437 }, receipt = await createReceipt(m, result);
  assert.equal(ReceiptSchema.safeParse(receipt).success, true);
  assert.equal(await verifyReceipt(receipt, m, result), true);
  assert.equal(await verifyReceipt(receipt, m, { ...result, value: 438 }), false);
  assert.equal(await verifyReceipt(receipt, { ...m, run_id: crypto.randomUUID() }, result), false);
  assert.equal(await verifyReceipt({ ...receipt, agent_id: 'other' }, m, result), false);
  assert.equal(await verifyReceipt(receipt, { ...m, environment: 'production' }, result), false);
  assert.equal(MessageSchema.safeParse({ ...m, kind: 'task.result', status: 'VERIFIED', result, evidence: [{ ...receipt, run_id: crypto.randomUUID() }] }).success, false);
});
