import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const deprecatedHost = ['auru','dev'].join('.');
const activeFiles = [
  'Local-Gateway/start.ps1',
  'Trinity/OTVORIT-TRINITY.ps1',
  'Trinity/.dev.vars.example',
  'Trinity/src/architecture.js',
  'Trinity/services/aura-entry.js',
  'Trinity/scripts/live-chat-system-test.mjs',
  'Trinity/scripts/live-pc-bridge-test.mjs',
  'Trinity/scripts/live-studio-test.mjs',
  'Trinity/scripts/live-system-capabilities-test.mjs',
  'Trinity/scripts/live-truth-test.mjs',
  'Trinity/trinity-pc-bridge/bridge.mjs',
  'Trinity/trinity-pc-bridge/.env.example',
  'Firebase/firebase.json',
  'Firebase/public/app.js',
  'Firebase/public/index.html',
  'stav-projektu.json'
];

test('active launchers, bridges, and live checks do not use the retired domain', async () => {
  for (const path of activeFiles) {
    assert.equal((await read(path)).includes(deprecatedHost), false, path);
  }
  assert.match(await read('Local-Gateway/start.ps1'), /CloudUrl = 'https:\/\/auru\.space'/);
});

test('deployment routes and OAuth callback use the canonical domain', async () => {
  for (const path of ['Trinity/wrangler.jsonc','Trinity/wrangler.knowledge.jsonc']) {
    const config = JSON.parse(await read(path));
    assert.deepEqual(config.routes, [{pattern:'auru.space',custom_domain:true}], path);
    assert.equal(config.vars.GOOGLE_REDIRECT_URI, 'https://auru.space/api/auth/google/callback');
  }
});