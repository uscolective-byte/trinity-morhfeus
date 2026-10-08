import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allowedApps, isPrivateAddress, resolveAllowedApp, resolveAllowedPath, validatePublicUrl } from '../bridge-core.mjs';

test('filesystem policy permits only configured roots', () => {
  const root = mkdtempSync(join(tmpdir(), 'trinity-bridge-'));
  mkdirSync(join(root, 'nested'));
  writeFileSync(join(root, 'nested', 'a.txt'), 'ok');
  assert.equal(resolveAllowedPath(join(root, 'nested', 'a.txt'), [root], { mustExist: true }), join(root, 'nested', 'a.txt'));
  assert.throws(() => resolveAllowedPath(join(root, '..', 'escape.txt'), [root]), /mimo povolených/);
});

test('filesystem policy rejects symlink escapes when supported', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'trinity-root-'));
  const outside = mkdtempSync(join(tmpdir(), 'trinity-out-'));
  try { symlinkSync(outside, join(root, 'link'), 'junction'); }
  catch { t.skip('Symlinks are not available for this user.'); return; }
  assert.throws(() => resolveAllowedPath(join(root, 'link', 'secret.txt'), [root]), /symbolický odkaz/);
});

test('application policy uses aliases, never arbitrary executables', () => {
  const apps = allowedApps('notepad,edge,unknown');
  assert.deepEqual(resolveAllowedApp('NOTEPAD', apps), { name: 'notepad', executable: 'notepad.exe' });
  assert.throws(() => resolveAllowedApp('powershell', apps), /nie je povolená/);
});

test('web policy blocks private and non-http destinations', () => {
  for (const address of ['127.0.0.1', '10.0.0.2', '172.16.0.1', '192.168.1.1', '::1']) assert.equal(isPrivateAddress(address), true);
  assert.throws(() => validatePublicUrl('http://localhost/admin'), /privátne/);
  assert.throws(() => validatePublicUrl('file:///etc/passwd'), /HTTP/);
  assert.equal(validatePublicUrl('https://example.com/a').hostname, 'example.com');
});
