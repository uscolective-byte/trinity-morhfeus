export interface Env {
  AI?: any;
  TRINITY_SENTINEL?: Fetcher;
  TRINITY_KV?: KVNamespace;
  Mastermind?: KVNamespace;
}

const CIRCUIT_WINDOW_MS = 60_000;
const CIRCUIT_COOLDOWN_MS = 300_000;
const CIRCUIT_FAILURE_THRESHOLD = 3;

const FORBIDDEN_LEAK_REGEX = /System Prompt:|INTERNAL_API_SECRET|Ring 0 Key|trinity-token-store/i;

const circuitMemory = new WeakMap<object, Map<string, { failures: number[]; openUntil: number }>>();

function getCircuitMap(env: Env) {
  if (!env || typeof env !== "object") return new Map<string, { failures: number[]; openUntil: number }>();
  let map = circuitMemory.get(env);
  if (!map) {
    map = new Map();
    circuitMemory.set(env, map);
  }
  return map;
}

export function isTierCircuitOpen(env: Env, model: string, now = Date.now()): boolean {
  const state = getCircuitMap(env).get(model);
  if (!state) return false;
  if (state.openUntil && now < state.openUntil) return true;
  if (state.openUntil && now >= state.openUntil) {
    state.openUntil = 0;
    state.failures = [];
  }
  return false;
}

export function recordTierFailure(env: Env, model: string, now = Date.now()) {
  const map = getCircuitMap(env);
  const state = map.get(model) || { failures: [], openUntil: 0 };
  state.failures = state.failures.filter((ts) => now - ts <= CIRCUIT_WINDOW_MS);
  state.failures.push(now);
  if (state.failures.length >= CIRCUIT_FAILURE_THRESHOLD) {
    state.openUntil = now + CIRCUIT_COOLDOWN_MS;
  }
  map.set(model, state);
  return state;
}

export function createLeakFilterStream(): TransformStream<Uint8Array, Uint8Array> {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let windowBuf = "";
  return new TransformStream({
    transform(chunk, controller) {
      const text = dec.decode(chunk, { stream: true });
      const combined = windowBuf + text;
      if (FORBIDDEN_LEAK_REGEX.test(combined)) {
        const sanitized = text.replace(
          /System Prompt:|INTERNAL_API_SECRET|Ring 0 Key|trinity-token-store/gi,
          "[REDACTED]"
        );
        windowBuf = sanitized.slice(-64);
        controller.enqueue(enc.encode(sanitized));
        return;
      }
      windowBuf = combined.slice(-64);
      controller.enqueue(chunk);
    }
  });
}

export function sliceContextSafely(messages: any[], maxTotalChars = 40000, maxMessages = 8) {
  if (!Array.isArray(messages)) return [];
  const safeMsgs = messages.filter((m: any) => m && typeof m === "object");
  if (safeMsgs.length === 0) return [];
  const systemMessage = safeMsgs.find((message: any) => message.role === "system");
  const conversation = safeMsgs.filter((message: any) => message.role !== "system");
  const selected: any[] = [];
  let usedChars = typeof systemMessage?.content === "string" ? systemMessage.content.length : 0;
  const availableChars = Math.max(0, maxTotalChars - usedChars);
  const tailLimit = Math.max(0, maxMessages - (systemMessage ? 1 : 0));
  for (const message of conversation.slice(-tailLimit).reverse()) {
    const size = typeof message.content === "string" ? message.content.length : 0;
    if (usedChars + size > maxTotalChars || size > availableChars) continue;
    selected.unshift(message);
    usedChars += size;
  }
  if (systemMessage) {
    // Keep the original system instruction first, even when history must be reduced.
    return [systemMessage, ...selected].slice(0, maxMessages);
  }
  return selected.slice(-maxMessages);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-chat-inference", version: "10.3.0", status: "serving" });
    }
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" } });
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    let payload: any;
    try { payload = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
    const rawMsgs = Array.isArray(payload?.messages) ? payload.messages : [];
    const msgs = sliceContextSafely(rawMsgs, 40000, 8);
    const models = [
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
      "@cf/meta/llama-3.1-8b-instruct-fp8-fast"
    ];
    for (const model of models) {
      if (isTierCircuitOpen(env, model)) continue;
      try {
        if (env.AI) {
          const stream = await env.AI.run(model, { messages: msgs, stream: true });
          const filtered = stream && typeof stream.pipeThrough === "function"
            ? stream.pipeThrough(createLeakFilterStream())
            : stream;
          return new Response(filtered, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Model-Used": model } });
        }
      } catch (err) {
        recordTierFailure(env, model);
        continue;
      }
    }
    return Response.json({ worker: "trinity-chat-inference", status: "FALLBACK_READY", slicedCount: msgs.length, models });
  }
};
