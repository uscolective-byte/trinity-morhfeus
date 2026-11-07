// services/jericho123/src/index.js

export function computeMedian(numbers) {
  if (!Array.isArray(numbers) || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function fetchFromBinance(fetcher = fetch) {
  const res = await fetcher("https://api.binance.com/api/v3/ticker/price?symbols=[%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22]", {
    headers: { "User-Agent": "Trinity-Crypto-Oracle/1.0" }
  });
  if (!res.ok) throw new Error("BINANCE_DOWN");
  const data = await res.json();
  return {
    BTC: parseFloat(data.find(x => x.symbol === "BTCUSDT")?.price || 0),
    ETH: parseFloat(data.find(x => x.symbol === "ETHUSDT")?.price || 0),
    SOL: parseFloat(data.find(x => x.symbol === "SOLUSDT")?.price || 0)
  };
}

export async function fetchFromCoinbase(fetcher = fetch) {
  const [b, e, s] = await Promise.all([
    fetcher("https://api.coinbase.com/v2/prices/BTC-USD/spot").then(r => {
      if (!r.ok) throw new Error("COINBASE_BTC_DOWN");
      return r.json();
    }),
    fetcher("https://api.coinbase.com/v2/prices/ETH-USD/spot").then(r => {
      if (!r.ok) throw new Error("COINBASE_ETH_DOWN");
      return r.json();
    }),
    fetcher("https://api.coinbase.com/v2/prices/SOL-USD/spot").then(r => {
      if (!r.ok) throw new Error("COINBASE_SOL_DOWN");
      return r.json();
    })
  ]);
  return {
    BTC: parseFloat(b?.data?.amount || 0),
    ETH: parseFloat(e?.data?.amount || 0),
    SOL: parseFloat(s?.data?.amount || 0)
  };
}

function resolveKv(env) {
  return env?.TRINITY_KV || env?.TRINITY_KV_PROD || env?.TRINITY_KV_STAGING || env?.Mastermind || env?.PC_STATE || null;
}

function resolveDb(env) {
  return env?.DB || env?.TRINITY_D1 || null;
}

async function ensureJerichoTables(db) {
  if (!db || typeof db.prepare !== "function") return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS crypto_price_cache (
    symbol TEXT PRIMARY KEY,
    price_usd REAL NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS tetrakis_vaults (
    wallet_address TEXT PRIMARY KEY,
    owner_profile_id TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0.0,
    locked_stake REAL NOT NULL DEFAULT 0.0,
    last_action_timestamp INTEGER NOT NULL
  )`).run();
}

export default {
  async fetch(request, env = {}, ctx = null) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/^\/api(?=\/crypto\/)/, "");
    const kv = resolveKv(env);
    const db = resolveDb(env);
    const fetcher = env?.customFetcher || fetch;

    // GET /crypto/oracle — Live orákulum s konsenzom a mediánom
    if (request.method === "GET" && pathname === "/crypto/oracle") {
      const cacheKey = "ORACLE_PRICES_MEDIAN_CACHE";
      if (kv && typeof kv.get === "function") {
        try {
          const cached = await kv.get(cacheKey, { type: "json" });
          if (cached && typeof cached === "object") {
            return new Response(JSON.stringify({ source: "kv_edge_cache", ...cached }), {
              headers: { "Content-Type": "application/json" }
            });
          }
        } catch {}
      }

      const results = await Promise.allSettled([fetchFromBinance(fetcher), fetchFromCoinbase(fetcher)]);
      const validSources = results.filter(r => r.status === "fulfilled").map(r => r.value);

      if (validSources.length === 0) {
        let records = [];
        if (db && typeof db.prepare === "function") {
          try {
            const fallback = await db.prepare("SELECT * FROM crypto_price_cache ORDER BY updated_at DESC LIMIT 3").all();
            records = fallback?.results || [];
          } catch {}
        }
        return new Response(JSON.stringify({ source: "d1_emergency_fallback", records }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      const btcPrices = validSources.map(s => s.BTC).filter(p => p > 0);
      const ethPrices = validSources.map(s => s.ETH).filter(p => p > 0);
      const solPrices = validSources.map(s => s.SOL).filter(p => p > 0);

      const aggregated = {
        BTC: computeMedian(btcPrices),
        ETH: computeMedian(ethPrices),
        SOL: computeMedian(solPrices),
        TETRAKIS: 1.042,
        timestamp: Date.now(),
        sources_count: validSources.length
      };

      const persistPromise = (async () => {
        if (kv && typeof kv.put === "function") {
          await kv.put(cacheKey, JSON.stringify(aggregated), { expirationTtl: 30 }).catch(() => null);
        }
        if (db && typeof db.prepare === "function") {
          try {
            if (typeof db.batch === "function") {
              await db.batch([
                db.prepare("INSERT OR REPLACE INTO crypto_price_cache (symbol, price_usd, updated_at) VALUES ('BTC', ?1, ?2)").bind(aggregated.BTC, aggregated.timestamp),
                db.prepare("INSERT OR REPLACE INTO crypto_price_cache (symbol, price_usd, updated_at) VALUES ('ETH', ?1, ?2)").bind(aggregated.ETH, aggregated.timestamp),
                db.prepare("INSERT OR REPLACE INTO crypto_price_cache (symbol, price_usd, updated_at) VALUES ('SOL', ?1, ?2)").bind(aggregated.SOL, aggregated.timestamp)
              ]);
            } else {
              await db.prepare("INSERT OR REPLACE INTO crypto_price_cache (symbol, price_usd, updated_at) VALUES ('BTC', ?1, ?2)").bind(aggregated.BTC, aggregated.timestamp).run();
              await db.prepare("INSERT OR REPLACE INTO crypto_price_cache (symbol, price_usd, updated_at) VALUES ('ETH', ?1, ?2)").bind(aggregated.ETH, aggregated.timestamp).run();
              await db.prepare("INSERT OR REPLACE INTO crypto_price_cache (symbol, price_usd, updated_at) VALUES ('SOL', ?1, ?2)").bind(aggregated.SOL, aggregated.timestamp).run();
            }
          } catch {
            await ensureJerichoTables(db).catch(() => null);
          }
        }
      })();

      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(persistPromise);
      } else {
        await persistPromise;
      }

      return new Response(JSON.stringify({ source: "live_consensus", ...aggregated }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // POST /crypto/tetrakis/vault/deposit
    if (request.method === "POST" && pathname === "/crypto/tetrakis/vault/deposit") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "INVALID_DEPOSIT_PAYLOAD" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const { wallet, amount, profile_id } = body || {};
      if (!wallet || typeof amount !== "number" || amount <= 0 || !profile_id) {
        return new Response(JSON.stringify({ error: "INVALID_DEPOSIT_PAYLOAD" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const now = Date.now();
      if (db && typeof db.prepare === "function") {
        const sql = `INSERT INTO tetrakis_vaults (wallet_address, owner_profile_id, balance, locked_stake, last_action_timestamp)
         VALUES (?1, ?2, ?3, 0.0, ?4)
         ON CONFLICT(wallet_address) DO UPDATE SET
           balance = balance + excluded.balance,
           last_action_timestamp = excluded.last_action_timestamp`;
        try {
          await db.prepare(sql).bind(wallet, profile_id, amount, now).run();
        } catch {
          await ensureJerichoTables(db);
          await db.prepare(sql).bind(wallet, profile_id, amount, now).run();
        }
      }

      return new Response(JSON.stringify({ success: true, wallet, deposited: amount, timestamp: now }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("JERICHO_123_ROUTER: 404", { status: 404 });
  }
};
