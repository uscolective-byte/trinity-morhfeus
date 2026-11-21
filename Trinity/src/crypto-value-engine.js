import { keccak_256 } from '@noble/hashes/sha3.js';
import { normalizeEvmAddress } from './wallet-terminals.js';

export const TTK_TOKEN = Object.freeze({
  name: 'Tetrakis',
  symbol: 'TTK',
  decimals: 18,
  totalSupply: 1_000_000_000n,
  founderAllocation: 1_000_000n,
  treasuryAllocation: 999_000_000n
});

export const TTK_RUNTIME_KECCAK256 = '0x3d8a3c7a764f1b12aa17052d6d8772e1924a3395c1ffd52024891f5e794bb705';

const NETWORKS = Object.freeze({
  8453: {
    label: 'Base Mainnet',
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org'
  },
  84532: {
    label: 'Base Sepolia',
    rpc: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org'
  }
});

const UINT256_MAX = (1n << 256n) - 1n;
const MAX_TTK_UNITS = TTK_TOKEN.totalSupply * 10n ** BigInt(TTK_TOKEN.decimals);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeHexBytes(value) {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-f]{2})+$/i.test(value)) return null;
  const bytes = new Uint8Array((value.length - 2) / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(value.slice(2 + i * 2, 4 + i * 2), 16);
  return bytes;
}

export function parseTtkAmount(value) {
  const text = String(value ?? '').trim();
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,18})?$/.test(text)) {
    throw new TypeError('Zadaj sumu TTK s najviac 18 desatinnými miestami.');
  }
  const [whole, fraction = ''] = text.split('.');
  const units = BigInt(whole) * 10n ** BigInt(TTK_TOKEN.decimals)
    + BigInt((fraction + '0'.repeat(TTK_TOKEN.decimals)).slice(0, TTK_TOKEN.decimals));
  if (units <= 0n || units > MAX_TTK_UNITS || units > UINT256_MAX) {
    throw new RangeError('Suma musí byť väčšia ako nula a nesmie prekročiť celkovú zásobu TTK.');
  }
  return units;
}

export function encodeTtkTransfer(recipient, amount) {
  const address = normalizeEvmAddress(recipient);
  if (!address || address.toLowerCase() === ZERO_ADDRESS) throw new TypeError('Príjemca nemá platnú EVM adresu.');
  const units = typeof amount === 'bigint' ? amount : parseTtkAmount(amount);
  if (units <= 0n || units > MAX_TTK_UNITS || units > UINT256_MAX) {
    throw new RangeError('Suma TTK je mimo povoleného rozsahu.');
  }
  const addressWord = address.slice(2).toLowerCase().padStart(64, '0');
  const amountWord = units.toString(16).padStart(64, '0');
  return `0xa9059cbb${addressWord}${amountWord}`;
}

async function rpc(fetchImpl, network, method, params) {
  const response = await fetchImpl(network.rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const data = await response.json();
  if (data?.error) throw new Error(data.error.message || 'RPC error');
  return data?.result;
}

function baseStatus(env, status, reason) {
  const chainId = Number(env?.TTK_CHAIN_ID);
  const network = NETWORKS[chainId] || null;
  return {
    token: TTK_TOKEN.name,
    symbol: TTK_TOKEN.symbol,
    decimals: TTK_TOKEN.decimals,
    total_supply: `${TTK_TOKEN.totalSupply.toLocaleString('en-US')} TTK`,
    allocations: {
      founder: `${TTK_TOKEN.founderAllocation.toLocaleString('en-US')} TTK`,
      treasury: `${TTK_TOKEN.treasuryAllocation.toLocaleString('en-US')} TTK`
    },
    network: network?.label || 'Base (nasadenie neoverené)',
    chain_id: network ? chainId : null,
    deployment_status: status,
    deployment_reason: reason,
    contract_address: null,
    runtime_keccak256: null,
    market_price: null,
    market_price_status: 'unavailable',
    payments: {
      enabled: false,
      chain_id: network ? chainId : null,
      network: network?.label || null,
      contract_address: null,
      recipient: null,
      explorer: network?.explorer || null,
      reason
    }
  };
}

export async function getTetrakisStatus(env, { fetchImpl = globalThis.fetch } = {}) {
  const rawChainId = env?.TTK_CHAIN_ID;
  const chainId = rawChainId === undefined || rawChainId === '' ? null : Number(rawChainId);
  const network = chainId === null ? null : NETWORKS[chainId];
  const rawContract = env?.TTK_CONTRACT_ADDRESS;
  const rawRecipient = env?.TTK_PAYMENT_RECIPIENT;
  const contractAddress = rawContract ? normalizeEvmAddress(rawContract) : null;
  const recipient = rawRecipient ? normalizeEvmAddress(rawRecipient) : null;

  if ((rawContract && (!contractAddress || contractAddress.toLowerCase() === ZERO_ADDRESS))
    || (rawRecipient && (!recipient || recipient.toLowerCase() === ZERO_ADDRESS))) {
    return baseStatus(env, 'invalid_configuration', 'Adresa kontraktu alebo platobného príjemcu nemá platný EVM formát.');
  }
  if (chainId !== null && !network) {
    return baseStatus(env, 'invalid_configuration', 'Podporované sú iba Base Mainnet (8453) a Base Sepolia (84532).');
  }
  if (!contractAddress || !network) {
    return baseStatus(env, 'not_configured', 'TTK kontrakt ešte nie je nakonfigurovaný; platby sú vypnuté.');
  }

  let code;
  try {
    const [reportedChain, deployedCode] = await Promise.all([
      rpc(fetchImpl, network, 'eth_chainId', []),
      rpc(fetchImpl, network, 'eth_getCode', [contractAddress, 'latest'])
    ]);
    if (Number(BigInt(reportedChain)) !== chainId) {
      return baseStatus(env, 'network_mismatch', 'RPC odpovedá iným chain ID než nakonfigurovaná sieť. Platby sú vypnuté.');
    }
    code = deployedCode;
  } catch {
    return baseStatus(env, 'verification_unavailable', 'Nasadenie sa teraz nepodarilo overiť cez Base RPC. Platby sú vypnuté.');
  }

  const bytes = decodeHexBytes(code);
  if (!bytes) return baseStatus(env, 'not_deployed', 'Na nakonfigurovanej adrese nie je na tejto Base sieti nasadený kontrakt.');

  const runtimeHash = `0x${bytesToHex(keccak_256(bytes))}`;
  if (runtimeHash !== TTK_RUNTIME_KECCAK256) {
    return baseStatus(env, 'contract_mismatch', 'Nasadený bytecode sa nezhoduje s overeným Tetrakis zdrojom. Platby sú vypnuté.');
  }

  const paymentEnabled = Boolean(recipient);
  const reason = paymentEnabled
    ? 'Bytecode TTK sa zhoduje s overeným zdrojom; peňaženka môže odoslať platbu po potvrdení používateľom.'
    : 'Kontrakt je overený, ale TTK_PAYMENT_RECIPIENT nie je nastavený; platby sú vypnuté.';
  return {
    ...baseStatus(env, 'deployed_verified', reason),
    contract_address: contractAddress,
    runtime_keccak256: runtimeHash,
    payments: {
      enabled: paymentEnabled,
      chain_id: chainId,
      network: network.label,
      contract_address: contractAddress,
      recipient,
      explorer: network.explorer,
      reason
    }
  };
}
