/**
 * ============================================================================
 * TRINITY AUTONOMOUS CORE - HIGH-PERFORMANCE INFERENCE WORKER
 * Stack: Cloudflare Workers AI | Zero-Auth | Multi-Tier Circuit Fallback | SSE
 * ============================================================================
 */

// Konfigurácia modelovej matice
const MODEL_TIERS = {
  PRIMARY: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  SECONDARY: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  RAPID_FALLBACK: "@cf/meta/llama-3.1-8b-instruct-fp8-fast"
};

// Striktné timeouty pre jednotlivé vrstvy (v ms)
const TIMEOUTS = {
  PRIMARY: 11000,
  SECONDARY: 9000,
  RAPID: 6000
};

// Circuit Breaker konštanty: 3 zlyhania v okne 60s -> preskočenie na 5 minút
export const CIRCUIT_BREAKER_CONFIG = {
  FAILURE_THRESHOLD: 3,
  WINDOW_MS: 60_000,
  COOLDOWN_MS: 300_000
};

// Interné tokeny blokované v SSE a JSON výstupe
export const FORBIDDEN_LEAK_TOKENS = [
  "System Prompt:",
  "INTERNAL_API_SECRET",
  "Ring 0 Key",
  "trinity-token-store",
  "Môj zoznam nástrojov",
  "Dostupné nástroje"
];

const FORBIDDEN_LEAK_REGEX = new RegExp(
  FORBIDDEN_LEAK_TOKENS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "i"
);

const envCircuitMap = new WeakMap();

function getCircuitStore(env) {
  if (!env || typeof env !== "object") return new Map();
  let store = envCircuitMap.get(env);
  if (!store) {
    store = new Map();
    envCircuitMap.set(env, store);
  }
  return store;
}

function getKvBinding(env) {
  return env?.CIRCUIT_BREAKER_KV || env?.TRINITY_KV || env?.TRINITY_KV_PROD || env?.TRINITY_KV_STAGING || env?.Mastermind || null;
}

export async function isCircuitOpen(env, model, now = Date.now()) {
  const store = getCircuitStore(env);
  let state = store.get(model);
  const kv = getKvBinding(env);
  if (!state && kv && typeof kv.get === "function") {
    try {
      const raw = await kv.get(`cb:${model}`);
      if (raw) {
        state = JSON.parse(raw);
        store.set(model, state);
      }
    } catch {}
  }
  if (!state) return false;
  if (state.openUntil && now < state.openUntil) return true;
  if (state.openUntil && now >= state.openUntil) {
    state.openUntil = 0;
    state.failures = [];
  }
  return false;
}

export async function recordCircuitFailure(env, model, now = Date.now()) {
  const store = getCircuitStore(env);
  const state = store.get(model) || { failures: [], openUntil: 0 };
  state.failures = (state.failures || []).filter(ts => now - ts <= CIRCUIT_BREAKER_CONFIG.WINDOW_MS);
  state.failures.push(now);
  if (state.failures.length >= CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD) {
    state.openUntil = now + CIRCUIT_BREAKER_CONFIG.COOLDOWN_MS;
  }
  store.set(model, state);
  const kv = getKvBinding(env);
  if (kv && typeof kv.put === "function") {
    try {
      await kv.put(`cb:${model}`, JSON.stringify(state), { expirationTtl: 360 });
    } catch {}
  }
  return state;
}

export async function recordCircuitSuccess(env, model) {
  const store = getCircuitStore(env);
  if (store.has(model)) {
    store.set(model, { failures: [], openUntil: 0 });
  }
}

const HEADERS_JSON = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "X-Content-Type-Options": "nosniff"
};

function replyJson(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: HEADERS_JSON });
}

/**
 * Inteligentný orezávač kontextu (Context Slicer) — System Instruction Pinning:
 * Správa na indexe 0 (alebo systémová inštrukcia s osobnosťou Trinity a Ring 0 pravidlami)
 * nesmie byť nikdy orezaná. Orezávajú sa výhradne najstaršie správy z histórie medzi indexom 1 a N-1.
 */
export function sliceContextSafely(messages, maxTotalChars = 40000, maxMessages = 8) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const safeMsgs = messages.filter(m => m && typeof m === "object");
  if (safeMsgs.length === 0) return [];

  const pinnedIndex = safeMsgs[0]?.role === "system" ? 0 : safeMsgs.findIndex(m => m.role === "system");
  const systemMessage = pinnedIndex >= 0 ? safeMsgs[pinnedIndex] : null;
  const conversation = safeMsgs.filter((_, idx) => idx !== pinnedIndex);

  let totalChars = safeMsgs.reduce((acc, m) => acc + (m.content?.length || 0), 0);
  if (totalChars <= maxTotalChars && safeMsgs.length <= maxMessages) {
    return systemMessage ? [systemMessage, ...conversation] : conversation;
  }

  const selected = [];
  let usedChars = typeof systemMessage?.content === "string" ? systemMessage.content.length : 0;
  const availableChars = Math.max(0, maxTotalChars - usedChars);
  const tailLimit = Math.max(0, maxMessages - (systemMessage ? 1 : 0));

  for (const message of conversation.slice(-tailLimit).reverse()) {
    const size = typeof message.content === "string" ? message.content.length : 0;
    if (usedChars + size > maxTotalChars || size > availableChars) continue;
    selected.unshift(message);
    usedChars += size;
  }

  const result = systemMessage ? [systemMessage, ...selected].slice(0, maxMessages) : selected.slice(-maxMessages);
  console.warn(`[Trinity Slicer] Kontext skrátený z ${messages.length} na ${result.length} správ kvôli dĺžke.`);
  return result;
}

/**
 * Agresívny sanitizér výstupu (odstraňuje úniky systémových promptov, interných tokenov a zoznamov nástrojov)
 */
export function cleanOutput(text) {
  if (typeof text !== "string" || !text.trim()) return "";

  let cleaned = text
    .replace(/(?:Môj zoznam nástrojov|Zoznam nástrojov|Dostupné nástroje)[^\n]*\n+(?:\s*\d+\.\s+[a-z0-9_-]+:[^\n]*\n*)+/gi, "")
    .replace(/Môj zoznam nástrojov je interný[^\n]*/gi, "")
    .replace(/Nie je možné, aby ste si mali prístup k zoznamu nástrojov[^\n]*/gi, "")
    .replace(/Nástroje sú určené výhradne na interné volania[^\n]*/gi, "")
    .replace(/System Prompt:[^\n]*/gi, "[REDACTED]")
    .replace(/INTERNAL_API_SECRET[^\s\n]*/gi, "[REDACTED]")
    .replace(/Ring 0 Key[^\n]*/gi, "[REDACTED]")
    .replace(/trinity-token-store[^\s\n]*/gi, "[REDACTED]")
    .trim();

  if (/152\s+expertných\s+zručností|248\s+Copilot\s+skillov/i.test(cleaned)) {
    cleaned = cleaned.replace(/Sabo Ivan, rád sa ti oznam[^\n]*\n*/gi, "")
      .replace(/Mám 152 expertných zručností[^\n]*\n*/gi, "")
      .replace(/Som založená na Cloudflare Edge a mám 29 servisných workerov[^\n]*\n*/gi, "")
      .replace(/Môj primárny AI provider je Cloudflare Workers AI[^\n]*\n*/gi, "")
      .replace(/Môj účel je slúžiť vám, Sabo Ivanovi[^\n]*\n*/gi, "")
      .replace(/Môj jazyk je prirodzený a komunikujem s vámi[^\n]*\n*/gi, "");
  }

  // Deduplikácia halucinačných slučiek
  const parts = cleaned.split(/\n{2,}/);
  if (parts.length <= 1) return cleaned;

  const seen = new Set();
  const deduped = [];
  for (const block of parts) {
    const norm = block.trim().replace(/\s+/g, " ");
    if (norm.length > 25) {
      if (seen.has(norm)) continue;
      seen.add(norm);
    }
    deduped.push(block);
  }
  return deduped.join("\n\n");
}

/**
 * Realtime sliding-window token filter pre SSE streamy.
 * Odchytáva interné tokeny (System Prompt:, INTERNAL_API_SECRET, Ring 0 Key, trinity-token-store)
 * aj pri rozdelení cez hranice chunkov.
 */
export function createStreamingSanitizer() {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let lineBuffer = "";
  let slidingWindow = "";

  return new TransformStream({
    transform(chunk, controller) {
      lineBuffer += dec.decode(chunk, { stream: true });
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) {
          if (line.trim() && FORBIDDEN_LEAK_REGEX.test(line)) continue;
          controller.enqueue(enc.encode(line + "\n"));
          continue;
        }

        const raw = line.slice(6).trim();
        if (raw === "[DONE]") {
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          continue;
        }

        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed.response === "string") {
            const combined = slidingWindow + parsed.response;
            if (FORBIDDEN_LEAK_REGEX.test(parsed.response) || FORBIDDEN_LEAK_REGEX.test(combined)) {
              slidingWindow = "";
              continue;
            }
            slidingWindow = combined.slice(-64);
          }
          controller.enqueue(enc.encode(`data: ${JSON.stringify(parsed)}\n\n`));
        } catch {
          if (FORBIDDEN_LEAK_REGEX.test(raw)) continue;
          controller.enqueue(enc.encode(line + "\n\n"));
        }
      }
    },
    flush(controller) {
      if (lineBuffer.trim() && !FORBIDDEN_LEAK_REGEX.test(lineBuffer)) {
        controller.enqueue(enc.encode(lineBuffer));
      }
    }
  });
}

/**
 * Nekompromisný exekútor inferencie s poistkou proti zamrznutiu
 */
async function executeInference(ai, model, payload, timeoutMs) {
  let timer;
  const timeoutGuard = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`GATEWAY_TIMEOUT: Model ${model} prekročil limit ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const execution = ai.run(model, payload);
    return await Promise.race([execution, timeoutGuard]);
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Diagnostika / Health
    if (url.pathname === "/health" && request.method === "GET") {
      const active = !!env.AI;
      return replyJson({
        status: active ? "HYPER_ACTIVE" : "OFFLINE",
        service: "trinity-matrix-inference",
        engine_ready: active,
        primary_target: env.AI_MODEL || MODEL_TIERS.PRIMARY,
        fallback_target: env.AI_FALLBACK_MODEL || MODEL_TIERS.RAPID_FALLBACK,
        timestamp: Date.now()
      }, active ? 200 : 503);
    }

    if (url.pathname !== "/generate") {
      return replyJson({ error: "Endpoint not found. Target /generate" }, 404);
    }

    if (request.method !== "POST") {
      return replyJson({ error: "Method not allowed. Send POST." }, 405);
    }

    if (!env.AI) {
      return replyJson({ error: "Cloudflare AI binding (env.AI) nie je pripojený." }, 503);
    }

    // 2. Extrakcia dát a validácia
    let rawText;
    try {
      rawText = await request.text();
      if (rawText.length > 60000) {
        return replyJson({ error: "Input too large" }, 413);
      }
    } catch {
      return replyJson({ error: "Input read error" }, 400);
    }

    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      return replyJson({ error: "Malformed payload. Vyžaduje sa čistý JSON." }, 400);
    }

    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return replyJson({ error: "'messages' pole nesmie byť prázdne." }, 400);
    }

    // Overenie správ a rolí
    const validRoles = new Set(["system", "user", "assistant"]);
    if (body.messages.some(item => !item || !validRoles.has(item.role) || typeof item.content !== "string" || item.content.length > 20000)) {
      return replyJson({ error: "Neplatné správy v požiadavke." }, 400);
    }

    // Validácia cieľového modelu
    if (body.model && typeof body.model === "string") {
      const isKnownModel = body.model.startsWith("@cf/") || Object.values(MODEL_TIERS).includes(body.model);
      if (!isKnownModel) {
        return replyJson({ error: "Neplatný model." }, 400);
      }
    }

    const isStreaming = Boolean(body.stream);
    const sanitizedMessages = sliceContextSafely(body.messages);

    const tokenCount = Number.isInteger(body.max_tokens) ? body.max_tokens : 1200;
    const maxTokens = Math.max(16, Math.min(tokenCount > 2048 ? 600 : tokenCount, 4096));

    const payload = {
      messages: sanitizedMessages,
      max_tokens: maxTokens,
      temperature: typeof body.temperature === "number" ? body.temperature : 0.45,
      top_p: 0.9,
      repetition_penalty: 1.15,
      stream: isStreaming
    };

    // Modelový reťazec (Fallback Pipeline)
    const pipeline = [
      body.model || env.AI_MODEL || MODEL_TIERS.PRIMARY,
      MODEL_TIERS.SECONDARY,
      env.AI_FALLBACK_MODEL || MODEL_TIERS.RAPID_FALLBACK
    ];

    // Odstránenie duplicít v reťazci
    const executionQueue = [...new Set(pipeline)];

    const startTime = Date.now();

    // ==========================================================
    // REŽIM: SSE STREAM
    // ==========================================================
    if (isStreaming) {
      let activeStream = null;
      let winningModel = null;
      let attempts = [];

      for (const model of executionQueue) {
        if (await isCircuitOpen(env, model)) {
          attempts.push({ model, error: "Circuit breaker open (skipped)" });
          continue;
        }
        const timeout = model.includes("70b") ? TIMEOUTS.PRIMARY : (model.includes("32b") ? TIMEOUTS.SECONDARY : TIMEOUTS.RAPID);
        try {
          activeStream = await executeInference(env.AI, model, payload, timeout);
          winningModel = model;
          await recordCircuitSuccess(env, model);
          break;
        } catch (err) {
          await recordCircuitFailure(env, model);
          console.warn(`[Trinity Pipeline] Zlyhanie streamu na modeli ${model}:`, err.message);
          attempts.push({ model, error: "Model timeout or unavailable" });
        }
      }

      if (!activeStream) {
        return replyJson({
          error: "Celá modelová matica zlyhala.",
          pipeline_attempts: attempts
        }, 503);
      }

      const streamPipe = activeStream.pipeThrough(createStreamingSanitizer());

      return new Response(streamPipe, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Trinity-Model": winningModel,
          "X-Trinity-Latency": `${Date.now() - startTime}ms`
        }
      });
    }

    // ==========================================================
    // REŽIM: DIRECT BATCH JSON
    // ==========================================================
    let result = null;
    let winningModel = null;
    let errors = [];

    for (const model of executionQueue) {
      if (await isCircuitOpen(env, model)) {
        errors.push({ model, error: "Circuit breaker open (skipped)" });
        continue;
      }
      const timeout = model.includes("70b") ? TIMEOUTS.PRIMARY : (model.includes("32b") ? TIMEOUTS.SECONDARY : TIMEOUTS.RAPID);
      try {
        result = await executeInference(env.AI, model, payload, timeout);
        winningModel = model;
        await recordCircuitSuccess(env, model);
        break;
      } catch (err) {
        await recordCircuitFailure(env, model);
        console.warn(`[Trinity Pipeline] Zlyhanie batchu na modeli ${model}:`, err.message);
        errors.push({ model, error: "Model unavailable or timed out" });
      }
    }

    if (!result) {
      return replyJson({
        error: "Všetky modely v matici Trinity zlyhali.",
        trace: errors,
        total_time_ms: Date.now() - startTime
      }, 503);
    }

    return replyJson({
      success: true,
      response: cleanOutput(result?.response || ""),
      model_used: winningModel,
      latency_ms: Date.now() - startTime,
      fallback_engaged: winningModel !== executionQueue[0]
    });
  }
};
