// services/trinity-treasury/src/index.js
// WORKER #24: TRINITY TREASURY ($TTK Base L2 Sovereign Controller)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://auru.space",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Trinity-TAP",
  "Content-Type": "application/json; charset=utf-8"
};

// ERC-20 & TetrakisToken 4-byte function selectors
const SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
  HARD_CAP: "0x59bf1abe",
  sovereignOwner: "0x90d9834f",
  treasuryWorker: "0x183c637c",
  balanceOf: "0x70a08231"
};

export const LISTING_PIPELINE = [
  {
    step: 1,
    id: "base_l2_contract",
    title: "Kontrakt na Base L2 (Chain ID 8453 / Sepolia 84532)",
    status: "READY",
    details: {
      contract: "TetrakisToken ($TTK)",
      compiler: "solc 0.8.24 (optimizer runs: 200)",
      hardCap: "10,000,000 TTK",
      initialSupply: "2,000,000 TTK",
      antiBackdoor: "Infinite minting disabled; HARD_CAP enforced on-chain"
    }
  },
  {
    step: 2,
    id: "dex_liquidity_pool",
    title: "Vytvorenie Poolu na Aerodrome / Uniswap v3 (Base)",
    status: "CONFIGURED",
    details: {
      pair: "TTK / USDC",
      suggestedInitialLiquidityTtk: 100000,
      suggestedInitialPriceUsdc: 0.05,
      suggestedUsdcCountervalue: 5000
    }
  },
  {
    step: 3,
    id: "lp_lock_uncx",
    title: "Uzamknutie Likvidity (LP Lock cez UNCX Network)",
    status: "REQUIRED_BEFORE_CEX",
    details: {
      provider: "UNCX Network (Base L2)",
      minimumLockMonths: 6,
      recommendedLockMonths: 12
    }
  },
  {
    step: 4,
    id: "tracker_indexing",
    title: "Indexácia Trackerov (DexScreener, CoinGecko, CoinMarketCap)",
    status: "READY_ON_FIRST_SWAP",
    details: {
      website: "https://auru.space",
      explorer: "https://basescan.org",
      trackers: ["DexScreener", "CoinGecko", "CoinMarketCap"]
    }
  },
  {
    step: 5,
    id: "cex_listing_tiers",
    title: "Burzový Listing (CEX Tier 3 -> Tier 1)",
    status: "ROADMAP_READY",
    details: {
      tier3: ["MEXC", "BitMart"],
      tier1: ["Bybit", "Binance"]
    }
  }
];

function encodeAddressArg(address) {
  const clean = String(address || "").trim().replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(clean)) {
    throw new Error("ERR_INVALID_EVM_ADDRESS");
  }
  return clean.padStart(64, "0");
}

export default {
  async fetch(request, env = {}, ctx = {}) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const contractAddress = env.TTK_CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const baseChainId = String(env.BASE_CHAIN_ID || "8453");
    const baseRpcUrl = env.BASE_RPC_URL || "https://mainnet.base.org";

    if (request.method === "GET" && url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          service: "trinity-treasury",
          workerId: 24,
          cluster: "04. Financial & Krypto",
          version: "11.2.0",
          status: "serving",
          token: {
            name: "Tetrakis",
            symbol: "TTK",
            decimals: 18,
            hardCapTokens: Number(env.TTK_HARD_CAP || 10000000),
            initialSupplyTokens: Number(env.TTK_INITIAL_SUPPLY || 2000000),
            contractAddress,
            baseChainId,
            baseRpcUrl
          }
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (request.method === "GET" && (url.pathname === "/api/treasury/status" || url.pathname === "/status")) {
      return new Response(
        JSON.stringify({
          ok: true,
          worker: "trinity-treasury",
          token: {
            name: "Tetrakis",
            symbol: "TTK",
            decimals: 18,
            hardCapWei: (10_000_000n * 10n ** 18n).toString(),
            initialSupplyWei: (2_000_000n * 10n ** 18n).toString(),
            contractAddress,
            baseChainId: Number(baseChainId),
            baseRpcUrl
          },
          listingPipeline: LISTING_PIPELINE
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (request.method === "GET" && url.pathname === "/api/treasury/listing-pipeline") {
      return new Response(
        JSON.stringify({
          ok: true,
          symbol: "TTK",
          contractAddress,
          baseChainId: Number(baseChainId),
          pipeline: LISTING_PIPELINE
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (request.method === "POST" && url.pathname === "/api/treasury/rpc-read") {
      try {
        const body = await request.json();
        const method = body?.method || "totalSupply";
        let dataHex = SELECTORS[method];
        if (!dataHex) {
          return new Response(JSON.stringify({ error: "UNSUPPORTED_METHOD" }), { status: 400, headers: CORS_HEADERS });
        }
        if (method === "balanceOf") {
          dataHex = SELECTORS.balanceOf + encodeAddressArg(body.account);
        }

        const rpcRes = await fetch(baseRpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_call",
            params: [{ to: contractAddress, data: dataHex }, "latest"]
          })
        });
        const rpcJson = await rpcRes.json();
        return new Response(
          JSON.stringify({
            ok: !rpcJson.error,
            contractAddress,
            baseChainId: Number(baseChainId),
            method,
            result: rpcJson.result || null,
            error: rpcJson.error || null
          }),
          { status: rpcJson.error ? 502 : 200, headers: CORS_HEADERS }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "RPC_CALL_FAILED", message: err.message }),
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404, headers: CORS_HEADERS });
  }
};
