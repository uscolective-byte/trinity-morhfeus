import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTetrakisStatus,
  encodeTtkTransfer,
  parseTtkAmount,
  TTK_RUNTIME_KECCAK256,
  TTK_TOKEN
} from '../src/crypto-value-engine.js';

const artifact = JSON.parse(readFileSync(new URL('../../contracts/tetrakis/build/TetrakisToken.json', import.meta.url), 'utf8'));
const contractAddress = '0x4d308452a96d7dabfd2f33d92677a3a2724f387e';
const recipient = '0x7e17f9072cfcbc7fe45973de0f11ec8db99281e4';

test('TTK amount parser uses exact 18-decimal integer units', () => {
  assert.equal(TTK_TOKEN.totalSupply, 1_000_000_000n);
  assert.equal(parseTtkAmount('1'), 10n ** 18n);
  assert.equal(parseTtkAmount('1.000000000000000001'), 10n ** 18n + 1n);
  assert.equal(parseTtkAmount('1000000000'), 1_000_000_000n * 10n ** 18n);
});

test('TTK amount parser rejects zero, malformed precision and values above supply', () => {
  assert.throws(() => parseTtkAmount('0'), /väčšia ako nula|mimo povoleného rozsahu/);
  assert.throws(() => parseTtkAmount('1.0000000000000000001'), /18 desatinnými miestami/);
  assert.throws(() => parseTtkAmount('1000000001'), /celkovú zásobu/);
  assert.throws(() => parseTtkAmount('-1'), /18 desatinnými miestami/);
});

test('ERC-20 transfer calldata encodes the exact recipient and amount', () => {
  const units = parseTtkAmount('25.5');
  const data = encodeTtkTransfer(recipient, units);
  assert.equal(data.slice(0, 10), '0xa9059cbb');
  assert.equal(data.length, 138);
  assert.ok(data.toLowerCase().includes(recipient.slice(2).toLowerCase()));
  assert.equal(BigInt(`0x${data.slice(-64)}`), units);
  assert.throws(() => encodeTtkTransfer('0x0000000000000000000000000000000000000000', units), /platnú EVM adresu/);
});

test('TTK payment stays disabled when deployment configuration is missing', async () => {
  let calls = 0;
  const status = await getTetrakisStatus({}, { fetchImpl: async () => { calls++; throw new Error('must not call RPC'); } });
  assert.equal(status.deployment_status, 'not_configured');
  assert.equal(status.market_price, null);
  assert.equal(status.market_price_status, 'unavailable');
  assert.equal(status.payments.enabled, false);
  assert.equal(calls, 0);
});

test('TTK deployment verification checks chain ID and exact committed runtime hash', async () => {
  assert.equal(artifact.runtimeKeccak256, TTK_RUNTIME_KECCAK256);
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    const result = request.method === 'eth_chainId' ? '0x2105' : artifact.deployedBytecode;
    return { ok: true, json: async () => ({ jsonrpc: '2.0', id: request.id, result }) };
  };
  const status = await getTetrakisStatus({
    TTK_CHAIN_ID: '8453',
    TTK_CONTRACT_ADDRESS: contractAddress,
    TTK_PAYMENT_RECIPIENT: recipient
  }, { fetchImpl });
  assert.equal(status.deployment_status, 'deployed_verified');
  assert.equal(status.contract_address.toLowerCase(), contractAddress);
  assert.equal(status.payments.enabled, true);
  assert.equal(status.payments.recipient.toLowerCase(), recipient);
});

test('TTK payment stays disabled when bytecode or RPC network differs', async () => {
  const env = { TTK_CHAIN_ID: '8453', TTK_CONTRACT_ADDRESS: contractAddress, TTK_PAYMENT_RECIPIENT: recipient };
  const wrongCode = async (_url, options) => {
    const request = JSON.parse(options.body);
    const result = request.method === 'eth_chainId' ? '0x2105' : '0x6000';
    return { ok: true, json: async () => ({ result }) };
  };
  const wrongNetwork = async (_url, options) => {
    const request = JSON.parse(options.body);
    const result = request.method === 'eth_chainId' ? '0x14a34' : artifact.deployedBytecode;
    return { ok: true, json: async () => ({ result }) };
  };
  assert.equal((await getTetrakisStatus(env, { fetchImpl: wrongCode })).deployment_status, 'contract_mismatch');
  assert.equal((await getTetrakisStatus(env, { fetchImpl: wrongNetwork })).deployment_status, 'network_mismatch');
  assert.equal((await getTetrakisStatus({ ...env, TTK_PAYMENT_RECIPIENT: 'invalid' })).payments.enabled, false);
});
