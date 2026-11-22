import test from 'node:test';
import assert from 'node:assert/strict';
import { MerkleMountainRange, verifyMmrProof, hashMmrLeaf } from '../src/merkle-mountain-range.js';

test('MMR appends leaves, merges peaks and uses the expected compact node count', () => {
  const leaves = Array.from({ length: 7 }, (_, i) => hashMmrLeaf('leaf-' + i));
  const mmr = new MerkleMountainRange(leaves);
  assert.equal(mmr.getNodeCount(), 11);
  assert.deepEqual(mmr.getPeaks().map((peak) => peak.height), [2, 1, 0]);
  assert.match(mmr.getRoot(), /^0x[0-9a-f]{64}$/);
});

test('MMR inclusion proofs verify for every leaf across multiple peaks', () => {
  const leaves = Array.from({ length: 19 }, (_, i) => hashMmrLeaf('receipt-' + i));
  const mmr = new MerkleMountainRange(leaves);
  for (let i = 0; i < leaves.length; i++) {
    assert.equal(verifyMmrProof(leaves[i], mmr.getProof(i), mmr.getRoot()), true, 'leaf ' + i);
  }
});

test('MMR rejects tampered leaves, roots, proof directions and malformed proofs', () => {
  const leaves = Array.from({ length: 9 }, (_, i) => hashMmrLeaf('entry-' + i));
  const mmr = new MerkleMountainRange(leaves);
  const proof = mmr.getProof(4);
  assert.equal(verifyMmrProof(hashMmrLeaf('tampered'), proof, mmr.getRoot()), false);
  assert.equal(verifyMmrProof(leaves[4], proof, hashMmrLeaf('wrong-root')), false);
  assert.equal(verifyMmrProof(leaves[4], { ...proof, siblings: [] }, mmr.getRoot()), false);
  assert.equal(verifyMmrProof(leaves[4], { ...proof, format: 'unknown' }, mmr.getRoot()), false);
});

test('MMR root is order-sensitive and append updates the root', () => {
  const a = hashMmrLeaf('a');
  const b = hashMmrLeaf('b');
  const first = new MerkleMountainRange([a, b]);
  const second = new MerkleMountainRange([b, a]);
  assert.notEqual(first.getRoot(), second.getRoot());
  const oldRoot = first.getRoot();
  first.append(hashMmrLeaf('c'));
  assert.notEqual(first.getRoot(), oldRoot);
  assert.equal(verifyMmrProof(hashMmrLeaf('c'), first.getProof(2), first.getRoot()), true);
});

test('MMR rejects invalid leaf indexes and malformed hashes', () => {
  const mmr = new MerkleMountainRange([hashMmrLeaf('a')]);
  assert.throws(() => mmr.getProof(-1), /INDEX_OUT_OF_BOUNDS/);
  assert.throws(() => mmr.append('0x1234'), /32-byte hex/);
});

