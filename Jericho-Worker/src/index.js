/**
 * Jericho123 - Autonomous Crypto Super-Agent Worker
 * Dedicated Employee of Trinity Mastermind Core
 * Serving at: https://jericho123.auru.space & https://jericho123.auru.dev
 */

import {
  TRACKED_ASSETS,
  DEFI_YIELD_VAULTS,
  TETRAKIS_TOKEN,
  fetchLiveCryptoPrices,
  analyzeMarketSignals,
  deriveTrinityTreasury,
  executeWorkCycle
} from './crypto-engine.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function renderDashboard(prices, signals, treasury, latestWork) {
  const assetsHtml = Object.values(prices).map(p => {
    const isUp = p.change_24h_pct >= 0;
    const color = isUp ? '#10b981' : '#f43f5e';
    const sign = isUp ? '+' : '';
    return `
      <div class="crypto-card">
        <div class="crypto-header">
          <span class="crypto-symbol">${p.symbol}</span>
          <span class="crypto-badge" style="color: ${color}; background: ${color}15;">${sign}${p.change_24h_pct}%</span>
        </div>
        <div class="crypto-price">$${p.price_usd.toLocaleString('en-US', { minimumFractionDigits: p.price_usd < 1 ? 4 : 2 })}</div>
        <div class="crypto-meta">${p.name} • 24h Vol: $${(p.volume_24h_usd / 1e6).toFixed(1)}M</div>
      </div>
    `;
  }).join('');

  const yieldsHtml = DEFI_YIELD_VAULTS.map(y => `
    <div class="yield-row">
      <div>
        <div style="font-weight: 600; color: #fff;">${y.protocol} (${y.chain})</div>
        <div style="font-size: 0.8rem; color: #94a3b8;">${y.asset} • ${y.type}</div>
      </div>
      <div style="text-align: right;">
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; font-weight: 700; color: #38bdf8;">${y.apy}% APY</div>
        <div style="font-size: 0.75rem; color: #10b981;">Riziko: ${y.risk}</div>
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jericho 123 | Crypto Super-Agent pre Trinity</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #06080d;
      --panel: rgba(15, 20, 32, 0.75);
      --border: rgba(255, 255, 255, 0.08);
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.25);
      --gold: #f59e0b;
      --green: #10b981;
      --rose: #f43f5e;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Space Grotesk', -apple-system, sans-serif;
      min-height: 100vh;
      padding: 2.5rem 1.5rem;
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.12) 0%, transparent 60%),
        radial-gradient(circle at 100% 100%, rgba(245, 158, 11, 0.08) 0%, transparent 50%);
    }
    .wrapper {
      max-width: 1100px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 2.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .hero-title {
      font-size: 2.4rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      background: linear-gradient(135deg, #fff 40%, var(--accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-sub {
      color: var(--muted);
      font-size: 1.05rem;
      margin-top: 0.35rem;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      color: var(--green);
      padding: 0.5rem 1.2rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 0.05em;
    }
    .pulse-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 12px var(--green);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.8); }
    }
    .crypto-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }
    .crypto-card {
      background: var(--panel);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 1.35rem;
      transition: transform 0.2s, border-color 0.2s;
    }
    .crypto-card:hover {
      transform: translateY(-3px);
      border-color: rgba(56, 189, 248, 0.35);
    }
    .crypto-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .crypto-symbol {
      font-weight: 700;
      font-size: 1.15rem;
      color: #fff;
    }
    .crypto-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
    }
    .crypto-price {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.45rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 0.4rem;
    }
    .crypto-meta {
      font-size: 0.8rem;
      color: var(--muted);
    }
    .two-cols {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 1.75rem;
      margin-bottom: 2.5rem;
    }
    @media (max-width: 850px) {
      .two-cols { grid-template-columns: 1fr; }
    }
    .box {
      background: var(--panel);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 1.75rem;
    }
    .box-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .wallet-field {
      margin-bottom: 1rem;
    }
    .wallet-label {
      font-size: 0.8rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.35rem;
    }
    .wallet-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.88rem;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.6rem 0.85rem;
      color: var(--accent);
      word-break: break-all;
    }
    .yield-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .yield-row:last-child { border-bottom: none; }
    .action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      background: linear-gradient(135deg, #0284c7, #38bdf8);
      color: #030712;
      font-weight: 700;
      font-size: 0.95rem;
      padding: 0.85rem 1.6rem;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
      width: 100%;
      margin-top: 1rem;
    }
    .action-btn:hover { opacity: 0.92; transform: translateY(-1px); }
    .work-log {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.2rem;
      color: #cbd5e1;
      line-height: 1.6;
    }
    .footer {
      text-align: center;
      color: var(--muted);
      font-size: 0.85rem;
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div>
        <h1 class="hero-title">JERICHO 123</h1>
        <p class="hero-sub">Samostatný Crypto Super-Agent v službách Trinity Mastermind</p>
        <div style="font-size: 0.82rem; color: var(--muted); margin-top: 0.35rem;">
          Domény: <a href="https://jericho123.auru.space" style="color: var(--accent); text-decoration: none;">jericho123.auru.space</a> • <a href="https://jericho123.auru.dev" style="color: var(--accent); text-decoration: none;">jericho123.auru.dev</a>
        </div>
      </div>
      <div class="status-badge">
        <span class="pulse-dot"></span>
        <span>Pracuje pre Trinity • 100% Autonómny</span>
      </div>
    </div>

    <!-- Live Crypto Tickers -->
    <div class="crypto-grid">
      ${assetsHtml}
    </div>

    <!-- Tetrakis ($TTK) Official Trinity Crypto Token -->
    <div class="box" style="margin-bottom: 2rem; background: linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(245, 158, 11, 0.08) 100%); border: 1px solid rgba(56, 189, 248, 0.35);">
      <div class="box-title">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.6rem;">🏛️</span>
          <div>
            <div style="font-size: 1.25rem; font-weight: 700; color: #fff;">TETRAKIS ($TTK) • Oficiálna Kryptomena Trinity</div>
            <div style="font-size: 0.85rem; color: #94a3b8; font-weight: 400;">Krok 1 Dokončený: Reálna Peňaženka Vytvorená a Zabezpečená (BIP-39 / EVM)</div>
          </div>
        </div>
        <span style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); padding: 0.35rem 0.9rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.05em;">
          ● PEŇAŽENKA PRIPRAVENÁ NA DEPLOY
        </span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1.25rem; margin-bottom: 1.25rem;">
        <div>
          <div class="wallet-label">Názov & Symbol</div>
          <div style="font-weight: 600; font-size: 1.05rem; color: #fff;">Tetrakis (<span style="color: var(--accent);">$TTK</span>)</div>
        </div>
        <div>
          <div class="wallet-label">Celková Zásoba (Total Supply)</div>
          <div style="font-weight: 600; font-size: 1.05rem; color: #fff;">1,000,000,000 TTK</div>
        </div>
        <div>
          <div class="wallet-label">Štandard & Cieľové Siete</div>
          <div style="font-weight: 600; font-size: 1.05rem; color: #38bdf8;">ERC-20 • Base (Coinbase L2) / Arbitrum</div>
        </div>
        <div>
          <div class="wallet-label">Likviditný Pár</div>
          <div style="font-weight: 600; font-size: 1.05rem; color: #fff;">TTK / ETH (Uniswap v3 / Aerodrome)</div>
        </div>
      </div>
      <div>
        <div class="wallet-label">Oficiálna Deployer & Treasury Adresa Peňaženky</div>
        <div class="wallet-val" style="font-weight: 600; font-size: 0.95rem;">${treasury.evm_address}</div>
      </div>
    </div>

    <div class="two-cols">
      <!-- Treasury Wallets -->
      <div class="box">
        <div class="box-title">
          <span>Krypto Pokladnica Trinity</span>
          <span style="font-size: 0.8rem; color: var(--gold); font-weight: 600;">AUTONÓMNE SPRAVOVANÉ</span>
        </div>
        <div class="wallet-field">
          <div class="wallet-label">EVM Peňaženka (Ethereum, Arbitrum, Polygon, BSC)</div>
          <div class="wallet-val">${treasury.evm_address}</div>
        </div>
        <div class="wallet-field">
          <div class="wallet-label">Solana Peňaženka</div>
          <div class="wallet-val">${treasury.solana_address}</div>
        </div>
        <div class="wallet-field">
          <div class="wallet-label">Bitcoin SegWit Peňaženka</div>
          <div class="wallet-val">${treasury.bitcoin_address}</div>
        </div>
        <div class="wallet-field">
          <div class="wallet-label">Trhový sentiment</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: #fff; margin-top: 0.2rem;">
            ${signals.sentiment.label} (Index: ${signals.sentiment.score}/100)
          </div>
        </div>
        <button class="action-btn" onclick="executeWork()">
          ⚡ Spustiť autonómny pracovný cyklus
        </button>
      </div>

      <!-- DeFi Yield Strategies -->
      <div class="box">
        <div class="box-title">
          <span>Top DeFi Yield & Staking</span>
          <span style="font-size: 0.8rem; color: var(--accent); font-weight: 600;">ŽIVÝ SKENER</span>
        </div>
        <div>
          ${yieldsHtml}
        </div>
      </div>
    </div>

    <!-- Latest Work Log -->
    <div class="box" style="margin-bottom: 2rem;">
      <div class="box-title">
        <span>Posledný pracovný výkaz pre Trinity</span>
        <span style="font-size: 0.8rem; color: var(--green);">STATUS: COMPLETED</span>
      </div>
      <div class="work-log" id="workLog">
        <div><strong>Work ID:</strong> ${latestWork.work_id}</div>
        <div><strong>Čas vykonania:</strong> ${latestWork.timestamp} (${latestWork.duration_ms} ms)</div>
        <div style="margin-top: 0.5rem; color: #fff;"><strong>Výsledok:</strong> ${latestWork.summary}</div>
        <div style="margin-top: 0.5rem;">
          <strong>Navrhované kroky:</strong>
          <ul style="margin-left: 1.25rem; margin-top: 0.25rem;">
            ${latestWork.top_actions.map(a => `<li><span style="color: var(--accent); font-weight: bold;">${a.action} ${a.symbol}</span>: ${a.rationale} (dôvera: ${(a.confidence * 100).toFixed(0)}%)</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>

    <div class="footer">
      Jericho123 • Nezávislý uzol Kvantového Operačného Systému Trinity • Hostované na Cloudflare Edge
    </div>
  </div>

  <script>
    async function executeWork() {
      const btn = document.querySelector('.action-btn');
      btn.innerText = '⏳ Jericho pracuje...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/work', { method: 'POST' });
        const data = await res.json();
        alert('Pracovný cyklus dokončený! Jericho vygeneroval nový výkaz.');
        window.location.reload();
      } catch (err) {
        alert('Chyba: ' + err.message);
      } finally {
        btn.innerText = '⚡ Spustiť autonómny pracovný cyklus';
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Health endpoint
    if (url.pathname === '/health') {
      return Response.json({
        service: 'Jericho123',
        status: 'ready',
        role: 'Autonomous Crypto Super-Agent for Trinity',
        version: '1.0.0',
        domains: ['jericho123.auru.space', 'jericho123.auru.dev'],
        timestamp: new Date().toISOString()
      }, { headers: { ...CORS_HEADERS, 'Cache-Control': 'no-cache' } });
    }

    // Status endpoint
    if (url.pathname === '/api/status') {
      return Response.json({
        service: 'Jericho123',
        status: 'operational',
        master: 'Trinity Mastermind Core',
        version: '1.0.0',
        node: {
          provider: 'Cloudflare Edge',
          regions: ['global-edge']
        },
        timestamp: new Date().toISOString()
      }, { headers: CORS_HEADERS });
    }

    // Ping endpoint
    if (url.pathname === '/api/ping') {
      return Response.json({ pong: true, timestamp: Date.now() }, { headers: CORS_HEADERS });
    }

    // Live Prices API
    if (url.pathname === '/api/prices') {
      const prices = await fetchLiveCryptoPrices();
      return Response.json({ prices, timestamp: new Date().toISOString() }, { headers: CORS_HEADERS });
    }

    // Technical Signals API
    if (url.pathname === '/api/signals') {
      const prices = await fetchLiveCryptoPrices();
      const signals = analyzeMarketSignals(prices);
      return Response.json(signals, { headers: CORS_HEADERS });
    }

    // Treasury Wallets API
    if (url.pathname === '/api/treasury') {
      const treasury = deriveTrinityTreasury(env.TREASURY_SEED);
      return Response.json(treasury, { headers: CORS_HEADERS });
    }

    // Yield Opportunities API
    if (url.pathname === '/api/yields') {
      return Response.json({ vaults: DEFI_YIELD_VAULTS, timestamp: new Date().toISOString() }, { headers: CORS_HEADERS });
    }

    // Tetrakis Token Metadata & Wallet Status API
    if (url.pathname === '/api/tetrakis') {
      const treasury = deriveTrinityTreasury(env.TREASURY_SEED);
      return Response.json({
        token: TETRAKIS_TOKEN,
        treasury_address: treasury.evm_address,
        ready_for_deployment: true,
        timestamp: new Date().toISOString()
      }, { headers: CORS_HEADERS });
    }

    // Trigger Autonomous Work Cycle (REST)
    if (url.pathname === '/api/work' && request.method === 'POST') {
      const work = await executeWorkCycle(env);
      return Response.json(work, { headers: CORS_HEADERS });
    }

    // Root UI (Jericho Super-Agent Dashboard)
    if (url.pathname === '/' || url.pathname === '') {
      const prices = await fetchLiveCryptoPrices();
      const signals = analyzeMarketSignals(prices);
      const treasury = deriveTrinityTreasury(env.TREASURY_SEED);
      const work = await executeWorkCycle(env);

      return new Response(renderDashboard(prices, signals, treasury, work), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          ...CORS_HEADERS
        }
      });
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
  },

  // Direct RPC methods for Trinity Orchestrator
  async status() {
    return {
      service: 'Jericho123',
      ready: true,
      role: 'Autonomous Crypto Super-Agent',
      master: 'Trinity Mastermind Core',
      timestamp: new Date().toISOString()
    };
  },

  async ping() {
    return { pong: true };
  },

  async executeWorkCycle(params = {}) {
    return await executeWorkCycle(params);
  },

  async getPrices() {
    return await fetchLiveCryptoPrices();
  },

  async getSignals() {
    const prices = await fetchLiveCryptoPrices();
    return analyzeMarketSignals(prices);
  },

  async getTreasury() {
    return deriveTrinityTreasury();
  },

  async getTetrakisInfo() {
    const treasury = deriveTrinityTreasury();
    return {
      token: TETRAKIS_TOKEN,
      treasury_address: treasury.evm_address,
      ready_for_deployment: true
    };
  }
};
