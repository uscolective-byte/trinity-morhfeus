import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildOnlyPreviewResponse, isBuildOnlyPreview} from '../src/preview-mode.js';

const meta = {version: '9.4.0', agents: 40};
const url = 'https://preview.trinity.test';
const isolatedEnv = new Proxy({TRINITY_PREVIEW_MODE: 'build-only'}, {
  get(target, key) {
    if (key === 'TRINITY_PREVIEW_MODE') return target[key];
    throw new Error(`Build-only Preview accessed ${String(key)}`);
  }
});

test('build-only Preview reports liveness without pretending integrations are ready', async () => {
  for (const path of ['/health', '/api/health']) {
    const response = buildOnlyPreviewResponse(new Request(url + path), isolatedEnv, meta);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), {
      service: 'Trinity', version: meta.version, mode: 'build-only',
      data_access: 'blocked', integration_validation: 'not-performed',
      agents: 40, status: 'serving'
    });
  }
  const response = buildOnlyPreviewResponse(new Request(url + '/ready'), isolatedEnv, meta);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ready, false);
});

test('build-only Preview blocks every non-probe path and mutation without touching bindings', async () => {
  for (const path of ['/', '/mcp', '/api/auth/google/start', '/api/ops/memory', '/api/system/actions', '/api/assistant/api-keys', '/unknown']) {
    for (const method of ['GET', 'POST', 'DELETE', 'OPTIONS']) {
      const response = buildOnlyPreviewResponse(new Request(url + path, {method}), isolatedEnv, meta);
      assert.equal(response.status, 503, `${method} ${path}`);
      assert.equal((await response.json()).data_access, 'blocked');
    }
  }
  assert.equal(buildOnlyPreviewResponse(new Request(url + '/health', {method: 'POST'}), isolatedEnv, meta).status, 503);
});

test('production routing is unchanged when build-only mode is absent', () => {
  for (const env of [{}, {TRINITY_PREVIEW_MODE: 'production'}, {TRINITY_PREVIEW_MODE: false}]) {
    assert.equal(isBuildOnlyPreview(env), false);
    assert.equal(buildOnlyPreviewResponse(new Request(url + '/mcp'), env, meta), null);
  }
});

test('explicit Preview configuration contains no production resources or AI calls', () => {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\uFEFF/, ''));
  assert.deepEqual(config.previews, {vars: {TRINITY_PREVIEW_MODE: 'build-only'}});
  assert.equal(config.vars.TRINITY_PREVIEW_MODE, undefined);
  assert.equal(config.ai.binding, 'AI');
  assert.ok(config.d1_databases.some(database => database.binding === 'DB'));
  assert.ok(config.routes.some(route => route.pattern === 'auru.space'));
  assert.ok(config.routes.some(route => route.pattern === 'auru.dev'));
});