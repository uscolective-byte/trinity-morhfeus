import test from 'node:test';
import assert from 'node:assert/strict';
import { assessOperationalPulse, requiredOperationalStages } from '../src/operational-pulse.js';

const now = new Date('2026-11-04T12:00:00.000Z');
const valid = Object.fromEntries(requiredOperationalStages().map((name, index) => [
  name, { verified: true, checkedAt: '2026-11-04T11:59:00.000Z', receiptId: 'receipt-' + index }
]));

test('does not call an unknown runtime operational', () => {
  const result = assessOperationalPulse({}, now);
  assert.equal(result.status, 'not_verified');
  assert.equal(result.stagesVerified, 0);
  assert.equal(result.autonomousExecutionConfirmed, false);
});

test('requires all five recent receipt-backed observations', () => {
  const result = assessOperationalPulse(valid, now);
  assert.equal(result.status, 'operational_evidence_present');
  assert.equal(result.stagesVerified, 5);
  assert.equal(result.autonomousExecutionConfirmed, false);
});

test('rejects stale and future-dated observations', () => {
  const stale = structuredClone(valid);
  stale.planner.checkedAt = '2026-11-04T11:50:00.000Z';
  assert.equal(assessOperationalPulse(stale, now).status, 'not_verified');
  const future = structuredClone(valid);
  future.planner.checkedAt = '2026-11-04T12:01:00.000Z';
  assert.equal(assessOperationalPulse(future, now).status, 'not_verified');
});

test('requires receipt ID even when verified is true', () => {
  const missing = structuredClone(valid);
  missing.toolExecutor.receiptId = '';
  const result = assessOperationalPulse(missing, now);
  assert.equal(result.observations.toolExecutor.status, 'unverified');
});

test('rejects invalid input and invalid check time', () => {
  assert.throws(() => assessOperationalPulse(null, now), TypeError);
  assert.throws(() => assessOperationalPulse({}, 'not-a-date'), TypeError);
});
