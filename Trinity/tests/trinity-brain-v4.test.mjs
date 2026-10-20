import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrinityBrainV4 } from '../src/v4/TrinityBrainV4.js';
import { MetaBrain } from '../src/v4/MetaBrain.js';
import { QuantumCoreEngine } from '../src/v4/QuantumCoreEngine.js';
import { EvoEngineV3 } from '../src/v4/EvoEngineV3.js';
import { SkillForge } from '../src/v4/SkillForge.js';
import { HybridBrain } from '../src/v4/HybridBrain.js';

test('MetaBrain: cognitive perception and archetype weights', async () => {
  const meta = new MetaBrain({});
  const result = await meta.perceive({
    input: 'Navrhni novú inovatívnu funkciu pre Trinity',
    activeArchetypes: { creator: 0.35, ruler: 0.15, sage: 0.20, magician: 0.30, rebel: 0.0 }
  });

  assert.equal(result.semanticIntent, 'CREATION');
  assert.equal(result.dominantArchetype, 'creator');
  assert.ok(result.cognitiveResonance > 0);
});

test('QuantumCoreEngine (QCE-Fusion): 5-agent consensus and decision plan', async () => {
  const qce = new QuantumCoreEngine({}, {});
  const plan = await qce.executeFusion({
    task: { query: 'Analyzuj stav siete' },
    metaContext: { dominantArchetype: 'sage', semanticIntent: 'ANALYSIS', cognitiveResonance: 0.8 },
    target: 'CLOUD_DO'
  });

  assert.ok(plan.confidence > 0);
  assert.ok(plan.decision);
  assert.equal(plan.decision.target, 'CLOUD_DO');
  assert.equal(plan.decision.archetype, 'sage');
});

test('EvoEngineV3: evaluation, mutation and failure rollback', async () => {
  const evo = new EvoEngineV3(null, {});
  await evo.init();

  const evalRes = await evo.evaluateCycle({
    cycleId: 'cycle_test_1',
    input: { task: 'Test' },
    qcePlan: { confidence: 0.95 },
    executionResult: { success: true },
    latencyMs: 120,
    currentGenome: evo.genome
  });

  assert.ok(evalRes.fitnessScoreDelta > 0);
  assert.ok(evalRes.newFitness >= 100);

  const failRes = await evo.recordFailure({ cycleId: 'cycle_err', error: 'Simulovaná chyba' });
  assert.equal(failRes.autoRollbackEngaged, true);
});

test('SkillForge: dynamic forging and execution', async () => {
  const forge = new SkillForge(null, {});
  await forge.init();

  const skill = await forge.forgeSkillFromQCE(
    { name: 'skill_test_echo', task: 'Echo textu', archetype: 'creator' },
    { cycleId: 'cycle_1', genome: { generation: 1 } }
  );

  assert.equal(skill.name, 'skill_test_echo');
  const exec = await forge.execute('skill_test_echo', { paramA: 42 });
  assert.equal(exec.success, true);
  assert.ok(exec.result.synthesizedResponse.includes('42'));
});

test('HybridBrain: cloud vs local bridge routing', async () => {
  const hybrid = new HybridBrain({ PC_BRIDGE_SERVICE: { fetch: async () => Response.json({ ok: true }) } });
  await hybrid.init();

  const routeCloud = await hybrid.routeDecision({
    metaContext: { semanticIntent: 'QUERY' }
  });
  assert.equal(routeCloud, 'CLOUD_DO');

  const routeBridge = await hybrid.routeDecision({
    metaContext: { semanticIntent: 'ACTION' }
  });
  assert.equal(routeBridge, 'PC_BRIDGE');
});

test('TrinityBrainV4: full cognitive cycle (Phases 1 - 7)', async () => {
  const brain = new TrinityBrainV4({}, { TRINITY_GATEWAY_KEY: 'test-key-123' });
  await brain.ensureInitialized();

  // 1. Spracovanie úlohy
  const result = await brain.processTask(
    { query: 'Vytvor a otestuj nový modul pre Trinity 10.4', intent: 'CREATE_MODULE' },
    { requiresLocalExecution: false }
  );

  assert.equal(result.success, true);
  assert.ok(result.cycleId.startsWith('cycle_'));
  assert.equal(result.executionTarget, 'CLOUD_DO');
  assert.ok(result.evolution.fitness >= 100);
  assert.ok(result.telemetry.latencyMs >= 0);

  // 2. Overenie STM, LTM a ETM
  assert.ok(brain.stm.length > 0);
  assert.ok(brain.etm.length > 0);

  // 3. HTTP rozhranie
  const req = new Request('https://do.trinity.internal/api/v4/state', {
    headers: { 'Authorization': 'Bearer test-key-123' }
  });
  const res = await brain.fetch(req);
  assert.equal(res.status, 200);
  const state = await res.json();
  assert.equal(state.genome.version, '10.4.0-EVO');
});
