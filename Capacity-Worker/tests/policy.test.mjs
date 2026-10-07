import test from 'node:test';
import assert from 'node:assert/strict';
import { admission, capacityStatus, dailyLimit, requestId, workUnits } from '../src/policy.js';

test('70%, 85% and 95% transitions are exact', () => {
  assert.equal(capacityStatus(69, 100).stage, 'normal');
  assert.equal(capacityStatus(70, 100).spacing_ms, 2000);
  assert.equal(capacityStatus(85, 100).spacing_ms, 10000);
  assert.equal(capacityStatus(95, 100).stage, 'paused');
});
test('reserved work counts before provider execution', () => {
  const decision = admission({ spent: 50, reserved: 40, nextAdmission: 0 }, 5, 100, Date.parse('2026-10-06T23:00:00Z'));
  assert.equal(decision.allowed, false);
  assert.equal(decision.retry_at, Date.parse('2026-10-07T00:00:00Z'));
});
test('cooldown denies new admissions instead of sleeping in a Worker', () => {
  assert.equal(admission({ spent: 0, reserved: 0, nextAdmission: 5000 }, 1, 100, 4000).reason, 'cooldown');
});
test('projected usage selects spacing before crossing a threshold', () => {
  assert.equal(admission({ spent: 69, reserved: 0, nextAdmission: 0 }, 1, 100, 4000).nextAdmission, 6000);
});
test('missing config and invalid quantities fail closed', () => {
  for (const value of [undefined, '', '0', '1e3', '-1']) assert.throws(() => dailyLimit(value));
  for (const value of [-1, 1.5, Infinity, '1', 1000001]) assert.throws(() => workUnits(value));
  assert.equal(workUnits(0, true), 0);
  assert.throws(() => requestId('__proto__'));
});
