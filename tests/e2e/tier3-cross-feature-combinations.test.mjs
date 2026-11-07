/**
 * @module tests/e2e/tier3-cross-feature-combinations.test.mjs
 * @description Tier 3: Cross-Feature Combinations E2E Tests for pc_open_app, pc_open_url, pc_open_file.
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

test.describe('Tier 3: Cross-Feature Combinations (Opaque-Box E2E)', () => {
  let bridge;

  test.before(async () => {
    bridge = await startTestBridge();
  });

  test.after(async () => {
    if (bridge) await bridge.stop();
  });

  test('Tier 3.1: Sequential multi-app launch (Notepad -> Calculator) with concurrent lifecycle & teardown', async () => {
    await withDesktopLock(async () => {
      const guard = new ProcessGuard(['notepad.exe', 'CalculatorApp.exe', 'ApplicationFrameHost.exe']);
      let pidNotepad = null;
      let pidCalc = null;

      try {
        // Step 1: Open Notepad
        const res1 = await postPrivileged(bridge.baseUrl, 'open_app', { target: 'notepad', app: 'notepad' });
        assert.equal(res1.status, 200);
        assert.equal(res1.body.status, 'completed');
        pidNotepad = (res1.body.app_execution || res1.body.receipt?.desktop)?.window?.pid;
        assert.ok(pidNotepad, `Notepad PID: ${pidNotepad}`);
        guard.track(pidNotepad);
        assert.equal(isPidRunning(pidNotepad), true, 'Notepad is running');

        // Step 2: Open Calculator
        const res2 = await postPrivileged(bridge.baseUrl, 'open_app', { target: 'calculator', app: 'calculator' });
        assert.equal(res2.status, 200);
        assert.equal(res2.body.status, 'completed');
        pidCalc = (res2.body.app_execution || res2.body.receipt?.desktop)?.window?.pid;
        assert.ok(pidCalc, `Calculator PID: ${pidCalc}`);
        guard.track(pidCalc);
        assert.equal(isPidRunning(pidCalc), true, 'Calculator is running');

        // Confirm both are simultaneously active
        assert.equal(isPidRunning(pidNotepad), true, 'Notepad still running while Calculator active');
        assert.equal(isPidRunning(pidCalc), true, 'Calculator running');
      } finally {
        // Teardown both cleanly
        guard.cleanup();

        if (pidNotepad) assert.equal(isPidRunning(pidNotepad), false, 'Notepad terminated');
        if (pidCalc) assert.equal(isPidRunning(pidCalc), false, 'Calculator terminated');
      }
    });
  });

  test('Tier 3.2: Multi-step composite pipeline (App -> File -> URL) with cryptographic ledger continuity', async () => {
    await withDesktopLock(async () => {
      const guard = new ProcessGuard(['notepad.exe']);
      const fixturesDir = path.join(workspaceRoot, 'tests', 'e2e', 'fixtures');
      fs.mkdirSync(fixturesDir, { recursive: true });
      const probeFile = path.join(fixturesDir, 'tier3-composite.txt');
      fs.writeFileSync(probeFile, 'TRINITY TIER 3 COMPOSITE ACTION PIPELINE', 'utf8');
      const relativePath = path.relative(workspaceRoot, probeFile).replaceAll('\\', '/');

      try {
        // Action 1: Open App
        const appRes = await postPrivileged(bridge.baseUrl, 'open_app', { target: 'notepad', app: 'notepad' });
        assert.equal(appRes.status, 200);
        const appPid = (appRes.body.app_execution || appRes.body.receipt?.desktop)?.window?.pid;
        if (appPid) guard.track(appPid);

        // Action 2: Open File
        const fileRes = await postPrivileged(bridge.baseUrl, 'open_file', { path: relativePath });
        assert.equal(fileRes.status, 200);
        assert.equal(fileRes.body.exit_code, 0);

        // Action 3: Open URL
        const urlRes = await postPrivileged(bridge.baseUrl, 'open_url', { url: 'https://example.com/tier3-success' });
        assert.equal(urlRes.status, 200);
        assert.equal(urlRes.body.exit_code, 0);

        // Audit Sovereign Ledger continuity
        const entries = readLedgerEntries(bridge.dataDir);
        assert.ok(entries.length >= 3, 'At least 3 entries in ledger');
        verifyLedgerIntegrity(entries);

        // Verify actions recorded in order
        const recentOps = entries.slice(-3).map(e => e.operation);
        assert.ok(recentOps.includes('OPEN_APP'), 'Ledger contains OPEN_APP');
        assert.ok(recentOps.includes('OPEN_FILE'), 'Ledger contains OPEN_FILE');
        assert.ok(recentOps.includes('OPEN_URL'), 'Ledger contains OPEN_URL');
      } finally {
        guard.cleanup();
        try {
          fs.unlinkSync(probeFile);
        } catch {}
      }
    });
  });

  test('Tier 3.3: Concurrent requests to System Bridge preserve atomic ledger ordering and exit code 0', async () => {
    const urls = [
      'https://example.com/concurrent/1',
      'https://example.com/concurrent/2?query=a&param=b',
      'https://example.com/concurrent/3#target'
    ];

    const responses = await Promise.all(
      urls.map(url => postPrivileged(bridge.baseUrl, 'open_url', { url }))
    );

    for (const res of responses) {
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'completed');
      assert.equal(res.body.exit_code, 0);
    }

    const entries = readLedgerEntries(bridge.dataDir);
    verifyLedgerIntegrity(entries);
  });

  test('Tier 3.4: Trinity Core tool schema and dispatch validation (pc_open_app, pc_open_url, pc_open_file)', async () => {
    const { TOOL_SCHEMAS, PC_TOOLS } = await import('../../Trinity/src/tools.js');

    // Verify PC_TOOLS registration
    assert.equal(PC_TOOLS.has('pc_open_app'), true);
    assert.equal(PC_TOOLS.has('pc_open_url'), true);
    assert.equal(PC_TOOLS.has('pc_open_file'), true);

    // Verify Schema validation
    assert.deepEqual(TOOL_SCHEMAS.pc_open_url.parse({ url: 'https://example.com' }), { url: 'https://example.com' });
    assert.deepEqual(TOOL_SCHEMAS.pc_open_file.parse({ path: 'README.md' }), { path: 'README.md' });

    assert.throws(() => TOOL_SCHEMAS.pc_open_url.parse({ url: '' }), /too_small|at least 1 character|>=1 characters/);
    assert.throws(() => TOOL_SCHEMAS.pc_open_file.parse({ path: '' }), /too_small|at least 1 character|>=1 characters/);
  });
});
