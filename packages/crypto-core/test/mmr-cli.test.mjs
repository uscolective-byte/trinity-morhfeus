import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createExecutionReceipt } from '../src/proof-of-execution.js';
import { MerkleMountainRange } from '../src/merkle-mountain-range.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const verifier = path.join(repoRoot, 'docs/scripts/verify-mmr-proof.mjs');

test('standalone MMR CLI verifies a receipt inclusion proof against a supplied trusted root', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'trinity-mmr-cli-'));
  try {
    const receipt = createExecutionReceipt({
      taskId: 'mmr-cli-test',
      agentId: 'test-agent',
      caller: 'test-suite',
      gasUnits: 12,
      exitCode: 0,
      payload: { result: 'ok' },
      timestamp: 1_800_000_000_000
    });
    const mmr = new MerkleMountainRange([receipt.receiptHash]);
    const receiptFile = path.join(directory, 'receipt.json');
    const proofFile = path.join(directory, 'proof.json');
    writeFileSync(receiptFile, JSON.stringify(receipt));
    writeFileSync(proofFile, JSON.stringify(mmr.getProof(0)));

    const output = execFileSync(process.execPath, [
      verifier, receiptFile, proofFile, mmr.getRoot(), '0'
    ], { cwd: repoRoot, encoding: 'utf8' });
    const result = JSON.parse(output);
    assert.equal(result.ok, true);
    assert.equal(result.leafIndex, 0);
    assert.equal(result.trustedRoot, mmr.getRoot());

    assert.throws(() => execFileSync(process.execPath, [
      verifier, receiptFile, proofFile, mmr.getRoot(), '1'
    ], { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
