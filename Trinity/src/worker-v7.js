/**
 * AURA Trinity v7.0.0 — Refaktorovaný Worker
 * Zero Local Footprint — sub-megabajtový runtime
 *
 * Architektúra:
 *   Statické assets → Cloudflare CDN (env.ASSETS)
 *   API routy → Router + D1 + Dispatcher + StreamGuard
 *   AI → Fallback kaskáda + D1 system prompty + trace logovanie
 *   Tools → Tool Registry + Service Bindings + core_tool_receipts
 *
 * Bindings: pozri wrangler.jsonc
 */

import { Router, json, preflight } from './lib/router.js';
import { D1 } from './lib/d1.js';
import { Dispatcher } from './services/dispatcher.js';
import { StreamGuard } from './lib/stream-guard.js';
import {
  validateChatPayload, validateToolExecution, validateSettingUpdate,
  validateDNSRecord, validateConversation, validateProject, validateTask,
  safeParse, boundString, safeNumber
} from './lib/contracts.js';

const VERSION = "7.0.0";

// Fallback models
const FALLBACK_MODELS = {
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/meta/llama-3.1-8b-instruct-fast": "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
};

const MODEL_REGISTRY = {
  balanced: { model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B", maxTokens: 2048 },
  fast: { model: "@cf/meta/llama-3.1-8b-instruct-fast", label: "Llama 3.1 8B", maxTokens: 1024 },
  code: { model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B (Code)", maxTokens: 4096 },
  reasoning: { model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B (Reasoning)", maxTokens: 4096 },
};

const HARDCODED_PROMPT = `Si Trinity. Pokročilý AI asistent. Komunikuj v slovenčine alebo angličtine. Nikdy v češtine. Buď prirodzený a ústretový.`;

// ═══════════════════════════════════════════════════════════
// AI LAYER — s fallback kaskádou a logovaním
// ═══════════════════════════════════════════════════════════

async function runAI(env, d1, messages, modelKey = "balanced", traceId = null) {
  const profile = MODEL_REGISTRY[modelKey] || MODEL_REGISTRY.balanced;
  const maxTokens = safeNumber(await d1.getSetting("model.max_tokens", profile.maxTokens), 100, 8192, profile.maxTokens);
  const temperature = safeNumber(await d1.getSetting("model.temperature", "0.7"), 0, 2, 0.7);
  const primary = profile.model;
  const fallback = FALLBACK_MODELS[primary] || "@cf/meta/llama-3.1-8b-instruct-fast";
  const start = Date.now();

  // Try primary
  try {
    const resp = await env.AI.run(primary, { messages, max_tokens: maxTokens, temperature });
    const ms = Date.now() - start;
    await d1.log(traceId, "ai-runner", "model.success", "info",
      `${primary} OK ${ms}ms`, { model: primary, ms, modelKey }, "ok", ms);
    await d1.updateRouteStats("route-" + (modelKey === "code" ? "coding" : modelKey === "reasoning" ? "reasoning" : "chat"), true, ms);
    return { response: resp.response || resp, model: profile.label, modelKey, latencyMs: ms, fallbackUsed: false };
  } catch (primaryErr) {
    await d1.log(traceId, "ai-runner", "model.primary.failed", "error",
      `${primary} FAILED: ${primaryErr.message}`, { model: primary, error: primaryErr.message }, "error");

    // Try fallback
    try {
      const resp = await env.AI.run(fallback, { messages, max_tokens: maxTokens, temperature });
      const ms = Date.now() - start;
      await d1.log(traceId, "ai-runner", "model.fallback.success", "warn",
        `Fell back to ${fallback} in ${ms}ms`, { primary, fallback, ms }, "ok", ms);
      await d1.updateRouteStats("route-" + (modelKey === "code" ? "coding" : modelKey === "reasoning" ? "reasoning" : "chat"), false, ms, primaryErr.message);
      return { response: resp.response || resp, model: `Fallback (${fallback.split("/").pop()})`, modelKey, latencyMs: ms, fallbackUsed: true, primaryError: primaryErr.message };
    } catch (fallbackErr) {
      await d1.log(traceId, "ai-runner", "model.both_failed", "error",
        "Both models failed", { primary, primaryError: primaryErr.message, fallback, fallbackError: fallbackErr.message }, "error");
      return { error: `Primary: ${primaryErr.message} | Fallback: ${fallbackErr.message}`, model: profile.label, fallbackUsed: true };
    }
  }
}

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════

function authorize(request, env) {
  const token = request.headers.get("X-Trinity-Token") || new URL(request.url).searchParams.get("token");
  if (!token) return { ok: false, message: "Token required", status: 401 };
  if (env.TRINITY_SESSION_SECRET && token !== env.TRINITY_SESSION_SECRET) {
    return { ok: false, message: "Invalid token", status: 403 };
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════
// ROUTER SETUP
// ═══════════════════════════════════════════════════════════

function createRouter() {
  const r = new Router();

  // === HEALTH ===
  r.get("/api/health", async (req, env) => {
    let dbOk = false, aiOk = false;
    try { await env.DB.prepare("SELECT 1").run(); dbOk = true; } catch {}
    aiOk = !!env.AI;
    return json({ version: VERSION, status: "online", db: { ok: dbOk }, ai: { ok: aiOk }, timestamp: new Date().toISOString() });
  });

  r.get("/api/status", async (req, env) => {
    return json({
      status: "active",
      system: "Trinity Omni-Core Sovereign AI OS",
      version: VERSION,
      pc_bridge: "http://127.0.0.1:7777/",
      mcp_endpoint: "https://auru.space/mcp"
    });
  });

  r.get("/api/bootstrap", async (req, env) => {
    return json({
      status: "bootstrap_ready",
      system: "Trinity Omni-Core",
      version: VERSION,
      owner: env.TRINITY_OWNER_EMAIL || "saboivan2008@gmail.com",
      pc_bridge_url: "http://127.0.0.1:7777/",
      mcp_url: "https://auru.space/mcp",
      primary_domain: "auru.space",
      staging_domain: "auru.dev"
    });
  });

  // === CHAT ===
  r.post("/api/chat", async (req, env, ctx) => {
    const traceId = crypto.randomUUID();
    const d1 = new D1(env.DB);
    const body = await req.json();
    const payload = validateChatPayload(body);

    await d1.log(traceId, "api", "chat.request", "info",
      `Chat: ${boundString(payload.task, 100)}`, { model: payload.mode, agent: payload.agent });

    // Load system prompts from D1
    const systemPrompt = await d1.getActivePrompts() || HARDCODED_PROMPT;
    const messages = [{ role: "system", content: systemPrompt }];
    for (const m of payload.history) messages.push({ role: m.role, content: m.content });
    messages.push({ role: "user", content: payload.task });

    const result = await runAI(env, d1, messages, payload.mode === "code" ? "code" : "balanced", traceId);

    await d1.log(traceId, "api", "chat.response", result.error ? "error" : "info",
      result.error ? `Error: ${result.error}` : "Chat OK",
      { model: result.model, fallbackUsed: result.fallbackUsed, latencyMs: result.latencyMs },
      result.error ? "error" : "ok", result.latencyMs);

    return json({ ...result, trace_id: traceId });
  });

  // === TOOLS ===
  r.get("/api/tools", async (req, env) => {
    const d1 = new D1(env.DB);
    const tools = await d1.listTools();
    return json({ tools, count: tools.length });
  });

  r.post("/api/tools/execute", async (req, env) => {
    const traceId = crypto.randomUUID();
    const d1 = new D1(env.DB);
    const dispatcher = new Dispatcher(env, d1, traceId);
    const body = await req.json();
    const payload = validateToolExecution(body);
    const result = await dispatcher.executeTool(payload.tool, payload.input, payload.run_id, payload.step);
    return json({ ...result, trace_id: traceId });
  });

  r.get("/api/tools/receipts", async (req, env) => {
    const d1 = new D1(env.DB);
    const r = await d1.query("SELECT * FROM core_tool_receipts ORDER BY created_at DESC LIMIT 50");
    return json({ receipts: r.results || [], count: r.results?.length || 0 });
  });

  // === MODEL HEALTH ===
  r.get("/api/health/models", async (req, env) => {
    const d1 = new D1(env.DB);
    const health = await d1.query("SELECT * FROM trinity_model_health ORDER BY checked_at DESC");
    const routes = await d1.query("SELECT id, model, fallback_model, success_count, error_count, fallback_triggered, avg_latency_ms FROM model_routes");
    return json({ models: health.results || [], routes: routes.results || [] });
  });

  // === TRACES ===
  r.get("/api/traces", async (req, env, ctx, params, query) => {
    const d1 = new D1(env.DB);
    const limit = safeNumber(query.limit, 1, 500, 50);
    const r = await d1.query("SELECT * FROM trinity_trace_log ORDER BY created_at DESC LIMIT ?", [limit]);
    return json({ traces: r.results || [], count: r.results?.length || 0 });
  });

  // === CONVERSATIONS ===
  r.get("/api/conversations", async (req, env) => {
    const d1 = new D1(env.DB);
    return json(await d1.getConversations());
  });

  r.post("/api/conversations", async (req, env) => {
    const d1 = new D1(env.DB);
    const body = await req.json();
    const payload = validateConversation(body);
    return json(await d1.createConversation(payload.title));
  });

  r.get("/api/conversations/:id/messages", async (req, env, ctx, params) => {
    const d1 = new D1(env.DB);
    return json(await d1.getMessages(params.id));
  });

  r.post("/api/conversations/:id/messages", async (req, env, ctx, params) => {
    const d1 = new D1(env.DB);
    const body = await req.json();
    const payload = validateConversation(body);
    return json(await d1.addMessage(params.id, payload.role, payload.message || payload.title));
  });

  // === PROJECTS ===
  r.get("/api/projects", async (req, env) => {
    const d1 = new D1(env.DB);
    return json(await d1.getProjects());
  });

  r.post("/api/projects", async (req, env) => {
    const d1 = new D1(env.DB);
    const body = await req.json();
    const payload = validateProject(body);
    return json(await d1.createProject(payload.name, payload.description));
  });

  // === TASKS ===
  r.get("/api/tasks", async (req, env) => {
    const d1 = new D1(env.DB);
    return json(await d1.getTasks());
  });

  r.post("/api/tasks", async (req, env) => {
    const d1 = new D1(env.DB);
    const body = await req.json();
    const payload = validateTask(body);
    return json(await d1.createTask(payload.title, payload.description, payload.priority, payload.assignee, payload.project_id));
  });

  // === SETTINGS ===
  r.get("/api/settings", async (req, env) => {
    const d1 = new D1(env.DB);
    const r = await d1.query("SELECT key, value, category, description FROM settings ORDER BY category, key");
    const settings = {};
    for (const s of r.results || []) settings[s.key] = s.value;
    return json(settings);
  });

  r.put("/api/settings/:key", async (req, env, ctx, params) => {
    const d1 = new D1(env.DB);
    const body = await req.json();
    const payload = validateSettingUpdate(body);
    await d1.setSetting(params.key, payload.value, payload.category, payload.description);
    return json({ ok: true, key: params.key, value: payload.value });
  });

  r.get("/api/settings/category", async (req, env, ctx, params, query) => {
    const d1 = new D1(env.DB);
    return json(await d1.getSettingsByCategory(query.category));
  });

  // === DOMAINS & ESCROW (RING 0) ===
  r.post("/api/domains/orchestrate", async (req, env) => {
    const body = await req.json().catch(() => ({}));
    const { handleDomainOrchestration } = await import("./tools/domain-orchestrator.js");
    return json(await handleDomainOrchestration(env, body));
  });

  r.get("/api/domains", async (req, env) => {
    try {
      const domains = await env.DB.prepare("SELECT * FROM managed_domains ORDER BY created_at DESC").all();
      const dns = await env.DB.prepare("SELECT * FROM domain_dns_records ORDER BY created_at DESC").all();
      return json({ domains: domains.results || [], dns: dns.results || [] });
    } catch (err) {
      return json({ error: err.message, domains: [], dns: [] });
    }
  });

  r.get("/api/domains/escrow", async (req, env) => {
    try {
      const deals = await env.DB.prepare("SELECT * FROM domain_escrow_deals ORDER BY created_at DESC").all();
      return json({ deals: deals.results || [], count: deals.results?.length || 0 });
    } catch (err) {
      return json({ error: err.message, deals: [] });
    }
  });

  return r;
}

// ═══════════════════════════════════════════════════════════
// MAIN WORKER
// ═══════════════════════════════════════════════════════════

const router = createRouter();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") return preflight();

    // API a dynamické routy → Worker runtime
    if (url.pathname.startsWith("/api/") || url.pathname === "/chat") {
      const traceId = request.headers.get("X-Trinity-Trace-Id") || crypto.randomUUID();
      const d1 = new D1(env.DB);

      // Auth (okrem health)
      if (url.pathname !== "/api/health") {
        const auth = authorize(request, env);
        if (!auth.ok) return json({ error: auth.message }, auth.status);
      }

      try {
        const result = await router.handle(request, env, ctx);
        if (result) {
          // Pridaj trace ID do response
          const headers = new Headers(result.headers);
          headers.set("X-Trinity-Trace-Id", traceId);
          return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
        }
        return json({ error: "Not found", trace_id: traceId }, 404);
      } catch (err) {
        await d1.log(traceId, "worker", "request.error", "error",
          err.message, { url: url.pathname, error: err.stack }, "error");
        return json({ error: err.message, trace_id: traceId }, 500);
      }
    }

    // Statický obsah → Cloudflare CDN (0 ms CPU)
    return env.ASSETS.fetch(request);
  },

  // Cron trigger pre health check
  async scheduled(event, env, ctx) {
    const d1 = new D1(env.DB);
    const traceId = crypto.randomUUID();
    await d1.log(traceId, "cron", "healthcheck.start", "info", "Scheduled health check");

    const routes = [
      { id: "route-chat", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", fallback: "@cf/meta/llama-3.1-8b-instruct-fast", test: "Ahoj, ako sa máš?" },
      { id: "route-fast", model: "@cf/meta/llama-3.1-8b-instruct-fast", fallback: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", test: "Hlavné mesto Slovenska?" },
      { id: "route-embedding", model: "@cf/baai/bge-base-en-v1.5", fallback: "@cf/baai/bge-small-en-v1.5", test: "trinity ai slovak" },
    ];

    for (const route of routes) {
      const start = Date.now();
      try {
        if (route.id === "route-embedding") {
          await env.AI.run(route.model, { text: [route.test] });
        } else {
          await env.AI.run(route.model, {
            messages: [{ role: "user", content: route.test }],
            max_tokens: 50
          });
        }
        const ms = Date.now() - start;
        await d1.updateModelHealth(route.id, true, "healthy", ms);
        await d1.updateRouteStats(route.id, true, ms);
      } catch (err) {
        const ms = Date.now() - start;
        await d1.updateModelHealth(route.id, true, "error", ms, err.message);
        await d1.updateRouteStats(route.id, false, ms, err.message);
        // Try fallback
        try {
          await env.AI.run(route.fallback, { messages: [{ role: "user", content: route.test }], max_tokens: 50 });
          await d1.updateModelHealth(route.id, false, "healthy", Date.now() - start);
          await d1.log(traceId, "cron", "fallback.success", "warn", `Fallback OK for ${route.id}`);
        } catch (fbErr) {
          await d1.updateModelHealth(route.id, false, "error", Date.now() - start, fbErr.message);
        }
      }
    }

    await d1.log(traceId, "cron", "healthcheck.complete", "info", "Health check done");
  }
};
