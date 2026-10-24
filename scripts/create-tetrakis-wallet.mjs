#!/usr/bin/env node
/**
 * Tetrakis ($TTK) - Official Treasury & Deployer Wallet Generator
 * Generates standard BIP-39 mnemonic phrase and deterministic EVM / Web3 keys
 * for the deployment and treasury of the Tetrakis cryptocurrency.
 */

import { ethers } from 'ethers';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const SECRETS_DIR = resolve(ROOT_DIR, '.secrets');
const VAULT_FILE = resolve(SECRETS_DIR, 'tetrakis-treasury.json');

console.log('====================================================');
console.log('🏛️  TETRAKIS ($TTK) - GENERÁTOR SKUTOČNEJ KRYPTO PEŇAŽENKY');
console.log('====================================================\n');

if (!existsSync(SECRETS_DIR)) {
  mkdirSync(SECRETS_DIR, { recursive: true });
}

if (existsSync(VAULT_FILE)) {
  console.log(`⚠️  Pozor: Trezor peňaženky Tetrakis už existuje na disku:\n   ${VAULT_FILE}`);
  console.log('   Aby sme predišli náhodnému prepísaniu už existujúcich kľúčov, načíta sa existujúca peňaženka.\n');
  const existing = JSON.parse(await import('node:fs').then(fs => fs.readFileSync(VAULT_FILE, 'utf8')));
  printWalletSummary(existing);
  process.exit(0);
}

console.log('⏳ Generujem novú kryptograficky bezpečnú peňaženku (BIP-39 CSPRNG)...');

// Generate 12-word BIP-39 random mnemonic wallet
const wallet = ethers.Wallet.createRandom();

const vaultData = {
  asset_name: 'Tetrakis',
  symbol: 'TTK',
  created_at: new Date().toISOString(),
  purpose: 'Tetrakis Token Deployer, Liquidity Pool Provider & Trinity Mastermind Treasury',
  wallet: {
    address: wallet.address,
    derivation_path: wallet.path || "m/44'/60'/0'/0/0",
    mnemonic_phrase: wallet.mnemonic.phrase,
    private_key: wallet.privateKey
  },
  supported_networks: [
    { name: 'Base (Coinbase L2)', chain_id: 8453, gas_cost: '< $0.01', recommended: true },
    { name: 'Arbitrum One', chain_id: 42161, gas_cost: '< $0.05', recommended: true },
    { name: 'Polygon PoS', chain_id: 137, gas_cost: '< $0.02', recommended: true },
    { name: 'BNB Smart Chain', chain_id: 56, gas_cost: '< $0.10', recommended: false },
    { name: 'Ethereum Mainnet', chain_id: 1, gas_cost: '$5 - $25', recommended: false },
    { name: 'Base Sepolia Testnet', chain_id: 84532, gas_cost: 'ZADARMO (Faucet)', recommended: true }
  ]
};

// Save to protected local secrets file
writeFileSync(VAULT_FILE, JSON.stringify(vaultData, null, 2), { mode: 0o600 });
console.log(`✅ Peňaženka bola úspešne vygenerovaná a bezpečne uložená do:`);
console.log(`   ${VAULT_FILE}\n`);

printWalletSummary(vaultData);

function printWalletSummary(data) {
  console.log('----------------------------------------------------');
  console.log('💎 DETAILY PEŇAŽENKY PRE TETRAKIS:');
  console.log('----------------------------------------------------');
  console.log(`📌 Verejná Adresa (Public Address / Treasury):`);
  console.log(`   ${data.wallet.address}\n`);
  console.log(`🔑 Derivačná cesta: ${data.wallet.derivation_path}`);
  console.log(`📜 Seed Fráza (12 slov pre import do MetaMask / Rabby):`);
  console.log(`   "${data.wallet.mnemonic_phrase}"\n`);
  console.log(`🔒 Privátny kľúč:`);
  console.log(`   ${data.wallet.private_key}\n`);
  console.log('----------------------------------------------------');
  console.log('🛡️  BEZPEČNOSTNÉ PRAVIDLÁ:');
  console.log('1. Týchto 12 slov si opíš na bezpečný papier.');
  console.log('2. Nikdy nezdieľaj privátny kľúč s nikým cudzím.');
  console.log('3. Súbor .secrets/ je chránený v .gitignore a nedostane sa na GitHub.');
  console.log('4. Túto peňaženku môžeš ihneď importovať do MetaMasku alebo Rabby cez Seed frázu.');
  console.log('====================================================\n');
}
