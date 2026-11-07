import test from 'node:test';
import assert from 'node:assert/strict';
import { QuantumRouter } from '../src/quantum-router.js';
import { ResonanceMatrix369 } from '../src/resonance-matrix.js';
import { EntanglementBridge, globalEntanglementBridge } from '../src/entanglement-sync.js';
import fs from 'node:fs';
import path from 'node:path';

test('1. Quantum Router: Vlnová funkcia zámeru ψ a pozorovateľský kolaps', () => {
  const codePrompt = "Oprav funkciu v scripte a vytvor pull request na GitHube";
  const result = QuantumRouter.route(codePrompt);

  assert.ok(Array.isArray(result.psi), 'ψ musí byť pole kandidátov');
  assert.equal(result.psi.length, 5);
  
  // Súčet pravdepodobností musí byť 1.0 (s toleranciou zaokrúhľovania)
  const sumProb = result.psi.reduce((acc, c) => acc + c.score, 0);
  assert.ok(Math.abs(sumProb - 1.0) < 0.01, 'Súčet koeficientov musí konvergovať k 1.0');

  // Kolaps zámeru na coder
  assert.equal(result.collapsedAgent, 'coder', 'Kódovacia požiadavka musí kolabovať na coder');
  assert.ok(result.confidence > 0.25);
});

test('2. Rezonančná matica 3-6-9: Štruktúra Téza -> Antitéza -> Syntéza', async () => {
  const matrix = await ResonanceMatrix369.process("Naplánuj bezpečnú architektúru systému");

  // Vrstva 3 - Téza
  assert.equal(matrix.thesis.layer, 3);
  assert.equal(matrix.thesis.userInput, "Naplánuj bezpečnú architektúru systému");
  assert.ok(matrix.thesis.timestamp);
  assert.ok(matrix.thesis.collapsed);

  // Vrstva 6 - Antitéza
  assert.ok(Array.isArray(matrix.transformation));
  assert.equal(matrix.transformation.length, 6, 'Musí obsahovať presne 6 transformačných uzlov');
  const checkNames = matrix.transformation.map(t => t.checkName);
  assert.deepEqual(checkNames, [
    'guardianCheck',
    'safetyCheck',
    'capabilityCheck',
    'memorySearch',
    'toolSelection',
    'routingDecision'
  ]);
  assert.ok(matrix.transformation.every(t => t.passed === true));

  // Vrstva 9 - Syntéza
  assert.equal(matrix.synthesis.layer, 9);
  assert.ok(matrix.synthesis.evidence.receiptId.startsWith('SOV-369-'));
  assert.equal(matrix.synthesis.evidence.verified, true);
  assert.ok(matrix.synthesis.ledgerRecord.proof.startsWith('sha256:'));
  assert.equal(matrix.synthesis.memoryUpdate.stmSynced, true);
});

test('3. Entanglement Sync: Event-driven synchronizácia bez pollovania', () => {
  const bridge = new EntanglementBridge({ sessionId: 'test-session-369' });
  let receivedEvent = null;

  bridge.on('state-change', (event) => {
    receivedEvent = event;
  });

  bridge.emitStateChange('state-change', {
    status: 'ACTIVE_RESONANCE',
    node: 'EdgeWorker'
  });

  assert.ok(receivedEvent !== null, 'Udalosť musí byť doručená okamžite bez pollingu');
  assert.equal(receivedEvent.channel, 'state-change');
  assert.equal(receivedEvent.sessionId, 'test-session-369');
  assert.equal(receivedEvent.data.status, 'ACTIVE_RESONANCE');
});

test('4. Rezonančná konfigurácia (resonance.json)', () => {
  const configPath = path.resolve('config/resonance.json');
  assert.ok(fs.existsSync(configPath), 'resonance.json musí existovať');

  const raw = fs.readFileSync(configPath, 'utf8');
  const cfg = JSON.parse(raw);

  assert.equal(cfg.protocol, 'RESONANCE_369');
  assert.equal(cfg.resonance.layer3.captureIntent, true);
  assert.equal(cfg.resonance.layer6.guardian, true);
  assert.equal(cfg.resonance.layer9.ledger, true);
  assert.equal(cfg.entanglement.mode, 'event-driven');
});
