#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { hashLeaf } from '../../packages/crypto-core/src/proof-of-execution.js';
import { verifyMmrProof } from '../../packages/crypto-core/src/merkle-mountain-range.js';

function usage() {
  console.error('Usage: node docs/scripts/verify-mmr-proof.mjs <receipt.json> <proof.json> <trusted-root-hex> <leaf-index>');
  process.exit(2);
}

const [receiptPath, proofPath, trustedRoot, leafIndexText] = process.argv.slice(2);
if (!receiptPath || !proofPath || !trustedRoot || leafIndexText === undefined) usage();

const leafIndex = Number(leafIndexText);
if (!Number.isSafeInteger(leafIndex) || leafIndex < 0) usage();
if (!/^0x[0-9a-f]{64}$/i.test(trustedRoot)) usage();

const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
const proofDocument = JSON.parse(await readFile(proofPath, 'utf8'));
const proof = proofDocument.proof ?? proofDocument;

if (proof.leafIndex !== leafIndex) {
  console.error(JSON.stringify({ ok: false, reason: 'LEAF_INDEX_MISMATCH', expected: leafIndex, actual: proof.leafIndex }));
  process.exit(1);
}

const leafHash = hashLeaf(receipt);
const valid = verifyMmrProof(leafHash, proof, trustedRoot);
if (!valid) {
  console.error(JSON.stringify({ ok: false, reason: 'MMR_PROOF_INVALID', leafIndex, leafHash }));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  leafIndex,
  leafCount: proof.leafCount,
  leafHash,
  trustedRoot,
  proofFormat: proof.format,
  note: 'Inclusion verified against the supplied trusted root; root signature/trust-anchor verification is a separate step.'
}, null, 2));
