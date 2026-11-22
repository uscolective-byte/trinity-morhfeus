import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createExecutionReceipt,
  hashLeaf,
  MerkleExecutionTree,
  verifyMerkleProof
} from '../src/proof-of-execution.js';

test('Proof-of-Execution: receipt generates valid deterministic hash', () => {
  const receipt = createExecutionReceipt({
    taskId: 'task-001',
    agentId: 'jericho123',
    caller: 'basterix-sovereign',
    gasUnits: 150,
    exitCode: 0,
    payload: { action: 'market_arbitrage_scan', spread: 0.045 }
  });

  assert.equal(receipt.taskId, 'task-001');
  assert.equal(receipt.agentId, 'jericho123');
  assert.match(receipt.payloadHash, /^0x[0-9a-f]{64}$/i);
  assert.match(receipt.receiptHash, /^0x[0-9a-f]{64}$/i);
  assert.equal(receipt.receiptHash, hashLeaf(receipt));
});

test('Proof-of-Execution: Merkle tree builds root and verifies inclusion proof', () => {
  const receipts = [
    createExecutionReceipt({ taskId: 'task-1', agentId: 'aura_codegen', exitCode: 0 }),
    createExecutionReceipt({ taskId: 'task-2', agentId: 'aura_tester', exitCode: 0 }),
    createExecutionReceipt({ taskId: 'task-3', agentId: 'jericho123', exitCode: 0 }),
    createExecutionReceipt({ taskId: 'task-4', agentId: 'trinity-guardian', exitCode: 0 }),
    createExecutionReceipt({ taskId: 'task-5', agentId: 'aura_deployer', exitCode: 0 })
  ];

  const tree = new MerkleExecutionTree(receipts);
  const root = tree.getRoot();

  assert.match(root, /^0x[0-9a-f]{64}$/i);

  // Overenie proofu pre každý jeden bloček
  for (let i = 0; i < receipts.length; i++) {
    const leafHash = receipts[i].receiptHash;
    const proof = tree.getProof(i);
    const isValid = verifyMerkleProof(leafHash, proof, root);
    assert.ok(isValid, `Proof pre index ${i} musí byť platný`);
  }
});

test('Proof-of-Execution: rejects tampered receipt or wrong root', () => {
  const r1 = createExecutionReceipt({ taskId: 't1', gasUnits: 100, exitCode: 0 });
  const r2 = createExecutionReceipt({ taskId: 't2', gasUnits: 200, exitCode: 0 });

  const tree = new MerkleExecutionTree([r1, r2]);
  const root = tree.getRoot();
  const proof = tree.getProof(0);

  // 1. Zmanipulovaný leaf (iný exitCode alebo zmenené gasUnits)
  const tamperedReceipt = { ...r1, exitCode: 1 };
  const tamperedHash = hashLeaf(tamperedReceipt);
  assert.equal(verifyMerkleProof(tamperedHash, proof, root), false, 'Zmanipulovaný receipt musí zlyhať');

  // 2. Falošný root
  const fakeRoot = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  assert.equal(verifyMerkleProof(r1.receiptHash, proof, fakeRoot), false, 'Cudzie Merkle Root musí zlyhať');
});

test('Proof-of-Execution: MMR Epoch Compression compresses 100 receipts into single epoch root', () => {
  const batch = [];
  for (let i = 0; i < 100; i++) {
    batch.push(createExecutionReceipt({
      taskId: `epoch-task-${i}`,
      agentId: i % 2 === 0 ? 'jericho123' : 'aura_sentinel',
      gasUnits: 50 + (i % 10) * 10,
      exitCode: 0
    }));
  }

  const tree = new MerkleExecutionTree(batch);
  const epochRoot = tree.getRoot();

  assert.match(epochRoot, /^0x[0-9a-f]{64}$/i);

  // V D1 databáze namiesto 100 transakčných záznamov stačí uložiť epoch_root_hash + interval taskov
  const compressedRecord = {
    epoch: 1,
    taskCount: batch.length,
    startTask: batch[0].taskId,
    endTask: batch[batch.length - 1].taskId,
    epochRootHash: epochRoot,
    timestamp: Date.now()
  };

  assert.equal(compressedRecord.taskCount, 100);
  assert.ok(verifyMerkleProof(batch[42].receiptHash, tree.getProof(42), compressedRecord.epochRootHash));
});

test('Proof-of-Execution: rejects failed or tampered receipts before a success claim', async () => {
  const { verifyExecutionReceipt } = await import('../src/proof-of-execution.js');
  const success = createExecutionReceipt({ taskId: 'task-success', exitCode: 0, payload: { result: 'ok' } });
  assert.equal(verifyExecutionReceipt(success).ok, true);

  const failed = createExecutionReceipt({ taskId: 'task-failed', exitCode: 1, payload: { error: 'failed' } });
  assert.equal(verifyExecutionReceipt(failed).ok, false);
  assert.equal(verifyExecutionReceipt(failed, { requireSuccess: false }).successful, false);

  const tampered = { ...success, gasUnits: success.gasUnits + 1 };
  assert.equal(verifyExecutionReceipt(tampered).reason, 'RECEIPT_HASH_MISMATCH');
});
