import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyTetrakis, TREASURY, SUPPLY } from './verify-tetrakis.mjs';
import { keccak256 } from 'ethers';
const ADDRESS = '0x1111111111111111111111111111111111111111';
const CODE = '0x60006000';
function fixture(overrides = {}) {
  const reads = [];
  const provider = {
    async getNetwork() { return { chainId: 84532n }; },
    async getBlockNumber() { return 123; },
    async getCode(_address, block) { assert.equal(block, 123); return CODE; },
    async getTransactionReceipt(hash) { return { status: 1, contractAddress: ADDRESS, blockNumber: 120, hash }; },
    ...overrides
  };
  const values = { name: 'Tetrakis', symbol: 'TTK', decimals: 18n, totalSupply: SUPPLY, balanceOf: SUPPLY };
  const factory = () => Object.fromEntries(Object.keys(values).map(key => [key, async (...args) => {
    reads.push({ key, args });
    return values[key];
  }]));
  return { provider, values, factory, reads };
}

test('checks token, initial allocation, receipt and runtime against one block', async () => {
  const f = fixture();
  const result = await verifyTetrakis(f.provider, { address: ADDRESS, expectInitialAllocation: true, expectedRuntimeHash: keccak256(CODE), transactionHash: '0xabc' }, f.factory);
  assert.equal(result.ok, true);
  assert.equal(result.network, 'Base Sepolia TESTNET');
  assert.equal(result.bytecodeMatched, true);
  assert.equal(result.treasury, TREASURY);
  assert.equal(result.totalSupply, SUPPLY.toString());
  for (const read of f.reads) assert.deepEqual(read.args.at(-1), { blockTag: 123 });
});

test('rejects incorrect chain before reading any contract', async () => {
  const f = fixture({ async getNetwork() { return { chainId: 8453n }; }, async getCode() { assert.fail('wrong chain must stop first'); } });
  await assert.rejects(verifyTetrakis(f.provider, { address: ADDRESS }, f.factory), /CHAIN_MISMATCH/);
});

test('rejects treasury EOA or undeployed address', async () => {
  const f = fixture({ async getCode() { return '0x'; } });
  await assert.rejects(verifyTetrakis(f.provider, { address: ADDRESS }, f.factory), /NO_DEPLOYED_CONTRACT/);
});

test('rejects matching metadata with different runtime bytecode', async () => {
  const f = fixture();
  await assert.rejects(verifyTetrakis(f.provider, { address: ADDRESS, expectedRuntimeHash: keccak256('0x01') }, f.factory), /RUNTIME_BYTECODE_MISMATCH/);
});

test('rejects incorrect total supply', async () => {
  const f = fixture(); f.values.totalSupply = SUPPLY + 1n;
  await assert.rejects(verifyTetrakis(f.provider, { address: ADDRESS }, f.factory), /TOKEN_METADATA_OR_SUPPLY_MISMATCH/);
});

test('rejects failed or unrelated deployment receipt', async () => {
  const f = fixture({ async getTransactionReceipt() { return { status: 0, contractAddress: ADDRESS, blockNumber: 120 }; } });
  await assert.rejects(verifyTetrakis(f.provider, { address: ADDRESS, transactionHash: '0xabc' }, f.factory), /DEPLOYMENT_RECEIPT_MISMATCH/);
});

test('does not confuse later treasury transfers with invalid total supply', async () => {
  const f = fixture(); f.values.balanceOf = SUPPLY - 5n;
  const result = await verifyTetrakis(f.provider, { address: ADDRESS }, f.factory);
  assert.equal(result.ok, true); assert.equal(result.initialAllocationChecked, false);
  await assert.rejects(verifyTetrakis(f.provider, { address: ADDRESS, expectInitialAllocation: true }, f.factory), /INITIAL_ALLOCATION_MISMATCH/);
});

test('rejects receipt from a block newer than verification snapshot', async () => {
  const f = fixture({ async getTransactionReceipt(hash) { return { status: 1, contractAddress: ADDRESS, blockNumber: 124, hash }; } });
  await assert.rejects(verifyTetrakis(f.provider, { address: ADDRESS, transactionHash: '0xabc' }, f.factory), /RECEIPT_NEWER_THAN_VERIFICATION_BLOCK/);
});
