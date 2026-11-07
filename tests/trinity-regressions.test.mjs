import test from 'node:test';
import assert from 'node:assert/strict';
import { sliceContextSafely } from '../trinity-chat-inference/src/index.ts';
import profileWorker from '../trinity-profile/src/index.ts';

const encodeBase64Url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
  .toString('base64url');

async function makeAccessToken(privateKey, claims, kid = 'test-key') {
  const header = encodeBase64Url({ alg: 'RS256', typ: 'JWT', kid });
  const payload = encodeBase64Url(claims);
  const input = `${header}.${payload}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(input));
  return `${input}.${Buffer.from(signature).toString('base64url')}`;
}

test('context trimming keeps the first system prompt and newest conversation messages', () => {
  const system = { role: 'system', content: 'Keep this exact instruction.' };
  const messages = [system, ...Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `message-${i}` }))];
  const result = sliceContextSafely(messages, 120, 8);
  assert.equal(result[0], system);
  assert.ok(result.some(message => message.content === 'message-11'));
  assert.ok(result.length <= 8);
});

test('context trimming preserves the system prompt even when it exceeds the budget', () => {
  const system = { role: 'system', content: 'S'.repeat(200) };
  const result = sliceContextSafely([system, { role: 'user', content: 'recent' }], 100, 8);
  assert.equal(result[0], system);
  assert.equal(result.length, 1);
});

test('profile admin elevation rejects unverified bearer and Access client ID headers', async () => {
  const request = new Request('https://profile.test/api/profile/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer trn_live_attacker', 'CF-Access-Client-Id': 'spoofed-client' },
    body: JSON.stringify({ email: 'attacker@example.com', displayName: 'Attacker', role: 'admin' })
  });
  const response = await profileWorker.fetch(request, { TOKEN_SALT: 'not-an-admin-secret' }, { waitUntil() {} });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).profile.role, 'user');
});

test('profile admin elevation accepts only a valid Access JWT for an allowlisted admin', async (t) => {
  const { publicKey, privateKey } = await crypto.subtle.generateKey({
    name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'
  }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  jwk.kid = 'access-key-1';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ keys: [jwk] });
  t.after(() => { globalThis.fetch = originalFetch; });

  const now = Math.floor(Date.now() / 1000);
  const token = await makeAccessToken(privateKey, {
    iss: 'https://trinity-team.cloudflareaccess.com', aud: ['expected-app-aud'], exp: now + 300, nbf: now - 1,
    email: 'admin@example.com'
  }, 'access-key-1');
  const request = new Request('https://profile.test/api/profile/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Access-Jwt-Assertion': token },
    body: JSON.stringify({ email: 'admin@example.com', displayName: 'Admin', role: 'admin' })
  });
  const response = await profileWorker.fetch(request, {
    CF_ACCESS_TEAM_DOMAIN: 'trinity-team.cloudflareaccess.com', CF_ACCESS_AUD: 'expected-app-aud', CF_ACCESS_ADMIN_EMAILS: 'admin@example.com'
  }, { waitUntil() {} });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).profile.role, 'admin');
});

