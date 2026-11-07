import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

test('System Bridge requires an exact configured credential over real loopback HTTP', async t => {
  const keys = ['TRINITY_BRIDGE_TOKEN', 'TRINITY_LOCAL_TOKEN', 'MORHFEUS_ROOT'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'trinity-system-auth-'));
  const fixtureData = path.join(fixtureRoot, 'data');
  await mkdir(fixtureData);
  const fixtureText = JSON.stringify({ bridgeAuthFixture: true });
  await writeFile(path.join(fixtureRoot, 'package.json'), fixtureText);
  process.env.MORHFEUS_ROOT = fixtureRoot;
  delete process.env.TRINITY_BRIDGE_TOKEN;
  delete process.env.TRINITY_LOCAL_TOKEN;
  // Import only after isolating MORHFEUS_ROOT: the module must not load a real .env.
  const { createSystemBridgeServer } = await import(`../src/system-bridge.mjs?auth-fixture=${randomUUID()}`);
  const server = await createSystemBridgeServer({ port: 0, dataDir: fixtureData });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const credential = `fixture-bridge-key-${randomUUID()}`;
  const localCredential = `fixture-local-key-${randomUUID()}`;
  const prefixOnly = 'trinity-local-fixture-unconfigured';
  const postOllama = headers => fetch(origin + '/api/ollama/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{invalid-json'
  });
  // This fixture exercises the existing identity route behind the credential gate.
  // No external OAuth provider is called or claimed; only a temporary local file is read.
  const readFixture = headers => fetch(origin + '/api/execute-privileged', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ email: 'saboivan2008@gmail.com', verifiedGoogleToken: true,
      action: 'read', payload: { path: 'package.json' } })
  });
  const checkRead = async headers => {
    const response = await readFixture(headers);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.status, 'completed'); assert.equal(result.exit_code, 0);
    assert.equal(result.receipt.content, fixtureText);
    assert.match(result.local_ledger_receipt.receipt_id, /^TRN-LCL-V3-/);
  };
  try {
    await t.test('missing configuration denies arbitrary prefix and ordinary supplied keys before Ollama parsing', async () => {
      for (const token of [prefixOnly, credential, localCredential]) {
        assert.equal((await postOllama({ 'X-Trinity-Bridge-Token': token })).status, 403);
      }
      assert.equal((await postOllama({})).status, 403);
      assert.equal((await readFixture({ 'X-Trinity-Bridge-Token': prefixOnly })).status, 403);
    });
    await t.test('configured bridge key denies missing, wrong and prefix-only credentials', async () => {
      process.env.TRINITY_BRIDGE_TOKEN = credential;
      for (const headers of [{}, { Authorization: 'Bearer fixture-wrong-key' }, { 'X-Trinity-Bridge-Token': prefixOnly }]) {
        assert.equal((await postOllama(headers)).status, 403);
        assert.equal((await readFixture(headers)).status, 403);
      }
    });
    await t.test('explicit bridge credential authorizes the existing read handler through either header', async () => {
      await checkRead({ 'X-Trinity-Bridge-Token': credential });
      await checkRead({ Authorization: `Bearer ${credential}` });
    });
    await t.test('bridge credential takes precedence over the separately configured local credential', async () => {
      process.env.TRINITY_LOCAL_TOKEN = localCredential;
      assert.equal((await postOllama({ Authorization: `Bearer ${localCredential}` })).status, 403);
      await checkRead({ Authorization: `Bearer ${credential}` });
    });
    await t.test('TRINITY_LOCAL_TOKEN is accepted only as the explicit configured fallback', async () => {
      process.env.TRINITY_BRIDGE_TOKEN = '  ';
      assert.equal((await postOllama({ 'X-Trinity-Bridge-Token': prefixOnly })).status, 403);
      await checkRead({ 'X-Trinity-Bridge-Token': localCredential });
      await checkRead({ Authorization: `Bearer ${localCredential}` });
    });
    await t.test('clearing all configured credentials closes the gate again and never forwards Ollama requests', async () => {
      delete process.env.TRINITY_BRIDGE_TOKEN;
      delete process.env.TRINITY_LOCAL_TOKEN;
      assert.equal((await postOllama({ Authorization: `Bearer ${localCredential}` })).status, 403);
      assert.equal((await postOllama({ 'X-Trinity-Bridge-Token': prefixOnly })).status, 403);
      const records = (await readFile(path.join(fixtureData, 'sovereign-bridge-ledger.jsonl'), 'utf8'))
        .trim().split(/\r?\n/).map(line => JSON.parse(line));
      assert.equal(records.length, 5);
      assert.ok(records.every(record => record.operation === 'READ_WORKSPACE_FILE'));
      assert.equal((await readFile(path.join(fixtureRoot, 'package.json'), 'utf8')), fixtureText);
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key];
    }
    assert.equal(path.dirname(fixtureRoot), path.resolve(os.tmpdir()));
    assert.ok(path.basename(fixtureRoot).startsWith('trinity-system-auth-'));
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
