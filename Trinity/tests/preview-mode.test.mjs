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

test('production and development domains use isolated Worker resources', () => {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\uFEFF/, ''));
  const previewBindings = [
    {name:'Brain',class_name:'TrinityAgent'},
    {name:'CHAT_AGENT',class_name:'ChatAgent'},
    {name:'GUARDIAN_AGENT',class_name:'GuardianAgent'}
  ];
  for (const target of [config, config.env.development]) {
    // Only same-Worker classes: Cloudflare provisions separate Preview namespaces.
    // Exact shape rejects namespace_id, script_name and production resource bindings.
    assert.deepEqual(target.previews, {
      vars: {TRINITY_PREVIEW_MODE:'build-only',TRINITY_ENV:'preview'},
      durable_objects: {bindings:previewBindings}
    });
    for (const binding of previewBindings) {
      assert.ok(target.durable_objects.bindings.some(item =>
        item.name === binding.name && item.class_name === binding.class_name));
      assert.deepEqual(target.exports[binding.class_name], {
        type:'durable-object',storage:'sqlite'
      });
    }
  }
  assert.equal(config.vars.TRINITY_PREVIEW_MODE, undefined);
  assert.equal(config.vars.TRINITY_ENV, 'production');
  assert.equal(config.ai.binding, 'AI');
  assert.ok(config.d1_databases.some(database => database.binding === 'DB'));
  assert.ok(config.routes.some(route => route.pattern === 'auru.space'));
  assert.ok(!config.routes.some(route => route.pattern === 'auru.dev'));
  const development=config.env.development;
  assert.equal(development.name,'trinity-development');
  assert.equal(development.vars.TRINITY_ENV,'development');
  assert.ok(development.routes.some(route=>route.pattern==='auru.dev'));
  assert.notEqual(development.d1_databases.find(database=>database.binding==='DB').database_id,config.d1_databases.find(database=>database.binding==='DB').database_id);
  assert.notEqual(development.r2_buckets.find(bucket=>bucket.binding==='ARTIFACTS').bucket_name,config.r2_buckets.find(bucket=>bucket.binding==='ARTIFACTS').bucket_name);
  assert.notEqual(development.kv_namespaces.find(namespace=>namespace.binding==='Mastermind').id,config.kv_namespaces.find(namespace=>namespace.binding==='Mastermind').id);
  assert.ok(development.services.some(binding => binding.binding === 'KNOWLEDGE_SERVICE' && binding.service === 'trinity-knowledge-development'));
  assert.ok(config.services.some(binding=>binding.binding==='KNOWLEDGE_SERVICE'&&binding.service==='trinity-knowledge'));
  assert.deepEqual(config.version_metadata,{binding:'CF_VERSION_METADATA'});
  assert.deepEqual(development.version_metadata,config.version_metadata);
});
