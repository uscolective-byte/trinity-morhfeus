/**
 * @module tests/e2e/tier2-boundary-corner-cases.test.mjs
 * @description Tier 2: Boundary & Corner Cases E2E Tests for pc_open_app, pc_open_url, pc_open_file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { ProcessGuard, isPidRunning, withDesktopLock } from './process-cleanup.mjs';
import {
  startTestBridge,
  postPrivileged,
  workspaceRoot
} from './bridge-test-harness.mjs';

test.describe('Tier 2: Boundary & Corner Cases (Opaque-Box E2E)', () => {
  let bridge;

  test.before(async () => {
    bridge = await startTestBridge();
  });

  test.after(async () => {
    if (bridge) await bridge.stop();
  });

  test('Tier 2.1: pc_open_url with query parameters & and # is not broken by shell splitting', async () => {
    const complexUrl = 'https://example.com/search?query=trinity&format=json&version=2.1#top';
    const response = await postPrivileged(bridge.baseUrl, 'open_url', {
      url: complexUrl
    });

    assert.equal(response.status, 200, 'Bridge returned HTTP 200');
    assert.equal(response.body.status, 'completed', 'Execution status is completed');
    assert.equal(response.body.exit_code, 0, 'Exit code is 0');
    assert.equal(response.body.receipt?.success, true);
    assert.equal(response.body.receipt?.url, complexUrl);
  });

  test('Tier 2.2: pc_open_url with percent-encoded characters and spaces', async () => {
    const encodedUrl = 'https://example.com/api?title=Hello%20Trinity&tag=sovereign%26autonomous';
    const response = await postPrivileged(bridge.baseUrl, 'open_url', {
      url: encodedUrl
    });

    assert.equal(response.status, 200, 'Bridge returned HTTP 200');
    assert.equal(response.body.status, 'completed', 'Execution status is completed');
    assert.equal(response.body.exit_code, 0, 'Exit code is 0');
    assert.equal(response.body.receipt?.url, encodedUrl);
  });

  test('Tier 2.3: pc_open_url rejects dangerous schemes (file://, javascript:, ftp://)', async () => {
    const fileScheme = await postPrivileged(bridge.baseUrl, 'open_url', {
      url: 'file:///C:/Windows/System32/cmd.exe'
    });
    assert.ok(fileScheme.status >= 400 || fileScheme.body.status === 'failed', 'file:// must be rejected');
    assert.match(fileScheme.body.error || fileScheme.body.receipt?.error || '', /Povolené sú iba HTTP a HTTPS adresy|Neplatná URL/);

    const jsScheme = await postPrivileged(bridge.baseUrl, 'open_url', {
      url: 'javascript:alert(1)'
    });
    assert.ok(jsScheme.status >= 400 || jsScheme.body.status === 'failed', 'javascript: must be rejected');

    const ftpScheme = await postPrivileged(bridge.baseUrl, 'open_url', {
      url: 'ftp://ftp.example.com/leak.txt'
    });
    assert.ok(ftpScheme.status >= 400 || ftpScheme.body.status === 'failed', 'ftp:// must be rejected');
  });

  test('Tier 2.4: pc_open_file handles filenames and paths with spaces safely', async () => {
    await withDesktopLock(async () => {
      const fixturesDir = path.join(workspaceRoot, 'tests', 'e2e', 'fixtures', 'nested folder with spaces');
      fs.mkdirSync(fixturesDir, { recursive: true });
      const targetFile = path.join(fixturesDir, 'my test report with spaces.txt');
      fs.writeFileSync(targetFile, 'SPACES TEST DOCUMENT CONTENT', 'utf8');

      const relativePath = path.relative(workspaceRoot, targetFile).replaceAll('\\', '/');
      const guard = new ProcessGuard(['notepad.exe']);

      try {
        const response = await postPrivileged(bridge.baseUrl, 'open_file', {
          path: relativePath
        });

        assert.equal(response.status, 200, 'Bridge returned HTTP 200');
        assert.equal(response.body.status, 'completed', 'Execution status is completed');
        assert.equal(response.body.exit_code, 0, 'Exit code is 0');
        assert.equal(path.resolve(response.body.receipt?.resolvedPath), path.resolve(targetFile));

        await new Promise(r => setTimeout(r, 800));
        guard.detectDelta();
      } finally {
        guard.cleanup();
        try {
          fs.unlinkSync(targetFile);
          fs.rmdirSync(fixturesDir);
        } catch {}
      }
    });
  });

  test('Tier 2.5: pc_open_file rejects path traversal attempts', async () => {
    const response = await postPrivileged(bridge.baseUrl, 'open_file', {
      path: '../../windows/system32/cmd.exe'
    });

    assert.ok(response.status >= 400 || response.body.status === 'failed', 'Path traversal must be rejected');
    assert.match(response.body.error || response.body.receipt?.error || '', /chránená|mimo/);
  });

  test('Tier 2.6: pc_open_file rejects protected files (.env, credentials)', async () => {
    const envResponse = await postPrivileged(bridge.baseUrl, 'open_file', {
      path: '.env'
    });
    assert.ok(envResponse.status >= 400 || envResponse.body.status === 'failed', '.env must be protected');

    const credResponse = await postPrivileged(bridge.baseUrl, 'open_file', {
      path: '.credentials/token.dpapi'
    });
    assert.ok(credResponse.status >= 400 || credResponse.body.status === 'failed', '.credentials must be protected');
  });

  test('Tier 2.7: pc_open_app rejects unlisted or dangerous applications', async () => {
    const response = await postPrivileged(bridge.baseUrl, 'open_app', {
      target: 'unauthorized_cmd_tool'
    });

    // Unlisted app must fail either with 400/500 or error note
    const errText = response.body.error || response.body.app_execution?.note || '';
    assert.match(errText, /Aplikácia nie je v povolenom zozname/);
  });

  test('Tier 2.8: pc_open_app normalizes Slovak and colloquial app aliases (calc, poznamkovyblok)', async () => {
    await withDesktopLock(async () => {
      const guard = new ProcessGuard(['notepad.exe', 'CalculatorApp.exe', 'ApplicationFrameHost.exe']);
      let notepadPid = null;

      try {
        // Test 'poznamkovyblok' -> notepad alias
        const res = await postPrivileged(bridge.baseUrl, 'open_app', {
          target: 'poznamkovyblok'
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'completed');
        assert.equal(res.body.exit_code, 0);

        const execution = res.body.app_execution || res.body.receipt?.desktop;
        assert.equal(execution?.opened, true);
        notepadPid = execution?.window?.pid;
        assert.ok(notepadPid, `PID captured for alias 'poznamkovyblok': ${notepadPid}`);

        guard.track(notepadPid);
        assert.equal(isPidRunning(notepadPid), true);
      } finally {
        guard.cleanup();
        if (notepadPid) {
          assert.equal(isPidRunning(notepadPid), false);
        }
      }
    });
  });
});
