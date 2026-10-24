import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORKER_CATALOG, delegateWorker, orchestratePipeline, inspectFleet } from '../src/orchestrator.js';
import { runTool } from '../src/tools.js';
import { AGENTS } from '../src/registry.js';
import { skillRegistry } from '../src/skillRegistry.js';

test('Worker Catalog contains all 23 specialized workers', () => {
  const keys = Object.keys(WORKER_CATALOG);
  assert.ok(keys.length >= 23, `Expected at least 23 workers, got ${keys.length}`);

  // 10 Aura workers
  const auraWorkers = [
    'AURA_ANALYZER', 'AURA_ARCHITECT', 'AURA_CODEGEN', 'AURA_DEPLOYER', 'AURA_EVOLVER',
    'AURA_MEMORY', 'AURA_OPTIMIZER', 'AURA_PLANNER', 'AURA_SENTINEL', 'AURA_TESTER'
  ];
  for (const w of auraWorkers) {
    assert.ok(WORKER_CATALOG[w], `Missing Aura worker: ${w}`);
  }

  // 8 Core workers
  const coreWorkers = ['CORE', 'BUILDER', 'DISPATCHER', 'CONNECTORS', 'GUARDIAN', 'MEMORY', 'SENTINEL', 'SKILLS'];
  for (const w of coreWorkers) {
    assert.ok(WORKER_CATALOG[w], `Missing Core worker: ${w}`);
  }

  // 5 Specialized workers
  const specializedWorkers = ['KNOWLEDGE_SERVICE', 'CAPACITY_SERVICE', 'INTEGRATIONS_SERVICE', 'PC_BRIDGE_SERVICE', 'AUDIT_SERVICE'];
  for (const w of specializedWorkers) {
    assert.ok(WORKER_CATALOG[w], `Missing Specialized worker: ${w}`);
  }
});

test('delegateWorker handles action-based workers with trace propagation', async () => {
  let receivedCall = null;
  const mockBinding = {
    async fetch(url, init) {
      receivedCall = JSON.parse(init.body);
      return Response.json({ ok: true, result: { analyzed: true, score: 95 } });
    }
  };

  const env = { AURA_ANALYZER: mockBinding };
  const res = await delegateWorker(env, 'AURA_ANALYZER', 'analyze.code', { code: 'const a = 1;' });

  assert.equal(res.ok, true);
  assert.equal(res.worker, 'AURA_ANALYZER');
  assert.equal(res.result.analyzed, true);
  assert.equal(receivedCall.action, 'analyze.code');
  assert.equal(receivedCall.data.code, 'const a = 1;');
  assert.ok(receivedCall.traceId);
});

test('delegateWorker handles RPC-based workers (Knowledge)', async () => {
  const env = {
    KNOWLEDGE_SERVICE: {
      async search(query) {
        return [{ title: 'Doc 1', score: 0.98, query }];
      }
    }
  };

  const res = await delegateWorker(env, 'KNOWLEDGE_SERVICE', 'search', { query: 'cloudflare workers' });
  assert.equal(res.ok, true);
  assert.equal(res.result[0].title, 'Doc 1');
});

test('delegateWorker handles REST-based workers (Memory)', async () => {
  const env = {
    MEMORY: {
      async fetch(url, init) {
        return Response.json([{ id: 1, key: 'test_key', value: 'hello' }]);
      }
    }
  };

  const res = await delegateWorker(env, 'MEMORY', 'memory');
  assert.equal(res.ok, true);
  assert.equal(res.result[0].key, 'test_key');
});

test('delegateWorker reports unconfigured bindings gracefully', async () => {
  const env = {};
  const res = await delegateWorker(env, 'AURA_CODEGEN', 'codegen.generate', { prompt: 'foo' });
  assert.equal(res.ok, false);
  assert.equal(res.status, 'not_configured');
});

test('orchestratePipeline executes multi-specialist workflow', async () => {
  const env = {
    AURA_PLANNER: {
      async fetch() {
        return Response.json({ ok: true, result: { plan: ['analyze', 'code', 'test'] } });
      }
    },
    AURA_CODEGEN: {
      async fetch() {
        return Response.json({ ok: true, result: { code: 'export const hello = () => "world";' } });
      }
    },
    AURA_TESTER: {
      async fetch() {
        return Response.json({ ok: true, result: { tests_passed: true } });
      }
    },
    AURA_SENTINEL: {
      async fetch() {
        return Response.json({ ok: true, result: { status: 'secure' } });
      }
    }
  };

  const res = await orchestratePipeline(env, 'Napíš a otestuj kód pre spracovanie objednávok');
  assert.equal(res.ok, true);
  assert.ok(res.total_phases >= 3);
  assert.ok(res.successful_phases >= 3);
  assert.ok(res.executionLog.some(l => l.worker === 'AURA_PLANNER'));
  assert.ok(res.executionLog.some(l => l.worker === 'AURA_CODEGEN'));
  assert.ok(res.executionLog.some(l => l.worker === 'AURA_TESTER'));
});

test('inspectFleet reports connectivity for entire 23-worker fleet', async () => {
  const env = {
    AURA_ANALYZER: { async fetch() { return Response.json({ ok: true }); } },
    CORE: { async fetch() { return Response.json({ ok: true }); } },
    KNOWLEDGE_SERVICE: { async getStatus() { return { ready: true }; } }
  };

  const fleet = await inspectFleet(env);
  assert.equal(fleet.total_workers, Object.keys(WORKER_CATALOG).length);
  assert.ok(fleet.online_count >= 2);
  assert.ok(fleet.offline_count <= 21);
});

test('runTool supports delegate_worker, orchestrate_team, and fleet_status', async () => {
  const env = {
    AURA_ANALYZER: { async fetch() { return Response.json({ ok: true, result: { score: 100 } }); } },
    AURA_PLANNER: { async fetch() { return Response.json({ ok: true, result: { plan: [] } }); } }
  };
  const orchestrator = AGENTS.find(a => a.id === 'orchestrator');

  const delegateRes = await runTool(env, orchestrator, 'delegate_worker', {
    worker: 'AURA_ANALYZER',
    action: 'analyze.code',
    data: { code: 'test' }
  });
  assert.equal(delegateRes.ok, true);
  assert.equal(delegateRes._evidence.action, 'delegate_worker');

  const teamRes = await runTool(env, orchestrator, 'orchestrate_team', {
    task: 'Priprav plán auditu'
  });
  assert.equal(teamRes.ok, true);
  assert.equal(teamRes._evidence.action, 'orchestrate_team');

  const fleetRes = await runTool(env, orchestrator, 'fleet_status', {});
  assert.equal(fleetRes.total_workers, Object.keys(WORKER_CATALOG).length);
  assert.equal(fleetRes._evidence.effect, 'read');
});

test('SkillRegistry exposes and executes orchestration skills', async () => {
  assert.ok(skillRegistry.has('callWorkerAction'));
  assert.ok(skillRegistry.has('orchestrateTeamTask'));
  assert.ok(skillRegistry.has('fleetHealthCheck'));

  const env = {
    CORE: { async fetch() { return Response.json({ ok: true, result: { thought: 'Reasoning...' } }); } }
  };

  const res = await skillRegistry.execute('callWorkerAction', { worker: 'CORE', action: 'core.reason', data: { prompt: 'think' } }, env);
  assert.equal(res.ok, true);
});

test('orchestratePipeline reports partial or failed when a required phase fails', async () => {
  const env = {
    AURA_PLANNER: {
      async fetch() {
        return Response.json({ ok: true, result: { plan: ['analyze', 'code'] } });
      }
    },
    AURA_CODEGEN: {
      async fetch() {
        return Response.json({ ok: false, error: 'Codegen failure' }, { status: 500 });
      }
    }
  };

  const res = await orchestratePipeline(env, 'Napíš kód pre platobnú bránu');
  assert.equal(res.ok, false);
  assert.equal(res.status, 'partial');
  assert.ok(res.failed_phases >= 1);
});

test('delegateWorker preserves caller context and does not fabricate owner approval when null', async () => {
  let capturedBody = null;
  const env = {
    AURA_ANALYZER: {
      async fetch(url, init) {
        capturedBody = JSON.parse(init.body);
        return Response.json({ ok: true });
      }
    }
  };

  await delegateWorker(env, 'AURA_ANALYZER', 'analyze.code', { code: 'test' });
  assert.equal(capturedBody.approval, null);

  await delegateWorker(env, 'AURA_ANALYZER', 'analyze.code', { code: 'test' }, {
    actor: { id: 'usr-123', role: 'developer' }
  });
  assert.equal(capturedBody.approval.actor_role, 'developer');
  assert.equal(capturedBody.approval.actor_id, 'usr-123');
  assert.equal(capturedBody.approval.approved, true);
});
