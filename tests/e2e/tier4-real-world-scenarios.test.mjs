/**
 * @module tests/e2e/tier4-real-world-scenarios.test.mjs
 * @description Tier 4: Real-World Application Scenarios E2E Tests for Trinity Autonomous Desktop Bridge.
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

test.describe('Tier 4: Real-World Application Scenarios (Opaque-Box E2E)', () => {
  let bridge;

  test.before(async () => {
    bridge = await startTestBridge();
  });

  test.after(async () => {
    if (bridge) await bridge.stop();
  });

  test('Scenario 4.1: Developer workflow - Autonomous assistant opens project markdown documentation', async () => {
    await withDesktopLock(async () => {
      const docPath = path.join(workspaceRoot, 'docs', 'E2E_VERIFICATION_WORKFLOW.md');
      fs.mkdirSync(path.dirname(docPath), { recursive: true });
      fs.writeFileSync(docPath, `# Trinity Autonomous Desktop Bridge E2E Guide\n\nVerified at ${new Date().toISOString()}\n`, 'utf8');

      const relativePath = path.relative(workspaceRoot, docPath).replaceAll('\\', '/');
      const guard = new ProcessGuard(['notepad.exe']);

      try {
        const response = await postPrivileged(bridge.baseUrl, 'open_file', {
          path: relativePath
        });

        assert.equal(response.status, 200, 'Bridge returns 200');
        assert.equal(response.body.status, 'completed');
        assert.equal(response.body.exit_code, 0);

        const receipt = response.body.receipt;
        assert.ok(receipt);
        assert.equal(receipt.action, 'open_file');
        assert.equal(receipt.success, true);
        assert.equal(path.resolve(receipt.resolvedPath), path.resolve(docPath));

        await new Promise(r => setTimeout(r, 1000));
        guard.detectDelta();
      } finally {
        guard.cleanup();
        try {
          fs.unlinkSync(docPath);
        } catch {}
      }
    });
  });

  test('Scenario 4.2: Research workflow - Autonomous assistant opens external technical documentation', async () => {
    const docUrl = 'https://nodejs.org/api/documentation.html';
    const response = await postPrivileged(bridge.baseUrl, 'open_url', {
      url: docUrl
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'completed');
    assert.equal(response.body.exit_code, 0);

    const receipt = response.body.receipt;
    assert.ok(receipt);
    assert.equal(receipt.action, 'open_url');
    assert.equal(receipt.success, true);
    assert.equal(receipt.url, docUrl);
  });

  test('Scenario 4.3: Quick note-taking workflow - Autonomous assistant launches text editor', async () => {
    await withDesktopLock(async () => {
      const guard = new ProcessGuard(['notepad.exe']);
      let notepadPid = null;

      try {
        const response = await postPrivileged(bridge.baseUrl, 'open_app', {
          target: 'notepad',
          app: 'notepad'
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.status, 'completed');
        assert.equal(response.body.exit_code, 0);

        const execution = response.body.app_execution || response.body.receipt?.desktop;
        assert.ok(execution);
        assert.equal(execution.opened, true);

        notepadPid = execution.window?.pid;
        assert.ok(notepadPid, `Captured Notepad PID: ${notepadPid}`);

        guard.track(notepadPid);
        assert.equal(isPidRunning(notepadPid), true, 'Notepad process is active');
      } finally {
        guard.cleanup();
        if (notepadPid) {
          assert.equal(isPidRunning(notepadPid), false, 'Notepad is terminated cleanly');
        }
      }
    });
  });

  test('Scenario 4.4: Sovereign Ledger cryptographic replay & Truth Policy 2.1 verification', async () => {
    const entries = readLedgerEntries(bridge.dataDir);
    assert.ok(entries.length >= 3, `Sovereign ledger captured ${entries.length} blocks`);

    // Verify cryptographic tamper-evident continuity
    verifyLedgerIntegrity(entries);

    for (const block of entries) {
      assert.equal(block.exit_code, 0, `Block ${block.index} must have exit_code 0`);
      assert.match(block.receipt_id, /^TRN-LCL-V3-\d+-[A-F0-9]{12}$/);
      assert.equal(block.block_hash.length, 64);
      assert.ok(block.windows_sid);
    }
  });
});
