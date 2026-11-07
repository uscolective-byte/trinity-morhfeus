import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const targetPath = resolve(root, 'wrangler.jsonc');

function runCheck() {
  const res = spawnSync(process.execPath, [resolve(root, 'scripts/sync-root-wrangler.mjs'), '--check'], {
    cwd: root,
    encoding: 'utf8'
  });
  return { status: res.status, stdout: (res.stdout || '').trim(), stderr: (res.stderr || '').trim() };
}

test('wrangler.jsonc encoding is UTF-8 without BOM and directly parseable', () => {
  const buf = readFileSync(targetPath);
  assert.equal(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, false, 'Target has UTF-8 BOM');
  
  const rawText = buf.toString('utf8');
  assert.doesNotThrow(() => {
    JSON.parse(rawText);
  }, 'JSON.parse threw when parsing raw wrangler.jsonc');
});

test('Trinity/wrangler.jsonc encoding is UTF-8 without BOM and directly parseable', () => {
  const trinityPath = resolve(root, 'Trinity/wrangler.jsonc');
  const buf = readFileSync(trinityPath);
  assert.equal(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf, false, 'Canonical has UTF-8 BOM');
  
  const rawText = buf.toString('utf8');
  assert.doesNotThrow(() => {
    JSON.parse(rawText);
  }, 'JSON.parse threw when parsing raw Trinity/wrangler.jsonc');
});

test('sync-root-wrangler.mjs --check passes on clean repo', () => {
  const result = runCheck();
  assert.equal(result.status, 0, `Expected status 0, got ${result.status} (stderr: ${result.stderr})`);
  assert.match(result.stdout, /matches canonical metadata/);
});

test('sync-root-wrangler.mjs --check fails when intentional differences are introduced', () => {
  const original = readFileSync(targetPath, 'utf8');
  try {
    // Subtest A: Modified entry point
    const modifiedMain = original.replace('"main": "src/index.ts"', '"main": "src/hacked.ts"');
    assert.notEqual(modifiedMain, original, 'Replacement must change text');
    writeFileSync(targetPath, modifiedMain, 'utf8');
    const resMain = runCheck();
    assert.equal(resMain.status, 1, 'Expected status 1 when main is altered');
    assert.match(resMain.stderr, /differs from the canonical project/);

    // Subtest B: Extra property
    const parsed = JSON.parse(original);
    parsed.__injected_adversarial_property__ = 'stress_test';
    writeFileSync(targetPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
    const resInjected = runCheck();
    assert.equal(resInjected.status, 1, 'Expected status 1 when extra key is added');
    assert.match(resInjected.stderr, /differs from the canonical project/);

    // Subtest C: Modified environment variable
    const modifiedEnv = original.replace('"AURA_VERSION": "10.3.0"', '"AURA_VERSION": "10.3.1"');
    if (modifiedEnv !== original) {
      writeFileSync(targetPath, modifiedEnv, 'utf8');
      const resEnv = runCheck();
      assert.equal(resEnv.status, 1, 'Expected status 1 when env var is altered');
      assert.match(resEnv.stderr, /differs from the canonical project/);
    }

    // Subtest D: Trailing whitespace / missing final newline
    writeFileSync(targetPath, original.trimEnd(), 'utf8');
    const resWhitespace = runCheck();
    assert.equal(resWhitespace.status, 1, 'Expected status 1 when trailing newline is omitted');
  } finally {
    // Invariable cleanup: restore original file content
    writeFileSync(targetPath, original, 'utf8');
  }

  // Verify restored state
  const restored = runCheck();
  assert.equal(restored.status, 0, 'Restored state must pass --check with exit code 0');
});
