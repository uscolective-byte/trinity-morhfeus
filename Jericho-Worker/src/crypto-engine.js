/**
 * Jericho Autonomous Crypto Engine
 * Handles real-time market data, technical signals, treasury wallets, yield analysis,
 * and autonomous work execution exclusively serving Trinity.
 * Truth Policy: No fabricated trades, no synthetic prices used as live signals.
 */

import { keccak_256 } from '@noble/hashes/sha3.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';

export const TRACKED_ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', pair: 'BTCUSDT', defaultPrice: 67500.0 },
  { symbol: 'ETH', name: 'Ethereum', pair: 'ETHUSDT', defaultPrice: 2620.0 },
  { symbol: 'SOL', name: 'Solana', pair: 'SOLUSDT', defaultPrice: 172.5 },
  { symbol: 'BNB', name: 'BNB Chain', pair: 'BNBUSDT', defaultPrice: 590.0 },
  { symbol: 'XRP', name: 'Ripple', pair: 'XRPUSDT', defaultPrice: 0.54 },
  { symbol: 'AVAX', name: 'Avalanche', pair: 'AVAXUSDT', defaultPrice: 28.5 },
  { symbol: 'LINK', name: 'Chainlink', pair: 'LINKUSDT', defaultPrice: 11.8 },
  { symbol: 'SUI', name: 'Sui Network', pair: 'SUIUSDT', defaultPrice: 2.15 },
  { symbol: 'USDC', name: 'USD Coin', pair: 'USDCUSDT', defaultPrice: 1.0 }
];

export const DEFI_YIELD_VAULTS = [
  { protocol: 'Aave v3', asset: 'USDC', chain: 'Arbitrum', apy: 5.85, risk: 'LOW', tvl_usd: '840M', type: 'Lending', verified: false, source: 'unverified-reference-estimate' },
  { protocol: 'Lido', asset: 'stETH', chain: 'Ethereum', apy: 3.25, risk: 'LOW', tvl_usd: '24.2B', type: 'Liquid Staking', verified: false, source: 'unverified-reference-estimate' },
  { protocol: 'Solana Native', asset: 'SOL', chain: 'Solana', apy: 6.95, risk: 'LOW', tvl_usd: '5.1B', type: 'Native Staking', verified: false, source: 'unverified-reference-estimate' },
  { protocol: 'Uniswap v3', asset: 'ETH/USDC', chain: 'Ethereum', apy: 14.20, risk: 'MEDIUM', tvl_usd: '320M', type: 'Concentrated Liquidity', verified: false, source: 'unverified-reference-estimate' },
  { protocol: 'Raydium CLMM', asset: 'SOL/USDC', chain: 'Solana', apy: 18.40, risk: 'MEDIUM', tvl_usd: '95M', type: 'DEX Liquidity', verified: false, source: 'unverified-reference-estimate' },
  { protocol: 'Curve Finance', asset: '3pool (USDC/USDT/DAI)', chain: 'Ethereum', apy: 4.10, risk: 'LOW', tvl_usd: '480M', type: 'Stable Swap', verified: false, source: 'unverified-reference-estimate' }
];

export const TETRAKIS_TOKEN = {
  name: 'Tetrakis',
  symbol: 'TTK',
  decimals: 18,
  total_supply: '1,000,000,000 TTK',
  standard: 'ERC-20 (EVM)',
  treasury_wallet: '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e',
  target_networks: ['Base (Coinbase L2)', 'Arbitrum', 'Polygon'],
  dex_pair: 'TTK / ETH (Uniswap v3 / Aerodrome)',
  status: 'WALLET_INITIALIZED_READY_FOR_DEPLOYMENT',
  ecosystem: 'Trinity Mastermind & Quantum Operating System'
};

// Helper: Format EVM Address checksum
export function toChecksumAddress(address) {
  const addr = address.toLowerCase().replace(/^0x/, '');
  const hash = Array.from(keccak_256(new TextEncoder().encode(addr)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  let ret = '0x';
  for (let i = 0; i < addr.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      ret += addr[i].toUpperCase();
    } else {
      ret += addr[i];
    }
  }
  return ret;
}

// Generate deterministic Treasury wallet for Trinity & Tetrakis
export function deriveTrinityTreasury(seed) {
  const tetrakisAddress = '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e';
  let evmAddress = tetrakisAddress;

  if (seed && seed !== 'trinity-jericho-treasury-v1' && seed !== 'trinity-jericho-vault') {
    const seedBytes = keccak_256(new TextEncoder().encode(seed));
    const privKey = seedBytes.slice(0, 32);
    const pubKey = secp256k1.getPublicKey(privKey, false);
    const pubKeyHash = keccak_256(pubKey.slice(1));
    evmAddress = toChecksumAddress('0x' + Array.from(pubKeyHash.slice(-20)).map(b => b.toString(16).padStart(2, '0')).join(''));
  }

  return {
    evm_address: evmAddress,
    networks: ['Base', 'Ethereum', 'Arbitrum', 'Polygon', 'Optimism', 'BNB Chain'],
    solana_address: null,
    bitcoin_address: null,
    chains_status: {
      evm: 'ACTIVE_DEPLOYED_TREASURY',
      solana: 'AWAITING_ED25519_KEYPAIR',
      bitcoin: 'AWAITING_BECH32_KEYPAIR'
    },
    treasury_owner: 'Trinity Mastermind Core',
    custody_mode: 'Autonomous Super-Agent Vault',
    tetrakis: TETRAKIS_TOKEN
  };
}

// Live crypto prices fetcher with explicit live/fallback flags
export async function fetchLiveCryptoPrices() {
  const results = {};
  let isLive = false;

  try {
    const symbols = TRACKED_ASSETS.map(a => `"${a.pair}"`).join(',');
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbols}]`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { 'Accept': 'application/json' }
    });

    if (res.ok) {
      const data = await res.json();
      for (const item of data) {
        const asset = TRACKED_ASSETS.find(a => a.pair === item.symbol);
        if (asset) {
          const price = parseFloat(item.lastPrice);
          const change24h = parseFloat(item.priceChangePercent);
          const high24h = parseFloat(item.highPrice);
          const low24h = parseFloat(item.lowPrice);
          const volume = parseFloat(item.quoteVolume);
          results[asset.symbol] = {
            symbol: asset.symbol,
            name: asset.name,
            price_usd: price,
            change_24h_pct: change24h,
            high_24h: high24h,
            low_24h: low24h,
            volume_24h_usd: volume,
            source: 'binance-live',
            live: true,
            status: 'verified_live',
            updated_at: new Date().toISOString()
          };
        }
      }
      isLive = Object.keys(results).length > 0;
    }
  } catch (_) {
    // Network failure
  }

  // Truth Policy: When live API fails, flag fallback values explicitly as unverified/demo
  for (const asset of TRACKED_ASSETS) {
    if (!results[asset.symbol]) {
      results[asset.symbol] = {
        symbol: asset.symbol,
        name: asset.name,
        price_usd: asset.defaultPrice,
        change_24h_pct: 0.0,
        high_24h: asset.defaultPrice,
        low_24h: asset.defaultPrice,
        volume_24h_usd: 0,
        source: 'unverified-reference',
        live: false,
        status: isLive ? 'missing_from_feed' : 'feed_unavailable',
        updated_at: new Date().toISOString()
      };
    }
  }

  return results;
}

// Technical signal analysis & scoring
export function analyzeMarketSignals(prices) {
  const signals = [];
  let marketSentimentScore = 50;

  for (const [symbol, info] of Object.entries(prices)) {
    // Truth Policy: No trade actions based on synthetic or unavailable data
    if (!info.live) {
      signals.push({
        symbol,
        price: info.price_usd,
        action: 'DATA_UNAVAILABLE',
        confidence: 0,
        rationale: 'Živé trhové dáta nie sú k dispozícii; automatizovaný obchodný signál je pozastavený.'
      });
      continue;
    }

    let action = 'HOLD';
    let confidence = 0.65;
    let rationale = '';

    if (info.change_24h_pct > 4.0) {
      action = 'MOMENTUM_BUY';
      confidence = 0.82;
      rationale = `Silné býčie momentum (+${info.change_24h_pct}% za 24h), breakout nad lokálnu rezistenciu.`;
      marketSentimentScore += 4;
    } else if (info.change_24h_pct < -4.0) {
      action = 'DIP_ACCUMULATE';
      confidence = 0.78;
      rationale = `Výpredaj na podpore (${info.change_24h_pct}% za 24h), výhodná zóna pre postupnú akumuláciu (DCA).`;
      marketSentimentScore -= 4;
    } else if (info.change_24h_pct > 1.0) {
      action = 'ACCUMULATE';
      confidence = 0.70;
      rationale = `Mierny stabilný rast (+${info.change_24h_pct}%), trend sleduje kĺzavé priemery.`;
      marketSentimentScore += 1;
    } else {
      action = 'HOLD';
      confidence = 0.60;
      rationale = `Konsolidácia v bočnom pásme, nízka volatilita.`;
    }

    signals.push({
      symbol,
      price: info.price_usd,
      action,
      confidence: parseFloat(confidence.toFixed(2)),
      rationale
    });
  }

  marketSentimentScore = Math.min(95, Math.max(10, marketSentimentScore));
  const sentiment = marketSentimentScore > 70 ? 'Greed (Býčí)' : marketSentimentScore < 40 ? 'Fear (Opatrný)' : 'Neutral';

  return {
    sentiment: { score: marketSentimentScore, label: sentiment },
    signals,
    computed_at: new Date().toISOString()
  };
}

// Autonomous work cycle for Trinity
export async function executeWorkCycle(env = {}) {
  const startTime = Date.now();
  const prices = await fetchLiveCryptoPrices();
  const analysis = analyzeMarketSignals(prices);
  const treasury = deriveTrinityTreasury(env?.TREASURY_SEED || 'trinity-jericho-vault');

  // Select top actionable recommendations (excluding unavailable/hold)
  const topRecommendations = analysis.signals
    .filter(s => s.action !== 'HOLD' && s.action !== 'DATA_UNAVAILABLE')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  // Best yield options
  const topYields = DEFI_YIELD_VAULTS.slice(0, 3);

  const workReceipt = {
    work_id: `jericho:${crypto.randomUUID()}`,
    agent: 'Jericho123',
    role: 'Autonomous Crypto Super-Agent',
    client: 'Trinity Mastermind Core',
    status: 'COMPLETED',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    summary: `Jericho vyhodnotil ${Object.keys(prices).length} krypto aktív a pripravil odporúčania pre pokladnicu Tetrakis/Trinity bez nepodložených tvrdení o prevodoch.`,
    transfers_executed: false,
    treasury_balance_updated: false,
    market_sentiment: analysis.sentiment,
    top_actions: topRecommendations,
    yield_opportunities: topYields,
    treasury_addresses: {
      evm: treasury.evm_address,
      solana: treasury.solana_address,
      bitcoin: treasury.bitcoin_address
    }
  };

  return workReceipt;
}
