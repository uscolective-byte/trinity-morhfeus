import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const load = name => JSON.parse(readFileSync(new URL('../' + name, import.meta.url), 'utf8'));
const canonical = load('Trinity/wrangler.jsonc');
const mirror = load('wrangler.jsonc');

test('root deployment retains canonical bindings, lifecycle, auth metadata and environments', () => {
  for (const name of ['name', 'account_id', 'routes', 'exports', 'durable_objects', 'services', 'workflows',
    'kv_namespaces', 'r2_buckets', 'vectorize', 'secrets_store_secrets', 'vars', 'version_metadata'])
    assert.deepEqual(mirror[name], canonical[name], name);
  assert.equal(mirror.main, 'src/index.ts');
  assert.equal(Object.hasOwn(mirror, 'migrations'), false);
  assert.deepEqual(Object.keys(mirror.exports).sort(), ['ChatAgent', 'GuardianAgent', 'TrinityAgent']);
  for (const environment of Object.keys(canonical.env)) {
    for (const name of ['name', 'routes', 'vars', 'durable_objects', 'services', 'secrets_store_secrets'])
      assert.deepEqual(mirror.env[environment][name], canonical.env[environment][name], environment + '.' + name);
  }
});

test('root entry reexports the real HTTP router, Durable Objects and workflow without duplicate stubs', () => {
  const entry = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(entry, /export \* from ['"]\.\.\/Trinity\/src\/index\.js['"]/);
  assert.match(entry, /export \{\s*default\s*\} from ['"]\.\.\/Trinity\/src\/index\.js['"]/);
  assert.doesNotMatch(entry, /class\s+TrinityAgent|new Hono|status\s*:\s*['"]alive['"]/);
});

test('D1 migration paths remain valid from the root working directory', () => {
  for (const group of [mirror, ...Object.values(mirror.env)]) for (const database of group.d1_databases || [])
    if (database.migrations_dir) assert.equal(database.migrations_dir, 'Trinity/migrations');
});

test('root configuration generator reports an up-to-date compatibility configuration', () => {
  const result = spawnSync(process.execPath, ['scripts/sync-root-wrangler.mjs', '--check'], {cwd: root, encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
});
