import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callModel } from '../src/services.js';
import { BRIDGE_AUTH_VERSION } from '../../packages/contracts/src/bridge-auth.js';
const messages = [{ role: 'user', content: 'fixture prompt' }];
const tunnel = 'https://fixture-bridge.example.test';
const base = { PC_STATE: { get: async () => JSON.stringify({ tunnel_url: tunnel, auth_version: BRIDGE_AUTH_VERSION }) }, OLLAMA_API_KEY: 'fixture-cloud-credential' };
async function withFetch(fn, operation) {
  const original = globalThis.fetch; globalThis.fetch = fn;
  try { return await operation(); } finally { globalThis.fetch = original; }
}
test('missing bridge credential skips the local tunnel and preserves authenticated cloud fallback', async () => {
  const urls = [];
  const result = await withFetch(async (url, options) => {
    urls.push(String(url)); assert.equal(String(url), 'https://ollama.com/api/chat');
    assert.equal(options.headers.Authorization, 'Bearer fixture-cloud-credential');
    return Response.json({ message: { content: 'cloud fixture result' } });
  }, () => callModel(base, 'ollama', messages));
  assert.equal(result.provider, 'ollama-cloud'); assert.equal(urls.length, 1);
});
test('invalid credential object is never stringified or sent as a bridge credential', async () => {
  let calls = 0;
  await withFetch(async url => { calls++; assert.equal(String(url), 'https://ollama.com/api/chat'); return Response.json({ message: { content: 'cloud fixture' } }); },
    () => callModel({ ...base, TRINITY_BRIDGE_TOKEN: { access: 'unverified' } }, 'ollama', messages));
  assert.equal(calls, 1);
});
test('explicit configured bridge credential executes the local path without calling cloud', async () => {
  let calls = 0;
  const result = await withFetch(async (url, options) => {
    calls++; assert.equal(String(url), tunnel + '/api/ollama/chat');
    assert.equal(options.headers['X-Trinity-Bridge-Token'], 'fixture-bridge-credential');
    assert.equal(options.redirect, 'manual');
    return Response.json({ text: 'local fixture result', model: 'fixture-model' });
  }, () => callModel({ ...base, TRINITY_BRIDGE_TOKEN: 'fixture-bridge-credential' }, 'ollama-local', messages));
  assert.equal(result.provider, 'ollama-local'); assert.equal(calls, 1);
});
test('bridge redirects cannot forward the credential to a second origin', async () => {
  const urls = [];
  const result = await withFetch(async (url, options) => {
    urls.push(String(url));
    if (String(url).startsWith(tunnel)) {
      assert.equal(options.redirect, 'manual');
      return new Response(null, { status: 302, headers: { Location: 'https://untrusted.example.test/' } });
    }
    assert.equal(String(url), 'https://ollama.com/api/chat');
    assert.equal(options.headers['X-Trinity-Bridge-Token'], undefined);
    return Response.json({ message: { content: 'authenticated fallback fixture' } });
  }, () => callModel({ ...base, TRINITY_BRIDGE_TOKEN: 'fixture-bridge-credential' }, 'ollama', messages));
  assert.equal(result.provider, 'ollama-cloud'); assert.equal(urls.length, 2);
});
test('missing local and cloud credentials never produces a simulated success or network call', async () => {
  let calls = 0;
  await withFetch(async () => { calls++; throw new Error('Unexpected fixture network'); }, async () => {
    await assert.rejects(callModel({ PC_STATE: base.PC_STATE }, 'ollama', messages), /Ollama nie je dostupná/);
  });
  assert.equal(calls, 0);
});
test('legacy tunnel metadata cannot receive the real credential before authenticated re-registration', async () => {
  const urls = [];
  await withFetch(async url => {
    urls.push(String(url)); assert.equal(String(url), 'https://ollama.com/api/chat');
    return Response.json({ message: { content: 'cloud fallback fixture' } });
  }, () => callModel({ ...base, TRINITY_BRIDGE_TOKEN: 'fixture-bridge-credential', PC_STATE: { get: async () => JSON.stringify({ tunnel_url: 'https://untrusted.example.test' }) } }, 'ollama', messages));
  assert.equal(urls.length, 1);
});
