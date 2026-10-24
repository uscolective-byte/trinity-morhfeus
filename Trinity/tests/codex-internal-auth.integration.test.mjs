import { test } from 'node:test';
import assert from 'node:assert/strict';
import skills from '../services/skills.js';
import guardian from '../services/guardian.js';
import { delegateWorker } from '../src/orchestrator.js';

// These fixtures are synthetic credentials and storage; no real bindings or secrets.
const TEST_KEY = 'codex-fixture-not-a-real-secret';
const secretEnv = { TRINITY_INTERNAL_KEY: TEST_KEY };
function request(action, data = {}, headers = {}, extra = {}, host = 'external.example') {
  return new Request(`https://${host}/`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ action, data, ...extra })
  });
}
function binding(worker, env) {
  return { async fetch(url, init) { return worker.fetch(new Request(url, init), env); } };
}
function dbForSkill(skill) {
  return { prepare() { return { bind() { return this; }, async first() { return skill; } }; } };
}
const echoSkill = { id: 'fixture', name: 'Echo', type: 'tool', handler: 'echo', enabled: 1 };

test('real delegateWorker -> Skills executes echo with matching server credential', async () => {
  const target = { ...secretEnv, DB: dbForSkill(echoSkill) };
  const result = await delegateWorker({ ...secretEnv, SKILLS: binding(skills, target) }, 'SKILLS', 'skill.execute', { skill_id: 'fixture', input: 'real echo result' });
  assert.equal(result.ok, true);
  assert.equal(result.result.status, 'completed');
  assert.equal(result.result.output, 'real echo result');
  assert.equal(JSON.stringify(result).includes(TEST_KEY), false);
});

test('real delegateWorker -> Skills fails closed when caller credential is absent', async () => {
  const target = { ...secretEnv, DB: dbForSkill(echoSkill) };
  const result = await delegateWorker({ SKILLS: binding(skills, target) }, 'SKILLS', 'skill.execute', { skill_id: 'fixture' });
  assert.equal(result.ok, false); assert.equal(result.status, 401);
});

test('real delegateWorker -> Guardian authenticates audit reads', async () => {
  const result = await delegateWorker({ ...secretEnv, GUARDIAN: binding(guardian, secretEnv) }, 'GUARDIAN', 'audit.list');
  assert.equal(result.ok, true); assert.deepEqual(result.result, []);
  const rejected = await delegateWorker({ GUARDIAN: binding(guardian, secretEnv) }, 'GUARDIAN', 'audit.list');
  assert.equal(rejected.ok, false); assert.equal(rejected.status, 401);
});

test('hostname, static mesh header and claimed approval cannot authorize either worker', async () => {
  for (const host of ['external.example', 'trinity.internal', 'localhost', '127.0.0.1']) {
    for (const [worker, action] of [[skills, 'skill.register'], [guardian, 'audit.list']]) {
      const response = await worker.fetch(request(action, {}, { 'X-Trinity-Internal-Auth': 'trinity-orchestrator-core' }, { approval: { approved: true, verified_by: 'orchestrator', actor_role: 'owner' } }, host), secretEnv);
      assert.equal(response.status, 401, `${host}: ${action}`);
    }
  }
});

test('target without configured secret fails closed even with an Authorization value', async () => {
  const response = await skills.fetch(request('skill.register', {}, { Authorization: `Bearer ${TEST_KEY}` }), {});
  assert.equal(response.status, 401);
});

test('provider failure remains failed through the real delegateWorker boundary', async () => {
  const target = { ...secretEnv, DB: dbForSkill({ ...echoSkill, type: 'ai', config: '{}' }), AI: { async run() { throw new Error('fixture provider outage'); } } };
  const result = await delegateWorker({ ...secretEnv, SKILLS: binding(skills, target) }, 'SKILLS', 'skill.execute', { skill_id: 'fixture' });
  assert.equal(result.ok, false); assert.equal(result.status, 502);
  assert.equal(result.result.status, 'failed');
});

test('authenticated registration cannot claim success without storage', async () => {
  const response = await skills.fetch(request('skill.register', { name: 'fixture' }, { Authorization: `Bearer ${TEST_KEY}` }), secretEnv);
  assert.equal(response.status, 503); assert.equal((await response.json()).ok, false);
});

test('successful registration writes through the database and propagates write errors', async () => {
  let writes = 0;
  const target = { ...secretEnv, DB: { prepare() { return { bind() { return this; }, async run() { writes++; return { success: true, meta: { changes: 1 } }; } }; } } };
  const success = await skills.fetch(request('skill.register', { name: 'fixture' }, { Authorization: `Bearer ${TEST_KEY}` }), target);
  assert.equal(success.status, 200); assert.equal((await success.json()).ok, true); assert.equal(writes, 1);
  target.DB.prepare = () => ({ bind() { return this; }, async run() { throw new Error('fixture write failure'); } });
  const failed = await skills.fetch(request('skill.register', { name: 'fixture' }, { Authorization: `Bearer ${TEST_KEY}` }), target);
  assert.equal(failed.status, 500); assert.equal((await failed.json()).ok, false);
});
