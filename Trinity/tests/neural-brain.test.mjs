import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NeuralBrain, NeuralMemorySystem, NeuralBrainAgent, BRAIN_MODES } from '../src/neural_brain.js';
import { QuantumCoreEngine } from '../src/quantum_core.js';
import { skillRegistry } from '../src/skillRegistry.js';
import { runTool } from '../src/tools.js';

test('NeuralMemorySystem: STM, LTM, CTM, ETM layers operate correctly', async () => {
  const memory = new NeuralMemorySystem();
  await memory.initialize();

  // STM
  memory.pushSTM({ note: 'Prvá krátkodobá myšlienka' });
  memory.pushSTM({ note: 'Druhá krátkodobá myšlienka' });
  const stm = memory.getSTM(5);
  assert.equal(stm.length, 2);
  assert.equal(stm[0].note, 'Druhá krátkodobá myšlienka');

  // LTM
  await memory.setLTM('rule:truth', 'Dôkazy sú povinné', 1.0);
  const ltmItem = memory.getLTM('rule:truth');
  assert.ok(ltmItem);
  assert.equal(ltmItem.value, 'Dôkazy sú povinné');

  // CTM
  memory.setContext('active_project', { name: 'Trinity 11.0', phase: 'neural_integration' });
  const ctm = memory.getContext('active_project');
  assert.equal(ctm.data.name, 'Trinity 11.0');

  // ETM
  const ep = await memory.recordEpisode('Otestovať neurálnu pamäť', 'Úspešné overenie', { passed: true }, 0.98);
  assert.ok(ep.id.startsWith('ep_'));
  assert.equal(ep.coherence, 0.98);

  // Snapshot
  const snap = memory.getMemorySnapshot();
  assert.equal(snap.stm_count, 2);
  assert.equal(snap.ltm_count, 1);
  assert.ok(snap.ctm_topics.includes('active_project'));
  assert.equal(snap.etm_count, 1);
});

test('NeuralBrain: Default creativity mode, dynamic switching and self-reflection cycle', async () => {
  const brain = new NeuralBrain();
  await brain.init();

  // Východiskový režim podľa voľby používateľa
  assert.equal(brain.getMode(), BRAIN_MODES.CREATIVITY);
  assert.ok(brain.getModeDirective().includes('REŽIM KREATIVITY'));

  // Prepnutie do iných režimov
  brain.setMode(BRAIN_MODES.REASONING);
  assert.equal(brain.getMode(), 'reasoning');

  brain.setMode(BRAIN_MODES.TRUTH);
  assert.equal(brain.getMode(), 'truth');

  assert.throws(() => brain.setMode('invalid_mode'), /Neplatný režim mozgu/);

  // Návrat do creativity
  brain.setMode(BRAIN_MODES.CREATIVITY);

  // Self-reflection cyklus
  const reflection = await brain.reflectOnExecution({
    task: 'Generovanie inovatívnej funkcie pre Trinity',
    outcome: 'Úspešne vytvorené a overené bez chýb.'
  });

  assert.ok(reflection.evaluation.well_done);
  assert.ok(reflection.evaluation.future_improvements);
  assert.equal(reflection.mode, BRAIN_MODES.CREATIVITY);

  const episodes = brain.memory.getEpisodes(5);
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].task, 'Generovanie inovatívnej funkcie pre Trinity');
});

test('TrinityAgent DO: REST handlers for /mode, /memory, /reflect', async () => {
  const agent = new NeuralBrainAgent({}, {});

  // 1. GET /
  const infoReq = new Request('https://do.trinity.internal/');
  const infoRes = await agent.fetch(infoReq);
  const info = await infoRes.json();
  assert.equal(info.service, 'Trinity Neural Brain DO');
  assert.equal(info.version, '11.0.0');
  assert.equal(info.mode, 'creativity');

  // 2. POST /mode
  const setModeReq = new Request('https://do.trinity.internal/mode', {
    method: 'POST',
    body: JSON.stringify({ mode: 'autonomous' }),
    headers: { 'content-type': 'application/json' }
  });
  const setModeRes = await agent.fetch(setModeReq);
  const modeData = await setModeRes.json();
  assert.equal(modeData.currentMode, 'autonomous');

  // 3. GET /memory
  const memReq = new Request('https://do.trinity.internal/memory');
  const memRes = await agent.fetch(memReq);
  const memSnap = await memRes.json();
  assert.ok(typeof memSnap.stm_count === 'number');

  // 4. POST /reflect
  const reflectReq = new Request('https://do.trinity.internal/reflect', {
    method: 'POST',
    body: JSON.stringify({ task: 'Durable Object Test', outcome: 'Všetko funguje' }),
    headers: { 'content-type': 'application/json' }
  });
  const reflectRes = await agent.fetch(reflectReq);
  const refData = await reflectRes.json();
  assert.ok(refData.evaluation);
});

test('QuantumCoreEngine: parallelReasoning, fuseAgentOutputs, and errorCorrectionLayer', () => {
  // 1. Parallel reasoning (3-7 vetiev)
  const branches = [
    { id: 'b1', hypothesis: 'Konzervatívne riešenie cez štandardný SQL dotaz', amplitude: 0.7, tags: ['sql'] },
    { id: 'b2', hypothesis: 'Kreatívna fúzia vektorov, pamäte a generovania kódu', amplitude: 0.85, tags: ['creative', 'innovative'] },
    { id: 'b3', hypothesis: 'Analytický rozpad do mikroslužieb', amplitude: 0.75, tags: ['analytical'] }
  ];

  const parallelRes = QuantumCoreEngine.parallelReasoning(branches, { preference: 'creative' });
  assert.equal(parallelRes.branchesEvaluated, 3);
  assert.equal(parallelRes.selectedBranch.id, 'b2');
  assert.ok(parallelRes.selectedBranch.calculatedScore > 0.85);

  // 2. Multi-agent fusion (Guardian, Sentinel, Planner, Optimizer, Analyzer)
  const agentOutputs = {
    guardian: { content: 'Bezpečnostný rámec dodržaný.', confidence: 0.95 },
    sentinel: { content: 'Systémové metriky stabilné.', confidence: 0.90 },
    planner: { content: 'Plán pozostáva z 3 overiteľných krokov.', confidence: 0.85 },
    optimizer: { content: 'Latencia minimalizovaná na sub-100ms.', confidence: 0.92 }
  };

  const fusion = QuantumCoreEngine.fuseAgentOutputs(agentOutputs);
  assert.equal(fusion.contributingRoles.length, 4);
  assert.ok(fusion.consensusScore > 0);
  assert.ok(fusion.fusedContent.includes('GUARDIAN'));
  assert.ok(fusion.fusedContent.includes('OPTIMIZER'));

  // 3. Error-correction layer
  const draft = 'Trinity vygenerovala funkciu s chybou: eval(input) a starým modulom v1.';
  const corrections = [
    { pattern: /eval\([^)]+\)/g, fix: 'safeParse(input)', reason: 'Odstránenie nebezpečného eval' },
    { pattern: 'modulom v1', fix: 'modulom v2', reason: 'Aktualizácia verzie' }
  ];

  const ec = QuantumCoreEngine.errorCorrectionLayer(draft, corrections);
  assert.equal(ec.fixesAppliedCount, 2);
  assert.ok(ec.correctedOutput.includes('safeParse(input)'));
  assert.ok(ec.correctedOutput.includes('modulom v2'));
  assert.equal(ec.clean, false);
});

test('Skills and runTool integration for neural brain and quantum operations', async () => {
  // SkillRegistry
  assert.ok(skillRegistry.has('brainSetMode'));
  assert.ok(skillRegistry.has('brainReflect'));
  assert.ok(skillRegistry.has('brainMemoryQuery'));
  assert.ok(skillRegistry.has('quantumParallelReason'));
  assert.ok(skillRegistry.has('quantumMultiAgentFusion'));
  assert.ok(skillRegistry.has('quantumErrorCorrection'));

  const skillModeRes = await skillRegistry.execute('brainSetMode', { mode: 'creativity' });
  assert.equal(skillModeRes.currentMode, 'creativity');

  // runTool mockEnv
  const mockEnv = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ installed: 1, enabled: 1 }),
          all: async () => ({ results: [] })
        }),
        first: async () => ({ installed: 1, enabled: 1 }),
        all: async () => ({ results: [] })
      })
    }
  };

  // 1. brain_mode tool
  const modeToolRes = await runTool(
    mockEnv,
    { tools: ['brain_mode'] },
    'brain_mode',
    { mode: 'creativity' }
  );
  assert.equal(modeToolRes.currentMode, 'creativity');
  assert.ok(modeToolRes.directive.includes('KREATIVITY'));

  // 2. brain_reflect tool
  const reflectToolRes = await runTool(
    mockEnv,
    { tools: ['brain_reflect'] },
    'brain_reflect',
    { task: 'Kreatívna tvorba novej schopnosti', outcome: 'Hotovo úspešne' }
  );
  assert.ok(reflectToolRes.reflection);

  // 3. quantum_parallel tool
  const parallelToolRes = await runTool(
    mockEnv,
    { tools: ['quantum_parallel'] },
    'quantum_parallel',
    {
      branches: [
        { id: 'hypo1', hypothesis: 'Možnosť 1', amplitude: 0.6 },
        { id: 'hypo2', hypothesis: 'Inovatívna možnosť 2', amplitude: 0.9, tags: ['creative'] }
      ],
      preference: 'creative'
    }
  );
  assert.equal(parallelToolRes.selectedBranch.id, 'hypo2');

  // 4. quantum_fusion tool
  const fusionToolRes = await runTool(
    mockEnv,
    { tools: ['quantum_fusion'] },
    'quantum_fusion',
    {
      agent_outputs: {
        planner: { content: 'Architektúra pripravená.', confidence: 0.9 },
        guardian: { content: 'Overené a bezpečné.', confidence: 0.95 }
      }
    }
  );
  assert.ok(fusionToolRes.consensusScore > 0);
  assert.equal(fusionToolRes.contributingRoles.length, 2);
});
