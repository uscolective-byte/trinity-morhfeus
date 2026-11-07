import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// 1. Update Jericho-Worker/src/crypto-engine.js
const cryptoEnginePath = path.resolve(rootDir, 'Jericho-Worker/src/crypto-engine.js');
let engine = fs.readFileSync(cryptoEnginePath, 'utf8');

if (!engine.includes('basterix_wallet')) {
  engine = engine.replace(
    "treasury_wallet: '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e',",
    `basterix_wallet: '0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4',\n  basterix_holding: '1,000,000 TTK',\n  treasury_wallet: '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e',`
  );
  fs.writeFileSync(cryptoEnginePath, engine, 'utf8');
  console.log('Updated Jericho-Worker/src/crypto-engine.js');
}

// 2. Update Jericho-Worker/src/index.js
const indexPath = path.resolve(rootDir, 'Jericho-Worker/src/index.js');
let indexJs = fs.readFileSync(indexPath, 'utf8');

const target = '<!-- Treasury Wallets -->';
const basterixCard = `<!-- Basterix Founder Wallet -->
      <div class="box" style="border: 1px solid rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.05);">
        <div class="box-title">
          <span style="color: #10b981;">👑 Basterix Sovereign Founder Peňaženka</span>
          <span style="font-size: 0.8rem; color: #34d399; font-weight: 600;">1 000 000 TTK (GENESIS)</span>
        </div>
        <div class="wallet-field">
          <div class="wallet-label">Osobná EVM Peňaženka (Base, Ethereum, Arbitrum)</div>
          <div class="wallet-val" style="color: #38bdf8; font-weight: 600;">0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4</div>
        </div>
        <div class="wallet-field">
          <div class="wallet-label">Staking Tier & Výhody</div>
          <div style="color: #cbd5e1; font-size: 0.85rem;">Tier 3 · Sovereign Mastermind (Podiel na ziskoch Trinity, prioritná fronta)</div>
        </div>
      </div>

      <!-- Treasury Wallets -->`;

if (indexJs.includes(target) && !indexJs.includes('Basterix Sovereign Founder')) {
  indexJs = indexJs.replace(target, basterixCard);
  fs.writeFileSync(indexPath, indexJs, 'utf8');
  console.log('Successfully injected Basterix Founder Box into Jericho dashboard');
}
