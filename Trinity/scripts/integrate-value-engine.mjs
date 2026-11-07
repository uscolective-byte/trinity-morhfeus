import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// 1. Update Trinity/src/index.js
const indexPath = path.resolve(rootDir, 'src/index.js');
let indexContent = fs.readFileSync(indexPath, 'utf8');

// Add import
if (!indexContent.includes('crypto-value-engine.js')) {
  indexContent = "import {calculateIntrinsicValuation,calculateTtkQuote,VALUATION_MILESTONES,VALUE_MECHANISMS} from './crypto-value-engine.js';\n" + indexContent;
}

// Enhance /api/assistant/crypto/tetrakis and add /api/assistant/crypto/value
const oldRoute = `  if(path==='/api/assistant/crypto/tetrakis'&&request.method==='GET'){
    return json({
      token: 'Tetrakis',
      symbol: 'TTK',
      decimals: 18,
      total_supply: '1,000,000,000 TTK',
      basterix_wallet: '0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4',
      basterix_allocation: '1,000,000 TTK (100% v osobnom držaní)',
      official_treasury: '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e',
      treasury_allocation: '999,000,000 TTK (pre DEX likviditu a ekosystém)',
      network: 'Base Mainnet (Coinbase L2)',
      chain_id: 8453,
      dex_platforms: ['Aerodrome Finance', 'Uniswap v3 (Base)'],
      pair: 'TTK / WETH',
      staking_tiers: [
        { tier: 1, required_ttk: 1000, name: 'Sovereign Explorer', benefits: 'Unlimited chat, knowledge search, and semantic memory' },
        { tier: 2, required_ttk: 10000, name: 'Sovereign Operator', benefits: 'Full PC Bridge remote execution, Azure AI Foundry GPT-4o inference, and skill synthesis' },
        { tier: 3, required_ttk: 50000, name: 'Sovereign Mastermind', benefits: 'Revenue share from Trinity platform transactions, priority agent queue, and autonomous commodity desk' }
      ],
      tokenomics: {
        liquidity_pool: '40% (400,000,000 TTK)',
        agent_ecosystem: '30% (300,000,000 TTK)',
        treasury_reserve: '20% (200,000,000 TTK)',
        founder_core_dev: '10% (100,000,000 TTK)'
      },
      status: 'COMPILED_AND_READY_FOR_BASE_MAINNET_LIQUIDITY',
      basescan: 'https://basescan.org/address/0x4d308452a96D7dAbFd2f33d92677A3a2724f387e'
    });
  }`;

const newRoute = `  if(path==='/api/assistant/crypto/value'&&request.method==='GET'){
    return json({
      valuation: calculateIntrinsicValuation(),
      milestones: VALUATION_MILESTONES,
      mechanisms: VALUE_MECHANISMS
    });
  }
  if(path==='/api/assistant/crypto/quote'&&request.method==='POST'){
    const body = await readJSON(request, 8000).catch(() => ({}));
    return json(calculateTtkQuote(Number(body?.amount_eur || 50)));
  }
  if(path==='/api/assistant/crypto/tetrakis'&&request.method==='GET'){
    return json({
      token: 'Tetrakis',
      symbol: 'TTK',
      decimals: 18,
      total_supply: '1,000,000,000 TTK',
      basterix_wallet: '0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4',
      basterix_allocation: '1,000,000 TTK (100% v osobnom držaní)',
      official_treasury: '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e',
      treasury_allocation: '999,000,000 TTK (pre DEX likviditu a ekosystém)',
      network: 'Base Mainnet (Coinbase L2)',
      chain_id: 8453,
      dex_platforms: ['Aerodrome Finance', 'Uniswap v3 (Base)'],
      pair: 'TTK / WETH',
      value_engine: calculateIntrinsicValuation(),
      valuation_milestones: VALUATION_MILESTONES,
      value_mechanisms: VALUE_MECHANISMS,
      staking_tiers: [
        { tier: 1, required_ttk: 1000, name: 'Sovereign Explorer', benefits: 'Unlimited chat, knowledge search, and semantic memory' },
        { tier: 2, required_ttk: 10000, name: 'Sovereign Operator', benefits: 'Full PC Bridge remote execution, Azure AI Foundry GPT-4o inference, and skill synthesis' },
        { tier: 3, required_ttk: 50000, name: 'Sovereign Mastermind', benefits: 'Revenue share from Trinity platform transactions, priority agent queue, and autonomous commodity desk' }
      ],
      tokenomics: {
        liquidity_pool: '40% (400,000,000 TTK)',
        agent_ecosystem: '30% (300,000,000 TTK)',
        treasury_reserve: '20% (200,000,000 TTK)',
        founder_basterix: '0.1% (1,000,000 TTK priamo v peňaženke Basterixa)',
        founder_dev_reserve: '9.9% (99,000,000 TTK)'
      },
      status: 'COMPILED_AND_READY_FOR_BASE_MAINNET_LIQUIDITY',
      basescan: 'https://basescan.org/address/0x4d308452a96D7dAbFd2f33d92677A3a2724f387e'
    });
  }`;

if (indexContent.includes(oldRoute)) {
  indexContent = indexContent.replace(oldRoute, newRoute);
  fs.writeFileSync(indexPath, indexContent, 'utf8');
  console.log('Successfully updated Trinity/src/index.js with Value Engine routes');
} else {
  console.warn('oldRoute not found in index.js');
}

// 2. Update Trinity/public/assistant/chat.html
const htmlPath = path.resolve(rootDir, 'public/assistant/chat.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const targetPanel = '<div><span class="eyebrow" style="color:#f59e0b">TRINITY UTILITY STAKING</span><h3>💎 3 Úrovne Výhod pre Držiteľov</h3></div>';
const valuationPanelHtml = `
      <div class="panel" style="margin-top:16px; padding:18px;">
        <div class="panel-head">
          <div><span class="eyebrow" style="color:#10b981">HODNOTA & VÝNOSY PRE TRINITY EKOSYSTÉM</span><h3>📈 Valuácia & Zisk pre Basterixa (1 000 000 TTK)</h3></div>
          <span class="detail-chip" style="background:rgba(16,185,129,0.15); color:#34d399;">30% Buyback Protokolu</span>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:14px; margin-top:14px;">
          <div style="padding:14px; background:#0f172a; border-radius:8px; border:1px solid #1e293b;">
            <b style="color:#38bdf8;">🔄 Autonómny Buyback & Burn</b>
            <p style="margin:6px 0 0; font-size:12px; color:#94a3b8; line-height:1.6;">
              <b>30% zo všetkých tržieb Trinity</b> (AI Studio weby, doménové escrow, API) je automaticky vyčlenených na trvalý nákup $TTK z DEX bazénov na Base.
              <b>50% z vyzbieraných tokenov</b> za služby je navždy spálených (deflácia).
            </p>
          </div>
          <div style="padding:14px; background:#0f172a; border-radius:8px; border:1px solid #1e293b;">
            <b style="color:#34d399;">💰 Milníky Valuácie tvojho 1 000 000 TTK:</b>
            <div style="margin-top:6px; font-size:12px; line-height:1.7; color:#cbd5e1;">
              <div>• Pri $0.001 (FDV $1M): <b style="color:#38bdf8;">$1 000 USD</b></div>
              <div>• Pri $0.01 (FDV $10M): <b style="color:#34d399;">$10 000 USD</b></div>
              <div>• Pri $0.10 (FDV $100M): <b style="color:#fbbf24;">$100 000 USD</b></div>
              <div>• Pri $1.00 (FDV $1B): <b style="color:#f43f5e; font-weight:bold;">$1 000 000 USD</b></div>
            </div>
          </div>
        </div>
      </div>
`;

if (html.includes(targetPanel) && !html.includes('HODNOTA & VÝNOSY PRE TRINITY EKOSYSTÉM')) {
  html = html.replace('</section>\n\n    <section id="wallet-view"', valuationPanelHtml + '\n    </section>\n\n    <section id="wallet-view"');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Successfully injected Valuation Panel into chat.html');
}

console.log('Value Engine integration complete.');
