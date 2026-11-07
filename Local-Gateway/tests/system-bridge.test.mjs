import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createSystemBridgeServer } from '../src/system-bridge.mjs';
import { inspectWindowsSession } from '../src/trinity-auth-core.mjs';

test('System Bridge (Port 7788): /api/status vracia ONLINE s overeným Windows SID Basterixa a /api/omnidev/diagnose opravuje OmniDev Studio', async () => {
  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trinity-bridge-7788-'));
  const nativeSession = inspectWindowsSession();
  const windowsSession = nativeSession.authenticated
    ? null
    : {
        username: 'saboi',
        domain: 'basterix-pc',
        sid: 'S-1-5-21-3847291048-1928374650-2837465910-1001',
        osTokenVerified: true
      };
  const server = await createSystemBridgeServer({ port: 0, dataDir: tmpDataDir, windowsSession });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Test /api/status
    const statusRes = await fetch(`${baseUrl}/api/status`);
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.equal(statusData.status, 'ONLINE');
    assert.equal(statusData.omnidev_studio.status, 'READY');
    assert.equal(statusData.root_registry.architect_alias, 'Basterix');

    // 2. Test /api/omnidev/diagnose
    const diagRes = await fetch(`${baseUrl}/api/omnidev/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        errorText: 'SyntaxError: Expected corresponding JSX closing tag for <div> at Studio.jsx:14:5',
        filePath: 'Trinity/src/studio.js',
        sourceCode: 'export function App() { return <div><span>OmniDev</span>; }'
      })
    });
    assert.equal(diagRes.status, 200);
    const diagData = await diagRes.json();
    assert.equal(diagData.status, 'DIAGNOSED');
    assert.equal(diagData.omnidev_studio, 'RECOVERED');
    assert.equal(diagData.diagnosis.category, 'UNCLOSED_TAG_OR_JSX');
    assert.ok(diagData.recoveryPlan.gitDiff.includes('--- a/Trinity/src/studio.js'));

    // 3. Test zablokovania podvrhnutého emailu bez tokenu na /api/execute-privileged
    const blockedRes = await fetch(`${baseUrl}/api/execute-privileged`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'saboivan2008@gmail.com',
        action: 'READ_WORKSPACE'
      })
    });
    assert.equal(blockedRes.status, 403);
    const blockedData = await blockedRes.json();
    assert.match(blockedData.error, /ACCESS DENIED.*UNVERIFIED_GOOGLE_OAUTH_TOKEN/);

    // 4. Test zablokovania volania bez X-Trinity-Bridge-Token aj bez emailu (Fail-Closed HTTP Header Gate)
    const noTokenRes = await fetch(`${baseUrl}/api/execute-privileged`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'e2e_truth_verify'
      })
    });
    assert.equal(noTokenRes.status, 403);

    // 5. Pozitívny test s platným TRINITY_BRIDGE_TOKEN + overeným Windows SID Basterixa + zápis do lokálneho Sovereign Ledgeru
    process.env.TRINITY_BRIDGE_TOKEN = process.env.TRINITY_BRIDGE_TOKEN || 'test-bridge-token-7788';
    const validRes = await fetch(`${baseUrl}/api/execute-privileged`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Trinity-Bridge-Token': process.env.TRINITY_BRIDGE_TOKEN
      },
      body: JSON.stringify({
        action: 'e2e_truth_verify',
        payload: {}
      })
    });
    assert.equal(validRes.status, 200);
    const validData = await validRes.json();
    assert.equal(validData.status, 'completed');
    assert.equal(validData.exit_code, 0);
    assert.equal(validData.os_token_verified, true);
    assert.match(validData.windows_sid, /^S-1-5-21-\d+-\d+-\d+-\d+$/);
    assert.ok(validData.local_ledger_receipt.receipt_id.startsWith('TRN-LCL-V3-'));
    assert.equal(validData.local_ledger_receipt.block_hash.length, 64);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
