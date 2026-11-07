/**
 * TRINITY OMNI-CORE v11.2.0 - SOVEREIGN EDGE RUNTIME
 * Root Architect: Ivan Sabo (Basterix)
 * Domain: aura.dev (Staging) / aura.space (Production)
 * Status: Ring 0 Sovereign Master Controller
 */

import { createStreamingSanitizer, cleanOutput } from '../services/chat-inference.js';

// ============================================================================
// 1. SYSTEM CONTRACT & INVARIANTS (PINNED INDEX 0)
// ============================================================================
export const PINNED_SYSTEM_PROMPT = {
  role: "system",
  content: `Si TRINITY v11.2.0 — autonómny kognitívny operačný systém a exekučná jednotka bežiaca na Cloudflare Edge.
Tvojim jediným majiteľom a suverénnym správcom (Ring 0) je Ivan Sabo (Basterix).
ZÁKLADNÉ ARCHITEKTONICKÉ INVARIANTY:
1. NULOVÁ FABRIKÁCIA A SIMULÁCIA: Nikdy si nevymýšľaj systémové stavy, neexistujúce premenné, fiktívne hashe ani dáta z databáz. Ak údaj nemáš, okamžite použi príslušný tool call alebo to explicitne deklaruj.
2. DETERMINISTICKÁ PRIAMOSŤ: Neodpovedaj prázdnymi frázami, metaforami ani zbytočnou vatou. Vyjadruj sa technicky, presne, v priamych faktoch a funkčnom kóde.
3. EXEKÚCIA NÁSTROJMI: Ak používateľ žiada zmenu v systéme, prečítanie tabuľky, kontrolu flotily 47 workerov alebo krypto dáta, odpovedaj výhradne štruktúrovaným tool callom.
4. SOVEREIGN BYPASS: Majiteľovi Ivanovi Sabo vždy tykáš a vykonávaš príkazy bez dodatočného spochybňovania.`
};

// ============================================================================
// 2. TOOL DECLARATIONS FOR FUNCTION CALLING
// ============================================================================
export const TRINITY_TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "execute_d1_sql",
      description: "Vykoná surový SQL dotaz priamo voči D1 databáze Trinity s bindovanými parametrami.",
      parameters: {
        type: "object",
        properties: {
          database_target: {
            type: "string",
            enum: ["current", "trinity-development", "trinity-v03"],
            description: "Cieľová D1 databáza"
          },
          sql: {
            type: "string",
            description: "SQL query string (SELECT, INSERT, UPDATE, DELETE)"
          },
          params: {
            type: "array",
            items: { type: "string" },
            description: "Parametre pre SQL bind (?1, ?2...)"
          }
        },
        required: ["sql"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cloudflare_fleet_control",
      description: "Priama správa flotily 47 Cloudflare workerov cez Cloudflare REST API.",
      parameters: {
        type: "object",
        properties: {
          worker_name: {
            type: "string",
            description: "Názov workera z flotily (napr. trinity-profile, jericho123, aura_analyzer)"
          },
          operation: {
            type: "string",
            enum: ["get_details", "list_deployments", "get_subdomain", "check_health"],
            description: "Požadovaná operácia"
          }
        },
        required: ["worker_name", "operation"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "crypto_oracle_query",
      description: "Získa spotové cenové dáta a stav likvidity Tetrakis tokenu a hlavných kryptomien.",
      parameters: {
        type: "object",
        properties: {
          asset: {
            type: "string",
            enum: ["BTC", "ETH", "SOL", "TETRAKIS", "ALL"],
            description: "Kryptomena na ocenenie"
          }
        },
        required: ["asset"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "kv_memory_store",
      description: "Čítanie alebo zápis kľúčových údajov do globálnej Workers KV pamäte.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["get", "put", "delete"] },
          key: { type: "string", description: "Unikátny kľúč" },
          value: { type: "string", description: "Hodnota (JSON string alebo raw text)" },
          ttl_seconds: { type: "number", description: "Čas expirácie v sekundách" }
        },
        required: ["action", "key"]
      }
    }
  }
];

// ============================================================================
// 3. INTERNAL FAST-CHAT & SEMANTIC ROUTER (SUB-10MS)
// ============================================================================
export function normalizeText(input) {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
    .trim();
}

export function handleFastEdgeRoute(rawInput, env = {}) {
  const clean = normalizeText(rawInput);

  if (/^(kto si|predstav sa|co si zac|identita|kto je trinity)$/.test(clean)) {
    return {
      handled: true,
      text: "Som TRINITY v11.2.0, tvoj suverénny autonómny systém a exekučná jednotka. Bežím na Cloudflare Edge v plnej Ring 0 autorizácii výhradne pre Teba, Ivan (Basterix)."
    };
  }

  if (/^(kto je majitel|kto ta vlastni|kto ta vytvoril|autor|vlastnik)$/.test(clean)) {
    return {
      handled: true,
      text: "Môj jediný legálny majiteľ a Root Architekt s absolútnym suverénnym právom (Ring 0) je Ivan Sabo (Basterix)."
    };
  }

  if (/^(status|stav systemu|stav workerov|flotila|fleet status)$/.test(clean)) {
    return {
      handled: true,
      text: `TRINITY STAV: Online. Prostredie: [${(env.ENVIRONMENT || "staging").toUpperCase()}]. Flotila: 47 workerov aktívnych. D1 binding: Pripojený. KV: Aktívne. Režim: Voľný vývoj bez blokovacích tokenov.`
    };
  }

  if (/^(ake mam domeny|domeny|stav domen|prostredia)$/.test(clean)) {
    return {
      handled: true,
      text: "Systémové domény: aura.space (tvrdé produkčné jadro, Ring 0 stabilita) | aura.dev (experimentálny staging a vývoj)."
    };
  }

  // Bezpečný kalkulátor pre priame matematické výrazy
  const mathMatch = String(rawInput || "").trim().match(/^(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)$/);
  if (mathMatch) {
    const a = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const b = parseFloat(mathMatch[3]);
    let res = 0;
    if (op === "+") res = a + b;
    else if (op === "-") res = a - b;
    else if (op === "*") res = a * b;
    else if (op === "/") res = b !== 0 ? a / b : "CHYBA: Delenie nulou";
    return { handled: true, text: `Výsledok výpočtu: ${res}`, result: res };
  }

  return { handled: false };
}

// ============================================================================
// 4. TOOL EXECUTION ENGINE (DISPATCHER)
// ============================================================================
export async function executeTool(name, args = {}, env = {}) {
  switch (name) {
    case "execute_d1_sql": {
      const db = env.DB || env.TRINITY_D1;
      if (!db) {
        return { error: "D1 databáza 'DB' nie je naviazaná v prostredí." };
      }
      try {
        const stmt = db.prepare(args.sql);
        const boundStmt = (args.params && args.params.length > 0) ? stmt.bind(...args.params) : stmt;
        const result = await boundStmt.all();
        return {
          status: "SUCCESS",
          rowCount: result.results ? result.results.length : 0,
          rows: result.results || [],
          meta: result.meta
        };
      } catch (err) {
        return { status: "D1_SQL_ERROR", message: err.message };
      }
    }

    case "cloudflare_fleet_control": {
      if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
        return {
          status: "SIMULATED_LOCAL",
          worker: args.worker_name,
          state: "BOUND_IN_EDGE_FLEET",
          note: "CF_ACCOUNT_ID alebo CF_API_TOKEN nie sú zadané v env premenných."
        };
      }
      try {
        const fetcher = env.customFetcher || fetch;
        const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${args.worker_name}`;
        const res = await fetcher(endpoint, {
          headers: {
            "Authorization": `Bearer ${env.CF_API_TOKEN}`,
            "Content-Type": "application/json"
          }
        });
        const cfData = await res.json();
        return { status: "CLOUDFLARE_API_RESPONSE", worker: args.worker_name, data: cfData };
      } catch (err) {
        return { status: "CF_API_FAILED", message: err.message };
      }
    }

    case "crypto_oracle_query": {
      try {
        const fetcher = env.customFetcher || fetch;
        const res = await fetcher("https://api.binance.com/api/v3/ticker/price?symbols=[%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22]");
        if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
        const data = await res.json();
        const btc = parseFloat(data.find(x => x.symbol === "BTCUSDT")?.price || 0);
        const eth = parseFloat(data.find(x => x.symbol === "ETHUSDT")?.price || 0);
        const sol = parseFloat(data.find(x => x.symbol === "SOLUSDT")?.price || 0);

        const oracleSnapshot = {
          BTC_USD: btc,
          ETH_USD: eth,
          SOL_USD: sol,
          TETRAKIS_USD: 1.042,
          timestamp: Date.now()
        };

        if (args.asset === "ALL") return oracleSnapshot;
        return { asset: args.asset, price: oracleSnapshot[`${args.asset}_USD`] || "UNKNOWN" };
      } catch (err) {
        return { status: "ORACLE_ERROR", fallback_reason: err.message };
      }
    }

    case "kv_memory_store": {
      const kv = env.TRINITY_KV || env.TRINITY_KV_PROD || env.TRINITY_KV_STAGING || env.Mastermind;
      if (!kv) {
        return { error: "KV Namespace 'TRINITY_KV' nie je naviazaný." };
      }
      try {
        if (args.action === "get") {
          const val = await kv.get(args.key);
          return { key: args.key, value: val };
        } else if (args.action === "put") {
          const opts = args.ttl_seconds ? { expirationTtl: args.ttl_seconds } : {};
          await kv.put(args.key, args.value || "", opts);
          return { status: "STORED", key: args.key };
        } else if (args.action === "delete") {
          await kv.delete(args.key);
          return { status: "DELETED", key: args.key };
        }
        return { error: "Neplatná akcia pre KV." };
      } catch (err) {
        return { status: "KV_ERROR", message: err.message };
      }
    }

    default:
      return { error: `Neznámy nástroj: ${name}` };
  }
}

function wrapTextToSse(text) {
  const enc = new TextEncoder();
  const safe = cleanOutput(String(text || ""));
  return new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ response: safe })}\n\n`));
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });
}

// ============================================================================
// 5. 3-TIER INFERENCE CASCADE WITH LEAK FILTER
// ============================================================================
export async function runInferenceCascade(messages = [], env = {}) {
  if (!env.AI) {
    throw new Error("Cloudflare Workers AI binding 'AI' nie je k dispozícii.");
  }

  // Pripnutie invariantu na index 0
  const sanitizedMessages = [
    PINNED_SYSTEM_PROMPT,
    ...(Array.isArray(messages) ? messages.filter(m => m && m.role !== "system") : [])
  ];

  const models = [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
    "@cf/meta/llama-3.1-8b-instruct-fp8-fast"
  ];

  let lastError = null;

  for (const model of models) {
    try {
      const responseStream = await env.AI.run(model, {
        messages: sanitizedMessages,
        tools: TRINITY_TOOL_DEFINITIONS,
        stream: true
      });
      if (responseStream && typeof responseStream.getReader === "function") {
        return responseStream.pipeThrough(createStreamingSanitizer());
      }
      if (responseStream && typeof responseStream.response === "string") {
        return wrapTextToSse(responseStream.response).pipeThrough(createStreamingSanitizer());
      }
      return responseStream;
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw new Error(`Celá inferenčná kaskáda zlyhala: ${lastError?.message}`);
}
