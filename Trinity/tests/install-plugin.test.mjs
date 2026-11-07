import test from 'node:test';
import assert from 'node:assert/strict';
import { installPlugin, checkPluginAvailability, PLUGINS } from '../src/plugins.js';

test('checkPluginAvailability distinguishes ready, standby and awaiting credentials', () => {
  const jsonPlugin = PLUGINS.find(p => p.id === 'json-data') || { id: 'json-data' };
  assert.equal(checkPluginAvailability({}, jsonPlugin), 'READY');

  const fbPlugin = { id: 'facebook-connector' };
  assert.equal(checkPluginAvailability({}, fbPlugin), 'AWAITING_AUTH');
  assert.equal(checkPluginAvailability({ META_ACCESS_TOKEN: 'secret-token' }, fbPlugin), 'CONNECTED');

  const pcPlugin = { id: 'computer-control' };
  assert.equal(checkPluginAvailability({}, pcPlugin), 'CONNECTED_STANDBY');
});

test('installPlugin handles id: "all" by installing all plugins with structured statuses', async () => {
  const statements = [];
  const events = [];
  const mockEnv = {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              sql,
              args,
              run: async () => ({ success: true })
            };
          }
        };
      },
      batch: async (batchStatements) => {
        statements.push(...batchStatements);
        return [];
      }
    }
  };

  const res = await installPlugin(mockEnv, 'all');
  assert.equal(res.id, 'all');
  assert.equal(res.installed, true);
  assert.equal(res.enabled, true);
  assert.equal(res.count, PLUGINS.length);
  assert.ok(Array.isArray(res.plugins));
  assert.equal(res.plugins.length, PLUGINS.length);
  assert.ok(res.ready_count > 0);
  assert.equal(res.status, 'INSTALLED');
});

test('installPlugin rejects unlisted plugin', async () => {
  const mockEnv = { DB: { prepare: () => ({ bind: () => ({ run: async () => {} }) }) } };
  await assert.rejects(
    () => installPlugin(mockEnv, 'unknown-bogus-plugin-id'),
    /Plugin nie je v dôveryhodnom katalógu Trinity/
  );
});
