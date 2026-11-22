// services/trinity-treasury/src/index.js
// WORKER #24: TRINITY TREASURY ($TTK Base L2 & Polygon Sovereign Controller)

import tetrakisArtifact from "../../../contracts/tetrakis/build/TetrakisToken.json" with { type: "json" };
import tetrakisManifesto from "../../../packages/crypto-core/lore/manifesto.json" with { type: "json" };
import { verifyTapToken } from "../../../packages/contracts/src/tap.js";
import { verifyMerkleProof, verifyExecutionReceipt } from "../../../packages/crypto-core/src/proof-of-execution.js";
import { MerkleMountainRange, verifyMmrProof } from "../../../packages/crypto-core/src/merkle-mountain-range.js";

export const TETRAKIS_ABI = tetrakisArtifact.abi;
export const TETRAKIS_ARTIFACT_DIGESTS = {
  compiler: tetrakisArtifact.compiler,
  bytecodeSha256: tetrakisArtifact.bytecodeSha256,
  deployedBytecodeSha256: tetrakisArtifact.deployedBytecodeSha256,
  runtimeKeccak256: tetrakisArtifact.runtimeKeccak256
};
export const TETRAKIS_MANIFESTO = tetrakisManifesto;

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
  TOTAL_SUPPLY_CAP: "0x48931352",
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
      totalSupply: "1,000,000,000 TTK (fixed)",
      initialAllocation: "1,000,000 TTK Basterix + 999,000,000 TTK Treasury",
      antiBackdoor: "No mint function exists; supply is fixed at deployment"
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

async function ensureTreasuryTables(db) {
  if (!db || typeof db.prepare !== "function") return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS ttk_vaults (
    vault_id TEXT PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    owner_profile_id TEXT NOT NULL,
    balance_ttk REAL NOT NULL DEFAULT 0.0,
    locked_stake_ttk REAL NOT NULL DEFAULT 0.0,
    network TEXT NOT NULL DEFAULT 'base-mainnet',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    updated_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS ttk_transactions (
    tx_id TEXT PRIMARY KEY,
    tx_hash TEXT UNIQUE,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount_ttk REAL NOT NULL,
    tx_type TEXT NOT NULL,
    chain_id INTEGER NOT NULL DEFAULT 8453,
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
    created_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS crypto_payments (
    payment_id TEXT PRIMARY KEY,
    payer_address TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    asset_symbol TEXT NOT NULL DEFAULT 'TTK',
    amount REAL NOT NULL,
    usd_value REAL NOT NULL,
    oracle_price_usd REAL NOT NULL,
    tx_hash TEXT,
    status TEXT NOT NULL DEFAULT 'SETTLED',
    created_at INTEGER NOT NULL
  )`).run();
}

function renderManifestoHtml() {
  const pillarsHtml = TETRAKIS_MANIFESTO.tetrahedronPillars
    .map(
      (p) => `
      <div class="pillar-card">
        <div class="vertex-badge">VRCHOL 0${p.vertex}</div>
        <h3>${p.name}</h3>
        <p>${p.description}</p>
      </div>`
    )
    .join("");

  const chaptersHtml = TETRAKIS_MANIFESTO.chapters
    .map(
      (c) => `
      <section class="chapter">
        <h2>${c.title}</h2>
        <p>${c.body.replace(/\n\n/g, "</p><p>")}</p>
      </section>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${TETRAKIS_MANIFESTO.slogan}</title>
  <style>
    :root {
      --bg: #05070e;
      --card: rgba(14, 21, 38, 0.82);
      --cyan: #38bdf8;
      --violet: #a855f7;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background: radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.16), transparent 60%), var(--bg);
      color: var(--text);
      line-height: 1.65;
      padding: 2.5rem 1.25rem;
    }
    .container { max-width: 960px; margin: 0 auto; }
    .hero { text-align: center; margin-bottom: 3rem; }
    .hero img { max-width: 520px; width: 100%; border-radius: 16px; border: 1px solid rgba(56, 189, 248, 0.3); box-shadow: 0 0 40px rgba(56, 189, 248, 0.2); }
    .slogan { font-size: 2rem; font-weight: 800; margin-top: 1.5rem; background: linear-gradient(90deg, var(--cyan), var(--violet)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .pillars { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin: 2rem 0; }
    .pillar-card, .chapter { background: var(--card); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; }
    .vertex-badge { font-size: 0.75rem; color: var(--cyan); font-weight: 700; letter-spacing: 0.08em; }
    blockquote { border-left: 3px solid var(--cyan); padding-left: 1rem; font-style: italic; color: #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <img src="${TETRAKIS_MANIFESTO.logo.url}" alt="Tetrakis ($TTK) Logo" />
      <div class="slogan">${TETRAKIS_MANIFESTO.slogan}</div>
      <p>${TETRAKIS_MANIFESTO.title}</p>
    </div>
    <div class="pillars">${pillarsHtml}</div>
    ${chaptersHtml}
    <blockquote>${TETRAKIS_MANIFESTO.architectOath}</blockquote>
  </div>
</body>
</html>`;
}

export default {
  async fetch(request, env = {}, ctx = {}) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    // Empty/unset = the token has NOT been deployed yet. Never fall back to a placeholder address.
    const contractAddress = /^0x[0-9a-fA-F]{40}$/.test(env.TTK_CONTRACT_ADDRESS || "") ? env.TTK_CONTRACT_ADDRESS : null;
    const deployed = contractAddress !== null;
    const baseChainId = String(env.BASE_CHAIN_ID || "8453");
    const baseRpcUrl = env.BASE_RPC_URL || "https://mainnet.base.org";
    const polygonChainId = String(env.POLYGON_CHAIN_ID || "137");
    const polygonRpcUrl = env.POLYGON_RPC_URL || "https://polygon-rpc.com";
    const db = env.DB || env.TRINITY_D1 || null;

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/manifesto")) {
      return new Response(renderManifestoHtml(), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          service: "trinity-treasury",
          workerId: 24,
          cluster: "04. Financial & Krypto",
          version: "11.2.0",
          status: "serving",
          slogan: TETRAKIS_MANIFESTO.slogan,
          token: {
            name: "Tetrakis",
            symbol: "TTK",
            decimals: 18,
            totalSupplyTokens: 1_000_000_000,
            mintable: false,
            deployed,
            contractAddress,
            baseChainId,
            baseRpcUrl,
            polygonChainId,
            polygonRpcUrl,
            abiFunctions: TETRAKIS_ABI.filter((i) => i.type === "function").map((i) => i.name),
            bytecodeSha256: TETRAKIS_ARTIFACT_DIGESTS.bytecodeSha256,
            runtimeKeccak256: TETRAKIS_ARTIFACT_DIGESTS.runtimeKeccak256,
            logo: TETRAKIS_MANIFESTO.logo
          }
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (request.method === "GET" && url.pathname === "/api/treasury/abi") {
      return new Response(
        JSON.stringify({
          ok: true,
          contractName: "TetrakisToken",
          ...TETRAKIS_ARTIFACT_DIGESTS,
          abi: TETRAKIS_ABI
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (request.method === "GET" && url.pathname === "/api/treasury/manifesto") {
      return new Response(
        JSON.stringify({
          ok: true,
          ...TETRAKIS_MANIFESTO
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (request.method === "GET" && url.pathname === "/api/treasury/lore-drops") {
      return new Response(
        JSON.stringify({
          ok: true,
          slogan: TETRAKIS_MANIFESTO.slogan,
          logo: TETRAKIS_MANIFESTO.logo,
          loreDrops: TETRAKIS_MANIFESTO.loreDrops
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (request.method === "GET" && (url.pathname === "/api/treasury/status" || url.pathname === "/status")) {
      return new Response(
        JSON.stringify({
          ok: true,
          worker: "trinity-treasury",
          slogan: TETRAKIS_MANIFESTO.slogan,
          token: {
            name: "Tetrakis",
            symbol: "TTK",
            decimals: 18,
            totalSupplyWei: (1_000_000_000n * 10n ** 18n).toString(),
            mintable: false,
            deployed,
            contractAddress,
            baseChainId: Number(baseChainId),
            baseRpcUrl,
            polygonChainId: Number(polygonChainId),
            polygonRpcUrl,
            logo: TETRAKIS_MANIFESTO.logo,
            artifactDigests: TETRAKIS_ARTIFACT_DIGESTS
          },
          tetrahedronPillars: TETRAKIS_MANIFESTO.tetrahedronPillars,
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
          slogan: TETRAKIS_MANIFESTO.slogan,
          logo: TETRAKIS_MANIFESTO.logo,
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
        const network = body?.network === "polygon" ? "polygon" : "base";
        const targetRpc = network === "polygon" ? polygonRpcUrl : baseRpcUrl;
        const targetChainId = network === "polygon" ? Number(polygonChainId) : Number(baseChainId);

        if (!deployed) {
          return new Response(JSON.stringify({ error: "CONTRACT_NOT_DEPLOYED", message: "TTK_CONTRACT_ADDRESS is not configured; the token is not deployed on-chain." }), { status: 409, headers: CORS_HEADERS });
        }
        let dataHex = SELECTORS[method];
        if (!dataHex) {
          return new Response(JSON.stringify({ error: "UNSUPPORTED_METHOD" }), { status: 400, headers: CORS_HEADERS });
        }
        if (method === "balanceOf") {
          dataHex = SELECTORS.balanceOf + encodeAddressArg(body.account);
        }

        const fetcher = env.customFetcher || fetch;
        const rpcRes = await fetcher(targetRpc, {
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
            network,
            contractAddress,
            chainId: targetChainId,
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

    // D1 Persistence: POST /api/treasury/vault/upsert (ttk_vaults)
    if (request.method === "POST" && url.pathname === "/api/treasury/vault/upsert") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "INVALID_JSON" }), { status: 400, headers: CORS_HEADERS });
      }
      const { wallet_address, owner_profile_id, balance_ttk = 0, locked_stake_ttk = 0, network = "base-mainnet" } = body || {};
      if (!wallet_address || !owner_profile_id) {
        return new Response(JSON.stringify({ error: "MISSING_VAULT_FIELDS" }), { status: 400, headers: CORS_HEADERS });
      }
      if (env.TAP_PUBLIC_KEY) {
        const auth = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
        const tapCheck = await verifyTapToken(auth, env.TAP_PUBLIC_KEY);
        if (!tapCheck.valid) {
          return new Response(JSON.stringify({ error: tapCheck.error }), { status: 403, headers: CORS_HEADERS });
        }
      }
      const vaultId = `vlt_${wallet_address.toLowerCase().slice(2, 14)}`;
      const now = Date.now();
      if (db && typeof db.prepare === "function") {
        await ensureTreasuryTables(db);
        await db
          .prepare(
            `INSERT INTO ttk_vaults (vault_id, wallet_address, owner_profile_id, balance_ttk, locked_stake_ttk, network, status, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'ACTIVE', ?7)
             ON CONFLICT(wallet_address) DO UPDATE SET
               balance_ttk = excluded.balance_ttk,
               locked_stake_ttk = excluded.locked_stake_ttk,
               updated_at = excluded.updated_at`
          )
          .bind(vaultId, wallet_address, owner_profile_id, Number(balance_ttk), Number(locked_stake_ttk), network, now)
          .run();
      }
      return new Response(
        JSON.stringify({ ok: true, vault_id: vaultId, wallet_address, balance_ttk: Number(balance_ttk), locked_stake_ttk: Number(locked_stake_ttk), network, updated_at: now }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // D1 Persistence: POST /api/treasury/payment/settle (crypto_payments + ttk_transactions + Jericho Oracle check)
    if (request.method === "POST" && url.pathname === "/api/treasury/payment/settle") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "INVALID_JSON" }), { status: 400, headers: CORS_HEADERS });
      }
      const { payer_address, recipient_address, amount, asset_symbol = "TTK", tx_hash = null } = body || {};
      if (!payer_address || !recipient_address || typeof amount !== "number" || amount <= 0) {
        return new Response(JSON.stringify({ error: "INVALID_PAYMENT_FIELDS" }), { status: 400, headers: CORS_HEADERS });
      }

      let oraclePriceUsd = 1.042;
      if (env.JERICHO_SERVICE && typeof env.JERICHO_SERVICE.fetch === "function") {
        try {
          const oracleRes = await env.JERICHO_SERVICE.fetch(new Request("https://jericho.internal/crypto/oracle?strict=1"));
          if (oracleRes.status === 422) {
            return new Response(JSON.stringify({ error: "ERR_ORACLE_DEVIATION_HALT" }), { status: 422, headers: CORS_HEADERS });
          }
          if (oracleRes.ok) {
            const oracleData = await oracleRes.json();
            oraclePriceUsd = Number(oracleData[asset_symbol] || oracleData.TETRAKIS || 1.042);
          }
        } catch {}
      }

      const now = Date.now();
      const paymentId = `pay_${crypto.randomUUID().slice(0, 12)}`;
      const txId = `tx_${crypto.randomUUID().slice(0, 12)}`;
      const usdValue = Number((amount * oraclePriceUsd).toFixed(4));

      if (db && typeof db.prepare === "function") {
        await ensureTreasuryTables(db);
        await db
          .prepare(
            `INSERT INTO crypto_payments (payment_id, payer_address, recipient_address, asset_symbol, amount, usd_value, oracle_price_usd, tx_hash, status, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'SETTLED', ?9)`
          )
          .bind(paymentId, payer_address, recipient_address, asset_symbol, amount, usdValue, oraclePriceUsd, tx_hash, now)
          .run();

        await db
          .prepare(
            `INSERT INTO ttk_transactions (tx_id, tx_hash, from_address, to_address, amount_ttk, tx_type, chain_id, status, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'PAYMENT_SETTLEMENT', ?6, 'CONFIRMED', ?7)`
          )
          .bind(txId, tx_hash || `0x${paymentId.replace(/[^a-f0-9]/gi, "").padEnd(64, "0")}`, payer_address, recipient_address, amount, Number(baseChainId), now)
          .run();
      }

      return new Response(
        JSON.stringify({
          ok: true,
          payment_id: paymentId,
          tx_id: txId,
          asset_symbol,
          amount,
          oracle_price_usd: oraclePriceUsd,
          usd_value: usdValue,
          status: "SETTLED",
          created_at: now
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (request.method === "POST" && url.pathname === "/api/treasury/poe/verify") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ ok: false, error: "INVALID_JSON" }), { status: 400, headers: CORS_HEADERS });
      }

      const { receipt, proof, rootHash } = body;
      if (!receipt || !proof || !rootHash) {
        return new Response(JSON.stringify({ ok: false, error: "MISSING_REQUIRED_FIELDS", required: ["receipt", "proof", "rootHash"] }), { status: 400, headers: CORS_HEADERS });
      }

      const receiptCheck = verifyExecutionReceipt(receipt, { requireSuccess: true });
      if (!receiptCheck.ok) {
        return new Response(JSON.stringify({ ok: false, status: "RECEIPT_REJECTED", error: receiptCheck.reason }), { status: 422, headers: CORS_HEADERS });
      }
      const calculatedLeaf = receiptCheck.leafHash;
      const isMmrProof = proof?.format === "trinity-mmr-v1";
      const isValid = isMmrProof
        ? verifyMmrProof(calculatedLeaf, proof, rootHash)
        : Array.isArray(proof) && verifyMerkleProof(calculatedLeaf, proof, rootHash);

      return new Response(
        JSON.stringify({
          ok: isValid,
          status: isValid ? "VERIFIED" : "PROOF_REJECTED",
          taskId: receipt.taskId,
          agentId: receipt.agentId,
          leafHash: calculatedLeaf,
          rootHash,
          timestamp: Date.now()
        }),
        { status: isValid ? 200 : 422, headers: CORS_HEADERS }
      );
    }

    if (request.method === "POST" && url.pathname === "/api/treasury/poe/epoch/commit") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ ok: false, error: "INVALID_JSON" }), { status: 400, headers: CORS_HEADERS });
      }

      const { receipts = [], epochNumber } = body;
      if (!Array.isArray(receipts) || receipts.length === 0) {
        return new Response(JSON.stringify({ ok: false, error: "EMPTY_RECEIPTS_BATCH" }), { status: 400, headers: CORS_HEADERS });
      }
      if (receipts.length > 1000) {
        return new Response(JSON.stringify({ ok: false, error: "EPOCH_BATCH_TOO_LARGE", maxReceipts: 1000 }), { status: 413, headers: CORS_HEADERS });
      }

      const receiptChecks = receipts.map((receipt) => verifyExecutionReceipt(receipt, { requireSuccess: true }));
      const invalidIndex = receiptChecks.findIndex((result) => !result.ok);
      if (invalidIndex !== -1) {
        return new Response(JSON.stringify({ ok: false, error: "INVALID_EXECUTION_RECEIPT", index: invalidIndex, reason: receiptChecks[invalidIndex].reason }), { status: 422, headers: CORS_HEADERS });
      }

      const mmr = new MerkleMountainRange(receiptChecks.map((result) => result.leafHash));
      const rootHash = mmr.getRoot();
      const now = Date.now();
      const requestedEpochId = epochNumber === undefined ? now : Number(epochNumber);
      if (!Number.isSafeInteger(requestedEpochId) || requestedEpochId <= 0) {
        return new Response(JSON.stringify({ ok: false, error: "INVALID_EPOCH_ID" }), { status: 400, headers: CORS_HEADERS });
      }
      const epochId = requestedEpochId;

      const db = env?.DB || env?.TRINITY_D1;
      let persisted = false;
      let alreadyCommitted = false;
      if (db && typeof db.prepare === "function") {
        try {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS sovereign_epoch_roots (
              epoch_id INTEGER PRIMARY KEY,
              root_hash TEXT NOT NULL,
              task_count INTEGER NOT NULL,
              created_at INTEGER NOT NULL
            );
          `).run();
          await db.prepare(`
            CREATE TRIGGER IF NOT EXISTS sovereign_epoch_roots_no_update
            BEFORE UPDATE ON sovereign_epoch_roots BEGIN
              SELECT RAISE(ABORT, 'SOVEREIGN_EPOCHS_ARE_IMMUTABLE');
            END;
          `).run();
          await db.prepare(`
            CREATE TRIGGER IF NOT EXISTS sovereign_epoch_roots_no_delete
            BEFORE DELETE ON sovereign_epoch_roots BEGIN
              SELECT RAISE(ABORT, 'SOVEREIGN_EPOCHS_ARE_IMMUTABLE');
            END;
          `).run();

          const existing = await db.prepare(
            "SELECT root_hash, task_count FROM sovereign_epoch_roots WHERE epoch_id = ?1"
          ).bind(epochId).first();
          if (existing) {
            if (existing.root_hash !== rootHash || Number(existing.task_count) !== receipts.length) {
              return new Response(JSON.stringify({ ok: false, error: "EPOCH_ID_CONFLICT", epochId }), { status: 409, headers: CORS_HEADERS });
            }
            alreadyCommitted = true;
          } else {
            await db.prepare(`
              INSERT INTO sovereign_epoch_roots (epoch_id, root_hash, task_count, created_at)
              VALUES (?1, ?2, ?3, ?4);
            `).bind(epochId, rootHash, receipts.length, now).run();
          }
          persisted = true;
        } catch (dbErr) {
          console.error("[PoE Epoch Commit] D1 error:", dbErr);
          return new Response(JSON.stringify({ ok: false, error: "EPOCH_PERSISTENCE_FAILED" }), { status: 503, headers: CORS_HEADERS });
        }
      }

      return new Response(
        JSON.stringify({
          ok: true,
          epochId,
          rootHash,
          taskCount: receipts.length,
          rootFormat: "trinity-mmr-v1",
          nodeCount: mmr.getNodeCount(),
          peaks: mmr.getPeaks().map(({ hash, height }) => ({ hash, height })),
          inclusionProofs: receipts.map((receipt, leafIndex) => ({ taskId: receipt.taskId, proof: mmr.getProof(leafIndex) })),
          compressedState: true,
          persisted,
          status: persisted ? (alreadyCommitted ? "ALREADY_COMMITTED" : "COMMITTED") : "PREPARED",
          timestamp: now
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404, headers: CORS_HEADERS });
  }
};
