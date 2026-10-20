import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QCA,
  compressContext,
  runParallelThoughts,
  mergeThoughts,
  selfReflect,
  selfCorrect
} from '../src/qca.js';
import { QuantumCoreEngine } from '../src/quantum_core.js';
import { skillRegistry } from '../src/skillRegistry.js';
import { runTool } from '../src/tools.js';
import { AGENTS } from '../src/registry.js';
import { READ_TOOLS } from '../src/truth.js';

test('QCA: Základné spustenie Quantum Cognitive Accelerator', async () => {
  const result = await QCA('Optimalizuj kvantovú rezonanciu systému', {
    raw: 'Systémový kontext Trinity a Aura Meta-Layer.',
    entities: ['Trinity', 'Aura', 'Quantum Core']
  });

  assert.equal(result.success, true);
  assert.equal(result.query, 'Optimalizuj kvantovú rezonanciu systému');
  assert.ok(result.output);
  assert.equal(result.output.status, 'Optimized & Corrected');
  assert.equal(result.output.resonanceField, 'Active');
  assert.ok(result.output.content.includes('Syntéza cez 5 paralelných dráh'));
  assert.ok(result.output.content.includes('Primárny rezonátor: [metaphysical]'));

  assert.ok(typeof result.metrics.durationMs === 'number');
  assert.equal(result.metrics.pathsEvaluated, 5);
  assert.equal(result.metrics.resonanceLevel, 0.98);
});

test('QCA: Submoduly (kompresia, paralelné myšlienky, syntéza, reflexia, korekcia)', async () => {
  // 1. compressContext
  const ctx = await compressContext({ raw: 'A'.repeat(1500), entities: ['Aura'] });
  assert.equal(ctx.trimmedText.length, 1000);
  assert.deepEqual(ctx.entities, ['Aura']);
  assert.equal(ctx.weight, 1.25);

  const defCtx = await compressContext();
  assert.equal(defCtx.trimmedText, 'Default context');
  assert.ok(defCtx.entities.includes('Trinity'));

  // 2. runParallelThoughts
  const thoughts = await runParallelThoughts('Test dotaz', defCtx);
  assert.equal(thoughts.length, 5);
  const paths = thoughts.map(t => t.path);
  assert.deepEqual(paths, ['logical', 'intuitive', 'statistical', 'predictive', 'metaphysical']);

  // 3. mergeThoughts
  const merged = mergeThoughts(thoughts);
  assert.equal(merged.confidence, 1.0);
  assert.ok(merged.synthesizedContent.includes('Primárny rezonátor: [metaphysical]'));

  const emptyMerge = mergeThoughts([]);
  assert.equal(emptyMerge.confidence, 0);

  // 4. selfReflect
  const reflected = selfReflect(merged, 'Test dotaz');
  assert.equal(reflected.passedAudit, true);
  assert.equal(reflected.reflectionNotes, 'Logická konzistencia stabilná.');

  // 5. selfCorrect
  const corrected = selfCorrect(reflected);
  assert.equal(corrected.status, 'Optimized & Corrected');
  assert.equal(corrected.resonanceField, 'Active');

  const failedCorrect = selfCorrect({ passedAudit: false });
  assert.equal(failedCorrect, 'Korigovaný výstup po internom reštarte logiky.');
});

test('QCA: Prepojenie s QuantumCoreEngine.accelerate', async () => {
  const result = await QuantumCoreEngine.accelerate('Rozšírenie multi-agentnej inteligencie');
  assert.equal(result.success, true);
  assert.equal(result.metrics.pathsEvaluated, 5);
  assert.equal(result.output.status, 'Optimized & Corrected');
});

test('QCA: Prepojenie so SkillRegistry (quantumQca)', async () => {
  const qcaSkill = skillRegistry.get('quantumQca');
  assert.ok(qcaSkill, 'Skill quantumQca musí existovať');

  const result = await qcaSkill({ query: 'Analýza teleologického cieľa' });
  assert.equal(result.success, true);
  assert.equal(result.metrics.pathsEvaluated, 5);

  const allSkills = skillRegistry.list();
  const found = allSkills.find(s => s.name === 'quantumQca');
  assert.ok(found, 'quantumQca musí byť v zozname skillRegistry');
  assert.equal(found.category, 'quantum');
});

test('QCA: Integrácia do nástrojov Trinity runTool a Truth Policy', async () => {
  assert.ok(READ_TOOLS.has('quantum_accelerate'), 'quantum_accelerate musí byť v READ_TOOLS pre Truth Policy');

  const orchestrator = AGENTS.find(a => a.id === 'orchestrator');
  assert.ok(orchestrator.tools.includes('quantum_accelerate'), 'orchestrator musí mať quantum_accelerate nástroj');

  const env = {
    DB: {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() {
            if (sql.includes('ops_plugins')) return { installed: 1, enabled: 1 };
            return null;
          }
        };
      }
    }
  };
  const res = await runTool(env, orchestrator, 'quantum_accelerate', {
    query: 'Akceleruj kognitívnu syntézu'
  });

  assert.equal(res.success, true);
  assert.equal(res.output.status, 'Optimized & Corrected');
  assert.ok(res._evidence);
  assert.equal(res._evidence.effect, 'read');
  assert.ok(res._evidence.receipt_id.startsWith('qca:'));
});
