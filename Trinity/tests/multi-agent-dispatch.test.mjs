import test from 'node:test';
import assert from 'node:assert/strict';
import { runTool } from '../src/tools.js';
import { agentById } from '../src/registry.js';
import { SovereignAuthEngine, CryptoSovereignLedger } from '../src/multi-agent-orchestrator.js';

test('multi_agent_dispatch enqueues, assigns the specialist and keeps the ledger intact', async () => {
  const out = await runTool({}, agentById('orchestrator'), 'multi_agent_dispatch',
    { title: 'Navrhni škálovanie', taskType: 'architecture', priority: 'HIGH' },
    { adminAuthorized: true, ownerMode: true });
  assert.equal(out.assigned_agent, 'antigravity');
  assert.equal(out.status, 'QUEUED');
  assert.equal(out.ledger_integrity.valid, true);
  assert.equal(out._evidence.effect, 'proposal');
});

test('execute=true without a configured provider fails honestly, never as success', async () => {
  const out = await runTool({}, agentById('orchestrator'), 'multi_agent_dispatch',
    { title: 'Výskum', taskType: 'research', execute: true },
    { adminAuthorized: true, ownerMode: true });
  assert.equal(out.status, 'FAILED');
  assert.ok(out.result.error);
  assert.equal(out._evidence.effect, 'proposal');
});

test('tampering with the ledger is detected', () => {
  const ledger = new CryptoSovereignLedger();
  ledger.appendRecord('t', 'A', { x: 1 });
  ledger.chain[1].data.details.x = 2;
  assert.equal(ledger.verifyChainIntegrity().valid, false);
});

test('auth tokens reject tampered payloads and unknown principals', () => {
  const auth = new SovereignAuthEngine('test-secret');
  const t = auth.generateToken('basterix', { a: 1 });
  assert.equal(auth.verifyToken(t.token, { a: 1 }).valid, true);
  assert.equal(auth.verifyToken(t.token, { a: 2 }).reason, 'PAYLOAD_TAMPERED');
  assert.equal(auth.verifyToken(auth.generateToken('intruder', {}).token).reason, 'UNAUTHORIZED_PRINCIPAL');
});
