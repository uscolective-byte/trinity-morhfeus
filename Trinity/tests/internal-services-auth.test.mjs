import { test } from 'node:test';
import assert from 'node:assert/strict';
import skillsWorker from '../services/skills.js';
import guardianWorker from '../services/guardian.js';

test('Skills Service: Rejects unapproved mutating actions with 401', async () => {
  const req = new Request('https://trinity-skills.saboivan2008.workers.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'skill.register',
      data: { name: 'Malicious' }
    })
  });

  const res = await skillsWorker.fetch(req, {});
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.status, 'unauthorized');
});

test('Skills Service: Accepts internal binding or approved actions', async () => {
  const req = new Request('https://trinity.internal/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'skill.list'
    })
  });

  const res = await skillsWorker.fetch(req, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
});

test('Skills Service: Returns unsupported for unimplemented actions', async () => {
  const req = new Request('https://trinity.internal/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'nonexistent.action'
    })
  });

  const res = await skillsWorker.fetch(req, {});
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.status, 'unsupported');
});

test('Guardian Service: Protects /api/logs and /api/check against unauthenticated external access', async () => {
  const req = new Request('https://trinity-guardian.saboivan2008.workers.dev/api/logs');
  const res = await guardianWorker.fetch(req, {});
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.ok, false);
});

test('Guardian Service: Allows internal binding access to /api/logs', async () => {
  const req = new Request('https://trinity.internal/api/logs');
  const res = await guardianWorker.fetch(req, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
});
