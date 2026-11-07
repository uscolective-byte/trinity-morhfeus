import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, '../public/assistant/chat.html');
const jsPath = path.resolve(__dirname, '../public/assistant/chat.js.txt');

let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Add nav button if not present
const navTarget = '<button data-view="omnidev" id="omnidev-nav-btn"><span>⚡</span><b>Omni-Dev Studio</b></button>';
const navButton = '<button data-view="crypto" id="crypto-nav-btn"><span>💎</span><b>Tetrakis Crypto ($TTK)</b></button>';

if (!html.includes('data-view="crypto"')) {
  if (html.includes(navTarget)) {
    html = html.replace(navTarget, navTarget + '\n    ' + navButton);
    console.log('Added crypto nav button to chat.html');
  } else {
    console.warn('navTarget not found');
  }
}

// 2. Add crypto-view section if not present
const viewTarget = '<section id="wallet-view" class="view wallet-view" hidden>';
const cryptoSection = `<section id="crypto-view" class="view crypto-view" hidden>
      <div class="section-intro">
        <span class="eyebrow">TRINITY DECENTRALIZED ASSETS · BASE MAINNET L2</span>
        <h1>💎 Tetrakis ($TTK) Sovereign Crypto Platform</h1>
        <p>Oficiálna kryptomenová platforma Trinity postavená na sieti Base Mainnet (Coinbase L2). Fixná ponuka 1 000 000 000 TTK, 3-úrovňový staking úžitkovej hodnoty a integrácia do autonómneho ekosystému agentov.</p>
      </div>

      <div class="metric-grid domain-metrics tabular-metrics">
        <article class="metric blue">
          <span>CELKOVÁ ZÁSOBA ($TTK)</span>
          <strong id="ttk-stat-supply">1 000 000 000 TTK</strong>
          <small>Fixná ponuka (100% mincovníctva)</small>
        </article>
        <article class="metric teal">
          <span>SIEŤ & ŠTANDARD</span>
          <strong id="ttk-stat-network">Base Mainnet (8453)</strong>
          <small>ERC-20 · OpenZeppelin v5.1.0</small>
        </article>
        <article class="metric gold">
          <span>DEX LIKVIDITA</span>
          <strong id="ttk-stat-dex">Aerodrome & Uniswap v3</strong>
          <small>Pár TTK / WETH na Base</small>
        </article>
        <article class="metric purple">
          <span>JERICHO NODE</span>
          <strong id="ttk-stat-jericho">Online (Edge Node)</strong>
          <small>jericho123.auru.space</small>
        </article>
      </div>

      <div class="dashboard-grid admin-grid" style="grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; margin-top: 16px;">
        <article class="panel" style="padding: 18px;">
          <div class="panel-head">
            <div><span class="eyebrow" style="color:#0ea5e9">OFICIÁLNE METADÁTA & ON-CHAIN KONTRAKT</span><h3>📜 Smart Kontrakt & Pokladnica</h3></div>
            <a href="https://basescan.org/address/0x4d308452a96D7dAbFd2f33d92677A3a2724f387e" target="_blank" rel="noopener" class="detail-chip" style="text-decoration:none;">BaseScan ↗</a>
          </div>
          <div style="font-size:13px; color:#cbd5e1; line-height:1.7; margin-top:12px;">
            <p><b>Token:</b> Tetrakis ($TTK) · 18 desatinných miest</p>
            <p><b>Oficiálna Pokladnica:</b> <code style="word-break:break-all; background:#0f172a; padding:3px 6px; border-radius:4px; font-size:11px;">0x4d308452a96D7dAbFd2f33d92677A3a2724f387e</code></p>
            <p><b>Bytecode Hash (Keccak256):</b> <code style="word-break:break-all; background:#0f172a; padding:3px 6px; border-radius:4px; font-size:11px;">0x5db6aa4e0b155cc4eb54b45ce1ecde5ec0feb55c12e4fc75153b1615c5c9652c</code></p>
            <p><b>NPM SDK Balík:</b> <a href="https://www.npmjs.com/package/tetrakis-token" target="_blank" rel="noopener" style="color:#38bdf8; font-weight:bold;">tetrakis-token@1.0.0</a> (Vlastník: <code>basterix3</code>)</p>
          </div>
          <div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
            <a href="https://www.npmjs.com/package/tetrakis-token" target="_blank" rel="noopener" class="primary" style="display:inline-block; padding:8px 14px; text-decoration:none; border-radius:8px; font-weight:bold; font-size:12px;">📦 NPM Balík</a>
            <a href="https://jericho123.auru.space" target="_blank" rel="noopener" class="secondary" style="display:inline-block; padding:8px 14px; text-decoration:none; border-radius:8px; font-size:12px;">⚡ Jericho Crypto Node</a>
          </div>
        </article>

        <article class="panel" style="padding: 18px;">
          <div class="panel-head">
            <div><span class="eyebrow" style="color:#f59e0b">TRINITY UTILITY STAKING</span><h3>💎 3 Úrovne Výhod pre Držiteľov</h3></div>
            <span class="detail-chip" style="background:rgba(245,158,11,0.15); color:#fbbf24;">Sovereign Tiers</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:12px; margin-top:12px;">
            <div style="padding:12px; background:#0f172a; border:1px solid #1e293b; border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <b style="color:#38bdf8;">Tier 1 · Sovereign Explorer</b>
                <span class="detail-chip">1 000 TTK</span>
              </div>
              <p style="margin:6px 0 0; font-size:12px; color:#94a3b8;">Neobmedzený chat, sémantická pamäť a autonómne vyhľadávanie vedomostí.</p>
            </div>
            <div style="padding:12px; background:#0f172a; border:1px solid #1e293b; border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <b style="color:#a855f7;">Tier 2 · Sovereign Operator</b>
                <span class="detail-chip">10 000 TTK</span>
              </div>
              <p style="margin:6px 0 0; font-size:12px; color:#94a3b8;">Plná exekúcia PC Bridge, Azure AI Foundry (GPT-4o) a dynamická syntéza skillov.</p>
            </div>
            <div style="padding:12px; background:#0f172a; border:1px solid #1e293b; border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <b style="color:#eab308;">Tier 3 · Sovereign Mastermind</b>
                <span class="detail-chip">50 000 TTK</span>
              </div>
              <p style="margin:6px 0 0; font-size:12px; color:#94a3b8;">Podiel na výnosoch platformy Trinity, prioritná fronta a autonómny komoditný desk.</p>
            </div>
          </div>
        </article>
      </div>

      <div class="panel" style="margin-top:16px; padding:18px;">
        <div class="panel-head">
          <div><span class="eyebrow" style="color:#10b981">WEB3 PEŇAŽENKA & INTERAKCIA</span><h3>🦊 Pripojenie Peňaženky (Base Mainnet)</h3></div>
          <button id="web3-connect-btn" class="primary" type="button" style="display:inline-flex; align-items:center; gap:8px;">🦊 Pripojiť Web3 Peňaženku</button>
        </div>
        <p style="color:#94a3b8; font-size:12px; margin-top:8px;">Pripoj svoju peňaženku MetaMask, Coinbase Wallet alebo Rainbow na sieti Base Mainnet a zisti svoj aktuálny zostatok a odomknuté výhody.</p>
        <div id="web3-wallet-status" style="margin-top:12px; padding:12px; background:#0f172a; border-radius:8px; font-size:13px; color:#cbd5e1; display:none;">
          <p><b>Adresa peňaženky:</b> <code id="web3-user-address">-</code></p>
          <p><b>Sieť:</b> <span id="web3-user-chain">Base Mainnet (8453)</span></p>
          <p><b>Zostatok $TTK:</b> <b id="web3-user-ttk" style="color:#38bdf8;">0 TTK</b></p>
          <p><b>Aktívny Tier:</b> <span id="web3-user-tier" class="detail-chip">Neaktívny</span></p>
        </div>
      </div>
    </section>\n\n    `;

if (!html.includes('id="crypto-view"')) {
  if (html.includes(viewTarget)) {
    html = html.replace(viewTarget, cryptoSection + viewTarget);
    console.log('Added crypto-view section to chat.html');
  } else {
    console.warn('viewTarget not found');
  }
}

fs.writeFileSync(htmlPath, html, 'utf8');

// 3. Update chat.js.txt
let js = fs.readFileSync(jsPath, 'utf8');

// Add viewMeta.crypto
if (!js.includes("crypto:['TETRAKIS")) {
  const metaTarget = "agentlab:['AI AGENT SANDBOX & LAB";
  const metaReplacement = "crypto:['TETRAKIS CRYPTO PLATFORM ($TTK)','Tetrakis Sovereign Crypto','Base Mainnet tokenomika, staking a decentralizovany AI ekosystem Trinity.'],\n" + metaTarget;
  if (js.includes(metaTarget)) {
    js = js.replace(metaTarget, metaReplacement);
    console.log('Added crypto to viewMeta');
  }
}

// Add loadCryptoView to setView
if (!js.includes("if(name==='crypto')await loadCryptoView();")) {
  const setViewTarget = "if(name==='wallet')await loadWalletView();";
  const setViewRepl = "if(name==='wallet')await loadWalletView();if(name==='crypto')await loadCryptoView();";
  if (js.includes(setViewTarget)) {
    js = js.replace(setViewTarget, setViewRepl);
    console.log('Added loadCryptoView to setView');
  }
}

// Add function loadCryptoView and web3 handler
if (!js.includes("async function loadCryptoView()")) {
  const cryptoFunc = `
async function loadCryptoView() {
  try {
    const res = await fetch('/api/assistant/crypto/tetrakis');
    if (res.ok) {
      const data = await res.json();
      if ($('ttk-stat-supply')) $('ttk-stat-supply').textContent = data.total_supply || '1 000 000 000 TTK';
      if ($('ttk-stat-network')) $('ttk-stat-network').textContent = data.network || 'Base Mainnet (8453)';
    }
  } catch (e) {
    console.error('Failed to load crypto view', e);
  }
  const btn = $('web3-connect-btn');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = 'true';
    btn.onclick = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts[0]) {
            const addr = accounts[0];
            const box = $('web3-wallet-status');
            if (box) box.style.display = 'block';
            if ($('web3-user-address')) $('web3-user-address').textContent = addr;
            btn.textContent = '✓ Pripojené (' + addr.slice(0, 6) + '...' + addr.slice(-4) + ')';
            btn.classList.remove('primary');
            btn.classList.add('secondary');
          }
        } catch (err) {
          alert('Chyba pripojenia peňaženky: ' + (err.message || err));
        }
      } else {
        alert('Web3 peňaženka (napr. MetaMask) nebola detegovaná.');
      }
    };
  }
}
`;
  js = js + '\n' + cryptoFunc;
  console.log('Added loadCryptoView implementation to chat.js.txt');
}

fs.writeFileSync(jsPath, js, 'utf8');
console.log('Patch complete.');
