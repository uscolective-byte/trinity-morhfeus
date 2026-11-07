/**
 * @module tests/e2e/tier1-feature-coverage.test.mjs
 * @description Tier 1: Feature Coverage E2E Tests for pc_open_app, pc_open_url, pc_open_file, and Truth Policy 2.1.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { ProcessGuard, isPidRunning, withDesktopLock } from './process-cleanup.mjs';
import {
  startTestBridge,
  postPrivileged,
  readLedgerEntries,
  verifyLedgerIntegrity,
  workspaceRoot
} from './bridge-test-harness.mjs';

test.describe('Tier 1: Feature Coverage (Opaque-Box E2E)', () => {
  let bridge;

  test.before(async () => {
    bridge = await startTestBridge();
  });

  test.after(async () => {
    if (bridge) await bridge.stop();
  });

  test('Tier 1.1: pc_open_app launches Notepad, captures real PID, confirms window, and terminates cleanly', async () => {
    await withDesktopLock(async () => {
      const guard = new ProcessGuard(['notepad.exe']);
      let openedPid = null;

      try {
        const response = await postPrivileged(bridge.baseUrl, 'open_app', {
          target: 'notepad',
          app: 'notepad'
        });

        assert.equal(response.status, 200, 'Bridge returned HTTP 200');
        assert.equal(response.body.status, 'completed', 'Execution status is completed');
        assert.equal(response.body.exit_code, 0, 'Exit code is 0 (Truth Policy 2.1)');

        const execution = response.body.app_execution || response.body.receipt?.desktop;
        assert.ok(execution, 'Execution record exists');
        assert.equal(execution.opened, true, 'Window confirmed opened');

        openedPid = execution.window?.pid;
        assert.ok(openedPid && typeof openedPid === 'number', `Valid PID returned: ${openedPid}`);

        // Track PID for teardown
        guard.track(openedPid);

        // Verify the process is actually running on Windows
        assert.equal(isPidRunning(openedPid), true, `Process ${openedPid} is alive on Windows OS`);
      } finally {
        // Teardown: Guaranteed termination via taskkill /F /T /PID
        guard.cleanup();

        // Verify zero lingering test processes
        if (openedPid) {
          assert.equal(isPidRunning(openedPid), false, `Process ${openedPid} must be terminated`);
        }
      }
    });
  });

  test('Tier 1.2: pc_open_app launches Calculator, captures real PID, confirms window, and terminates cleanly', async () => {
    await withDesktopLock(async () => {
      const guard = new ProcessGuard(['CalculatorApp.exe', 'ApplicationFrameHost.exe', 'calc.exe']);
      let openedPid = null;

      try {
        const response = await postPrivileged(bridge.baseUrl, 'open_app', {
          target: 'calculator',
          app: 'calculator'
        });

        assert.equal(response.status, 200, 'Bridge returned HTTP 200');
        assert.equal(response.body.status, 'completed', 'Status is completed');
        assert.equal(response.body.exit_code, 0, 'Exit code is 0');

        const execution = response.body.app_execution || response.body.receipt?.desktop;
        assert.ok(execution, 'Execution record exists');
        assert.equal(execution.opened, true, 'Calculator opened confirmed');

        openedPid = execution.window?.pid;
        assert.ok(openedPid && typeof openedPid === 'number', `Valid PID returned: ${openedPid}`);

        guard.track(openedPid);
        assert.equal(isPidRunning(openedPid), true, `Process ${openedPid} is alive on Windows OS`);
      } finally {
        guard.cleanup();
        if (openedPid) {
          assert.equal(isPidRunning(openedPid), false, `Process ${openedPid} must be terminated`);
        }
      }
    });
  });

  test('Tier 1.3: pc_open_url opens valid HTTP/HTTPS address in default browser', async () => {
    const testUrl = 'https://example.com';
    const response = await postPrivileged(bridge.baseUrl, 'open_url', {
      url: testUrl
    });

    assert.equal(response.status, 200, 'Bridge returned HTTP 200');
    assert.equal(response.body.status, 'completed', 'Execution status is completed');
    assert.equal(response.body.exit_code, 0, 'Exit code is 0');

    const receipt = response.body.receipt;
    assert.ok(receipt, 'Receipt returned');
    assert.equal(receipt.action, 'open_url');
    assert.equal(receipt.success, true);
    assert.match(receipt.url, /^https:\/\/example\.com\/?$/);
  });

  test('Tier 1.4: pc_open_file opens existing workspace file, captures delta PID, and terminates cleanly', async () => {
    await withDesktopLock(async () => {
      const fixturesDir = path.join(workspaceRoot, 'tests', 'e2e', 'fixtures');
      fs.mkdirSync(fixturesDir, { recursive: true });
      const testFilePath = path.join(fixturesDir, 'tier1-probe-doc.txt');
      fs.writeFileSync(testFilePath, 'TRINITY TIER 1 FILE TEST ' + Date.now(), 'utf8');

      const relativePath = path.relative(workspaceRoot, testFilePath).replaceAll('\\', '/');
      const guard = new ProcessGuard(['notepad.exe']);

      try {
        const response = await postPrivileged(bridge.baseUrl, 'open_file', {
          path: relativePath
        });

        assert.equal(response.status, 200, 'Bridge returned HTTP 200');
        assert.equal(response.body.status, 'completed', 'Execution status is completed');
        assert.equal(response.body.exit_code, 0, 'Exit code is 0');

        const receipt = response.body.receipt;
        assert.ok(receipt, 'Receipt returned');
        assert.equal(receipt.action, 'open_file');
        assert.equal(receipt.success, true);
        assert.equal(path.resolve(receipt.resolvedPath), path.resolve(testFilePath));

        // Wait briefly for default text editor to be launched by Windows Shell
        await new Promise(r => setTimeout(r, 1000));
        const delta = guard.detectDelta();
        // Delta may contain newly spawned notepad process
        if (delta.length > 0) {
          for (const pid of delta) {
            assert.equal(isPidRunning(pid), true, `Delta PID ${pid} confirmed alive`);
          }
        }
      } finally {
        guard.cleanup();
        try {
          fs.unlinkSync(testFilePath);
        } catch {}
      }
    });
  });

  test('Tier 1.5: Truth Policy 2.1 compliance (cryptographic receipts, exit_code 0, SID validation)', async () => {
    const entries = readLedgerEntries(bridge.dataDir);
    assert.ok(entries.length >= 4, `At least 4 actions logged in ledger (actual: ${entries.length})`);

    // Verify cryptographic continuity across all entries
    verifyLedgerIntegrity(entries);

    // Verify each ledger entry strictly satisfies Truth Policy 2.1
    for (const entry of entries) {
      assert.equal(entry.exit_code, 0, `Entry ${entry.index} exit code must be 0`);
      assert.match(entry.receipt_id, /^TRN-LCL-V3-\d+-[A-F0-9]{12}$/, 'Valid sovereign receipt ID format');
      assert.equal(entry.block_hash.length, 64, 'Valid 64-char SHA-256 block hash');
      assert.ok(entry.windows_sid, 'Windows SID is recorded in audit block');
    }
  });
});
