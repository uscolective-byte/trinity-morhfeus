/**
 * @module tests/e2e/bridge-test-harness.mjs
 * @description Test Harness for running isolated System Bridge server and verifying Truth Policy 2.1 receipts.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSystemBridgeServer } from '../../Local-Gateway/src/system-bridge.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const workspaceRoot = path.resolve(__dirname, '..', '..');

export const TEST_BRIDGE_TOKEN = process.env.TRINITY_BRIDGE_TOKEN || 'test-bridge-token-7788';
process.env.TRINITY_BRIDGE_TOKEN = TEST_BRIDGE_TOKEN;

/**
 * Creates and starts an isolated instance of the Trinity System Bridge on a dynamic OS port.
 * @returns {Promise<{ server: any, baseUrl: string, dataDir: string, stop: () => Promise<void> }>}
 */
export async function startTestBridge() {
  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trinity-e2e-bridge-'));
  const server = await createSystemBridgeServer({ port: 0, dataDir: tmpDataDir });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    server,
    baseUrl,
    dataDir: tmpDataDir,
    async stop() {
      await new Promise(resolve => server.close(resolve));
      try {
        fs.rmSync(tmpDataDir, { recursive: true, force: true });
      } catch {}
    }
  };
}

/**
 * Execute a privileged action on the system bridge with valid credentials.
 * @param {string} baseUrl
 * @param {string} action
 * @param {object} payload
 * @param {object} [customHeaders]
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function postPrivileged(baseUrl, action, payload = {}, customHeaders = {}) {
  let attempts = 0;
  while (attempts < 3) {
    try {
      const res = await fetch(`${baseUrl}/api/execute-privileged`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Connection': 'close',
          'X-Trinity-Bridge-Token': TEST_BRIDGE_TOKEN,
          ...customHeaders
        },
        body: JSON.stringify({
          action,
          payload
        })
      });

      const body = await res.json().catch(() => null);
      return {
        status: res.status,
        body
      };
    } catch (err) {
      attempts++;
      if (attempts >= 3 || (err.code !== 'ECONNRESET' && err.cause?.code !== 'ECONNRESET')) {
        throw err;
      }
      await new Promise(r => setTimeout(r, 150));
    }
  }
}

/**
 * Read and parse all ledger records from the bridge's local data directory.
 * @param {string} dataDir
 * @returns {Array<object>} Parsed ledger entries
 */
export function readLedgerEntries(dataDir) {
  const ledgerFile = path.join(dataDir, 'sovereign-bridge-ledger.jsonl');
  if (!fs.existsSync(ledgerFile)) return [];
  const lines = fs.readFileSync(ledgerFile, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  return lines.map(line => JSON.parse(line));
}

/**
 * Verify cryptographic hash integrity across the ledger (Truth Policy 2.1).
 * @param {Array<object>} entries
 * @returns {boolean}
 */
export function verifyLedgerIntegrity(entries) {
  if (!entries || entries.length === 0) return true;
  let prevHash = '0'.repeat(64);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.index !== i + 1) {
      throw new Error(`Ledger index mismatch at block ${i + 1}: got ${entry.index}`);
    }
    if (entry.prev_hash !== prevHash) {
      throw new Error(`Ledger hash broken at block ${i + 1}: expected prev_hash ${prevHash}, got ${entry.prev_hash}`);
    }
    if (!/^[a-f0-9]{64}$/.test(entry.block_hash)) {
      throw new Error(`Invalid block_hash at block ${i + 1}: ${entry.block_hash}`);
    }
    if (!entry.receipt_id?.startsWith('TRN-LCL-V3-')) {
      throw new Error(`Invalid receipt_id format at block ${i + 1}: ${entry.receipt_id}`);
    }
    prevHash = entry.block_hash;
  }
  return true;
}
