import { test } from 'node:test';
import assert from 'node:assert/strict';
import skillsWorker from '../services/skills.js';
import guardianWorker from '../services/guardian.js';

const MOCK_SECRET = 'test-trinity-secret-token-32bytes!';
const MOCK_ENV = {
  TRINITY_INTERNAL_KEY: MOCK_SECRET
};

test('Skills Service: Rejects unapproved mutating actions with 401', async () => {
  const req = new Request('https://trinity-skills.saboivan2008.workers.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'skill.register', data: { name: 'UnauthorizedSkill' } })
  });
  const res = await skillsWorker.fetch(req, MOCK_ENV);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.ok, false);
});

test('Skills Service: Rejects invalid Authorization Bearer token with 401', async () => {
  const req = new Request('https://trinity-skills.saboivan2008.workers.dev/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid-review-value'
    },
    body: JSON.stringify({ action: 'skill.register', data: { name: 'InvalidTokenSkill' } })
  });
  const res = await skillsWorker.fetch(req, MOCK_ENV);
  assert.equal(res.status, 401);
});

test('Skills Service: Rejects client-asserted approval without secret with 401', async () => {
  const req = new Request('https://trinity-skills.saboivan2008.workers.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'skill.register',
      data: { name: 'SelfApprovedSkill' },
      approval: { approved: true, verified_by: 'orchestrator' }
    })
  });
  const res = await skillsWorker.fetch(req, MOCK_ENV);
  assert.equal(res.status, 401);
});

test('Skills Service: Accepts valid server secret with 200', async () => {
  const mockDbEnv = {
    ...MOCK_ENV,
    DB: {
      prepare: () => ({
        bind: () => ({
          run: async () => ({ success: true })
        })
      })
    }
  };
  const req = new Request('https://trinity-skills.saboivan2008.workers.dev/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MOCK_SECRET}`
    },
    body: JSON.stringify({ action: 'skill.register', data: { name: 'AuthorizedSkill' } })
  });
  const res = await skillsWorker.fetch(req, mockDbEnv);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.result.name, 'AuthorizedSkill');
});

test('Skills Service: Executes real echo handler and returns structured output', async () => {
  const mockDbEnv = {
    ...MOCK_ENV,
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ id: 'skill-echo', name: 'EchoSkill', type: 'tool', handler: 'echo', enabled: 1 })
        })
      })
    }
  };
  const req = new Request('https://trinity-skills.saboivan2008.workers.dev/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MOCK_SECRET}`
    },
    body: JSON.stringify({ action: 'skill.execute', data: { skill_id: 'skill-echo', input: 'Hello Trinity' } })
  });
  const res = await skillsWorker.fetch(req, mockDbEnv);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.result.status, 'completed');
  assert.equal(data.result.output, 'Hello Trinity');
});

test('Skills Service: Returns 501 unsupported for unrecognized non-AI handler', async () => {
  const mockDbEnv = {
    ...MOCK_ENV,
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ id: 'skill-custom', name: 'CustomSkill', type: 'tool', handler: 'some_unknown_fn', enabled: 1 })
        })
      })
    }
  };
  const req = new Request('https://trinity-skills.saboivan2008.workers.dev/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MOCK_SECRET}`
    },
    body: JSON.stringify({ action: 'skill.execute', data: { skill_id: 'skill-custom' } })
  });
  const res = await skillsWorker.fetch(req, mockDbEnv);
  assert.equal(res.status, 501);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.status, 'unsupported');
});

test('Guardian Service: Protects /api/logs against invalid secret and accepts valid secret', async () => {
  // 1. Without secret -> 401
  const unauthReq = new Request('https://trinity-guardian.saboivan2008.workers.dev/api/logs');
  const unauthRes = await guardianWorker.fetch(unauthReq, MOCK_ENV);
  assert.equal(unauthRes.status, 401);

  // 2. With invalid secret -> 401
  const invalidReq = new Request('https://trinity-guardian.saboivan2008.workers.dev/api/logs', {
    headers: { 'Authorization': 'Bearer bad-secret' }
  });
  const invalidRes = await guardianWorker.fetch(invalidReq, MOCK_ENV);
  assert.equal(invalidRes.status, 401);

  // 3. With valid secret -> 200
  const authReq = new Request('https://trinity-guardian.saboivan2008.workers.dev/api/logs', {
    headers: { 'Authorization': `Bearer ${MOCK_SECRET}` }
  });
  const authRes = await guardianWorker.fetch(authReq, MOCK_ENV);
  assert.equal(authRes.status, 200);
});
