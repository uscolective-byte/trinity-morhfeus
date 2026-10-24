import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';

test('compiled build-only Preview blocks production routes without any storage or service binding', async () => {
  const modules = readdirSync('dist')
    .filter(name => !name.endsWith('.map') && !name.endsWith('.md'))
    .map(name => ({type: name === 'index.js' ? 'ESModule' : name.endsWith('.png') ? 'Data' : 'Text', path: resolve('dist', name)}));
  modules.sort((a, b) => a.type === 'ESModule' ? -1 : b.type === 'ESModule' ? 1 : 0);
  const mf = new Miniflare(convertV4MiniflareOptions({
    workers: [{
      name: 'build-only-preview', modules,
      compatibilityDate: '2026-10-01', compatibilityFlags: ['nodejs_compat'],
      bindings: {TRINITY_PREVIEW_MODE: 'build-only'}
    }]
  }));
  try {
    const health = await mf.dispatchFetch('https://preview.trinity.test/health');
    assert.equal(health.status, 200);
    const body = await health.json();
    assert.equal(body.mode, 'build-only');
    assert.equal(body.integration_validation, 'not-performed');
    const ready = await mf.dispatchFetch('https://preview.trinity.test/ready');
    assert.equal(ready.status, 503);
    assert.equal((await ready.json()).ready, false);
    for (const path of ['/', '/api/auth/config', '/mcp', '/api/ops/memory', '/api/system/actions']) {
      for (const method of ['GET', 'POST']) {
        const response = await mf.dispatchFetch('https://preview.trinity.test' + path, {
          method, headers: {Authorization: 'Bearer test-only-not-a-real-secret-123456789'},
          ...(method === 'POST' ? {body: '{}'} : {})
        });
        assert.equal(response.status, 503, `${method} ${path}`);
        assert.equal((await response.json()).data_access, 'blocked');
      }
    }
  } finally {
    await mf.dispose();
  }
});
