/**
 * @module TRINITY_CRYPTO_CORE
 * @subsystem PROOF_OF_EXECUTION_CONSENSUS
 * @author Basterix (Root Architect) & Antigravity
 * @license Sovereign Irrevocable Covenant
 * @description Modul proof-of-execution.js v ekosystéme TRINITY OMNI-CORE v11.3 / v12.0.
 * Implementuje Proof-of-Execution (PoE) a Merkle Tree kompresiu pre Sovereign Ledger.
 */

import { keccak_256 } from '@noble/hashes/sha3.js';



function bytesToHex(bytes) {
  return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function hashLeaf(receipt) {
  const serialized = JSON.stringify({
    taskId: String(receipt.taskId || ''),
    agentId: String(receipt.agentId || 'trinity-core'),
    caller: String(receipt.caller || 'sovereign-root'),
    gasUnits: Number(receipt.gasUnits || 0),
    exitCode: Number(receipt.exitCode ?? 0),
    payloadHash: String(receipt.payloadHash || '0x0'),
    timestamp: Number(receipt.timestamp || 0)
  });
  return bytesToHex(keccak_256(new TextEncoder().encode(serialized)));
}

export function hashNode(leftHex, rightHex) {
  // Sort pairs to make tree order-independent (canonical Merkle tree)
  const [a, b] = [leftHex.toLowerCase(), rightHex.toLowerCase()].sort();
  const combined = new Uint8Array([...hexToBytes(a), ...hexToBytes(b)]);
  return bytesToHex(keccak_256(combined));
}

export class MerkleExecutionTree {
  constructor(receipts = []) {
    this.receipts = receipts;
    this.leaves = receipts.map(hashLeaf);
    this.levels = [];
    this.buildTree();
  }

  buildTree() {
    if (this.leaves.length === 0) {
      this.root = '0x' + '0'.repeat(64);
      this.levels = [[]];
      return;
    }

    let currentLevel = [...this.leaves];
    this.levels = [currentLevel];

    while (currentLevel.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          nextLevel.push(hashNode(currentLevel[i], currentLevel[i + 1]));
        } else {
          // Odd leaf is hashed with itself
          nextLevel.push(hashNode(currentLevel[i], currentLevel[i]));
        }
      }
      this.levels.push(nextLevel);
      currentLevel = nextLevel;
    }

    this.root = currentLevel[0];
  }

  getRoot() {
    return this.root;
  }

  getProof(leafIndex) {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error(`INDEX_OUT_OF_BOUNDS: ${leafIndex}`);
    }

    const proof = [];
    let currentIndex = leafIndex;

    for (let levelIndex = 0; levelIndex < this.levels.length - 1; levelIndex++) {
      const currentLevel = this.levels[levelIndex];
      const isEven = currentIndex % 2 === 0;
      const siblingIndex = isEven ? currentIndex + 1 : currentIndex - 1;

      if (siblingIndex < currentLevel.length) {
        proof.push({
          position: isEven ? 'right' : 'left',
          hash: currentLevel[siblingIndex]
        });
      } else {
        // Paired with self
        proof.push({
          position: 'right',
          hash: currentLevel[currentIndex]
        });
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
  }
}

export function verifyMerkleProof(leafHash, proof, rootHash) {
  let currentHash = leafHash;
  for (const step of proof) {
    if (step.position === 'right') {
      currentHash = hashNode(currentHash, step.hash);
    } else {
      currentHash = hashNode(step.hash, currentHash);
    }
  }
  return currentHash.toLowerCase() === rootHash.toLowerCase();
}

export function createExecutionReceipt({ taskId, agentId, caller, gasUnits, exitCode, payload, timestamp }) {
  const payloadHash = bytesToHex(keccak_256(new TextEncoder().encode(typeof payload === 'string' ? payload : JSON.stringify(payload ?? {}))));
  const receipt = {
    taskId: taskId || crypto.randomUUID(),
    agentId: agentId || 'generic-agent',
    caller: caller || 'sovereign-root',
    gasUnits: Math.max(1, Number(gasUnits || 10)),
    exitCode: Number(exitCode ?? 0),
    payloadHash,
    timestamp: timestamp || Date.now()
  };
  receipt.receiptHash = hashLeaf(receipt);
  return receipt;
}

export function verifyExecutionReceipt(receipt, { requireSuccess = true } = {}) {
  try {
    if (!receipt || typeof receipt !== 'object') return { ok: false, reason: 'INVALID_RECEIPT' };
    if (!/^0x[0-9a-f]{64}$/i.test(String(receipt.payloadHash || ''))) return { ok: false, reason: 'INVALID_PAYLOAD_HASH' };
    if (!/^0x[0-9a-f]{64}$/i.test(String(receipt.receiptHash || ''))) return { ok: false, reason: 'INVALID_RECEIPT_HASH' };
    const gasUnits = Number(receipt.gasUnits);
    const exitCode = Number(receipt.exitCode);
    const timestamp = Number(receipt.timestamp);
    if (!Number.isSafeInteger(gasUnits) || gasUnits < 0 || !Number.isSafeInteger(exitCode) || exitCode < 0 || !Number.isSafeInteger(timestamp) || timestamp < 0) {
      return { ok: false, reason: 'INVALID_RECEIPT_FIELDS' };
    }
    const leafHash = hashLeaf(receipt);
    if (leafHash.toLowerCase() !== String(receipt.receiptHash).toLowerCase()) return { ok: false, reason: 'RECEIPT_HASH_MISMATCH' };
    if (requireSuccess && exitCode !== 0) return { ok: false, reason: 'EXECUTION_FAILED', leafHash };
    return { ok: true, successful: exitCode === 0, leafHash };
  } catch {
    return { ok: false, reason: 'INVALID_RECEIPT' };
  }
}
