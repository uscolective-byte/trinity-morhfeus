#!/usr/bin/env node
// Read-only independent chain verification. No signer, private keys, or broadcasts.
import { Contract, JsonRpcProvider, getAddress, keccak256 } from 'ethers';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TREASURY = '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e';
export const SUPPLY = 1_000_000_000n * 10n ** 18n;
const ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];

export async function verifyTetrakis(provider, options, tokenFactory = (address, rpc) => new Contract(address, ABI, rpc)) {
  const address = getAddress(options.address);
  const treasury = getAddress(options.treasury || TREASURY);
  const expectedChain = BigInt(options.chainId || 84532);
  const network = await provider.getNetwork();
  if (network.chainId !== expectedChain) throw new Error('CHAIN_MISMATCH');
  // Pin all contract reads to one confirmed block rather than mixing latest states.
  const blockNumber = await provider.getBlockNumber();
  const code = await provider.getCode(address, blockNumber);
  if (!/^0x[0-9a-f]+$/i.test(code) || code.length <= 2) throw new Error('NO_DEPLOYED_CONTRACT');
  const runtimeHash = keccak256(code);
  if (options.expectedRuntimeHash && runtimeHash.toLowerCase() !== options.expectedRuntimeHash.toLowerCase()) {
    throw new Error('RUNTIME_BYTECODE_MISMATCH');
  }
  const token = tokenFactory(address, provider);
  const at = { blockTag: blockNumber };
  const [name, symbol, decimals, totalSupply, treasuryBalance] = await Promise.all([
    token.name(at), token.symbol(at), token.decimals(at), token.totalSupply(at), token.balanceOf(treasury, at)
  ]);
  if (name !== 'Tetrakis' || symbol !== 'TTK' || decimals !== 18n || totalSupply !== SUPPLY) {
    throw new Error('TOKEN_METADATA_OR_SUPPLY_MISMATCH');
  }
  if (options.expectInitialAllocation && treasuryBalance !== SUPPLY) throw new Error('INITIAL_ALLOCATION_MISMATCH');
  let transaction = null;
  if (options.transactionHash) {
    const receipt = await provider.getTransactionReceipt(options.transactionHash);
    if (!receipt || receipt.status !== 1 || !receipt.contractAddress || getAddress(receipt.contractAddress) !== address) {
      throw new Error('DEPLOYMENT_RECEIPT_MISMATCH');
    }
    if (receipt.blockNumber > blockNumber) throw new Error('RECEIPT_NEWER_THAN_VERIFICATION_BLOCK');
    transaction = { hash: receipt.hash, blockNumber: receipt.blockNumber, status: receipt.status };
  }
  return {
    ok: true, chainId: Number(network.chainId), network: expectedChain === 84532n ? 'Base Sepolia TESTNET' : 'explicitly selected network',
    contractAddress: address, treasury, blockNumber, runtimeHash,
    bytecodeMatched: Boolean(options.expectedRuntimeHash),
    name, symbol, decimals: Number(decimals), totalSupply: totalSupply.toString(), treasuryBalance: treasuryBalance.toString(),
    initialAllocationChecked: Boolean(options.expectInitialAllocation), transaction,
    checkedAt: new Date().toISOString(),
    limitation: 'Metadata alone does not establish source-code security, private-key control, price, liquidity, or economic value.'
  };
}

async function main(args) {
  if (args.includes('--help')) {
    console.log('Read-only: node scripts/verify-tetrakis.mjs --address <contract> [--rpc <url>] [--chain-id 84532] [--artifact <json>] [--transaction <hash>] [--expect-initial-allocation]');
    return;
  }
  const options = {};
  const keys = { '--address': 'address', '--rpc': 'rpc', '--chain-id': 'chainId', '--artifact': 'artifact', '--transaction': 'transactionHash' };
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--expect-initial-allocation') { options.expectInitialAllocation = true; continue; }
    if (!keys[key] || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('INVALID_ARGUMENTS');
    options[keys[key]] = args[++i];
  }
  if (!options.address) throw new Error('CONTRACT_ADDRESS_REQUIRED');
  if (options.artifact) {
    const artifact = JSON.parse(readFileSync(resolve(options.artifact), 'utf8'));
    const runtime = typeof artifact.deployedBytecode === 'string' ? artifact.deployedBytecode : artifact.deployedBytecode?.object;
    if (!runtime || !/^(0x)?[0-9a-f]+$/i.test(runtime)) throw new Error('ARTIFACT_RUNTIME_BYTECODE_REQUIRED');
    options.expectedRuntimeHash = keccak256(runtime.startsWith('0x') ? runtime : '0x' + runtime);
  }
  const provider = new JsonRpcProvider(options.rpc || 'https://sepolia.base.org', undefined, { batchMaxCount: 1 });
  try { console.log(JSON.stringify(await verifyTetrakis(provider, options), null, 2)); }
  finally { provider.destroy(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(() => {
    // Avoid printing RPC URLs/errors that may contain provider credentials.
    console.error(JSON.stringify({ ok: false, error: 'VERIFICATION_FAILED', hint: 'Check chain, contract, receipt and local runtime artifact. No transaction was sent.' }));
    process.exitCode = 1;
  });
}
