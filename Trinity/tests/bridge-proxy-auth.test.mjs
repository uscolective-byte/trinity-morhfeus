import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeBridgeProxy } from '../src/bridge-proxy-auth.js';
import { configuredBridgeToken, registeredBridgeTunnelUrl, BRIDGE_AUTH_VERSION } from '../../packages/contracts/src/bridge-auth.js';
const bridge = 'fixture-explicit-bridge-credential';
const ownerKey = 'fixture-owner-ops-credential';
const env = { TRINITY_BRIDGE_TOKEN: bridge, TRINITY_OPS_KEY: ownerKey };
const request = headers => new Request('https://trinity.test/api/launch', { method: 'POST', headers });

test('bridge configuration requires an explicit string and supports the existing local credential', () => {
  for (const bad of [undefined, '', ' ', {}, false, 'x'.repeat(2049), 'bad\nvalue']) assert.equal(configuredBridgeToken({ TRINITY_BRIDGE_TOKEN: bad }), null);
  assert.equal(configuredBridgeToken({ TRINITY_LOCAL_TOKEN: bridge }), bridge);
  assert.equal(configuredBridgeToken({ TRINITY_BRIDGE_TOKEN: '  ' + bridge + '  ' }), bridge);
});
test('missing bridge configuration fails closed even for an authenticated owner', async () => {
  await assert.rejects(authorizeBridgeProxy(request({ Authorization: 'Bearer ' + ownerKey }), { TRINITY_OPS_KEY: ownerKey }), { status: 503 });
});
test('an unauthenticated caller cannot borrow the configured server bridge credential', async () => {
  await assert.rejects(authorizeBridgeProxy(request({}), env), { status: 401 });
});
test('arbitrary token prefixes and forged email headers do not authorize a proxy call', async () => {
  await assert.rejects(authorizeBridgeProxy(request({ 'X-Trinity-Bridge-Token': 'trinity-local-fixture-forged', 'x-trinity-email': 'owner@example.test' }), env), { status: 401 });
  await assert.rejects(authorizeBridgeProxy(request({ 'x-trinity-email': 'owner@example.test' }), env), { status: 401 });
});
test('explicit exact bridge credentials and existing owner credentials retain access', async () => {
  assert.equal(await authorizeBridgeProxy(request({ 'X-Trinity-Bridge-Token': bridge }), env), bridge);
  assert.equal(await authorizeBridgeProxy(request({ Authorization: 'Bearer ' + bridge }), env), bridge);
  assert.equal(await authorizeBridgeProxy(request({ Authorization: 'Bearer ' + ownerKey }), env), bridge);
});
test('an explicitly wrong bridge header cannot be rescued by unrelated owner credentials', async () => {
  await assert.rejects(authorizeBridgeProxy(request({ Authorization: 'Bearer ' + ownerKey, 'X-Trinity-Bridge-Token': 'wrong-fixture-token' }), env), { status: 401 });
});
test('cross-origin requests are denied even when a valid bridge credential is present', async () => {
  await assert.rejects(authorizeBridgeProxy(request({ Origin: 'https://attacker.test', 'X-Trinity-Bridge-Token': bridge }), env), { status: 403 });
});
test('authenticated user/admin sessions cannot borrow the owner bridge credential', async () => {
  for (const role of ['user', 'admin']) {
    const sessionEnv = { ...env, TRINITY_AUTH_MODE: 'google', TRINITY_OWNER_EMAIL: 'owner@example.test',
      DB: { prepare: () => ({ bind: () => ({ first: async () => ({ email: 'member@example.test', role, status: 'active', expires_at: Date.now() + 60000 }) }) }) } };
    await assert.rejects(authorizeBridgeProxy(request({ Cookie: 'trinity_session=' + 'a'.repeat(64) }), sessionEnv), { status: 403 });
  }
});
test('existing authenticated owner session works without caller identity assertions', async () => {
  const sessionEnv = { ...env, TRINITY_AUTH_MODE: 'google', TRINITY_OWNER_EMAIL: 'owner@example.test',
    DB: { prepare: () => ({ bind: () => ({ first: async () => ({ email: 'owner@example.test', role: 'user', status: 'active', expires_at: Date.now() + 60000 }) }) }) } };
  assert.equal(await authorizeBridgeProxy(request({ Cookie: 'trinity_session=' + 'b'.repeat(64) }), sessionEnv), bridge);
});
test('tunnel metadata requires the authenticated-registration version and a root HTTPS origin', () => {
  assert.equal(registeredBridgeTunnelUrl({ tunnel_url: 'https://fixture.test' }), null);
  for (const url of ['http://fixture.test', 'https://user:password@fixture.test', 'https://fixture.test/path', 'https://fixture.test/?token=x', 'https://fixture.test/#hash']) {
    assert.equal(registeredBridgeTunnelUrl({ auth_version: BRIDGE_AUTH_VERSION, tunnel_url: url }), null);
  }
  assert.equal(registeredBridgeTunnelUrl({ auth_version: BRIDGE_AUTH_VERSION, tunnel_url: 'https://fixture.test/' }), 'https://fixture.test');
});
