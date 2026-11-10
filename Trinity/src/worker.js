// src/worker.js - Main Trinity Edge Worker v7.0.0
// + Tools API + Model Health + Traces + Tool Execution

import { Router, json, logTrace } from "./router.js";
import { ChatAgent } from "./chat-agent.js";

export { ChatAgent };

const router = new Router();

// ═══════════════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════════════

router.get("/api/health", async ({ env }) => {
  let dbOk = false, aiOk = false;
  try { await env.DB.prepare("SELECT 1").run(); dbOk = true; } catch {}
  aiOk = !!env.AI;
  return json({
    status: "ok",
    version: "7.0.0",
    system: "Trinity Omni-Core",
    edge: "Cloudflare Workers",
    db: { ok: dbOk },
    ai: { ok: aiOk },
    timestamp: Date.now(),
  });
});

router.get("/api/status", async ({ env }) => {
  return json({
    status: "active",
    system: "Trinity Omni-Core Sovereign AI OS",
    version: "7.0.0",
    architecture: "Edge Hypervisor + Multi-Agent Swarm",
    pc_bridge: { target: "http://127.0.0.1:7777/", status: "ready" },
    mcp_endpoint: "https://auru.space/mcp",
    bound_workers_count: 30,
    timestamp: Date.now()
  });
});

router.get("/api/bootstrap", async ({ env }) => {
  return json({
    status: "bootstrap_ready",
    system: "Trinity Omni-Core",
    version: "7.0.0",
    owner: env.TRINITY_OWNER_EMAIL || "saboivan2008@gmail.com",
    pc_bridge_url: "http://127.0.0.1:7777/",
    mcp_url: "https://auru.space/mcp",
    primary_domain: "auru.space",
    staging_domain: "auru.dev",
    models: {
      primary: env.AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      fast: env.AI_FAST_MODEL || "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
      openai: env.OPENAI_MODEL || "gpt-4.1-mini",
      gemini: env.GEMINI_MODEL || "gemini-3.8-flash"
    },
    initialized_at: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════════

router.post("/chat", async ({ request, env }) => {
  const traceId = request.headers.get("X-Trinity-Trace-Id") || crypto.randomUUID();

  try {
    const body = await request.json();
    const task = typeof body.task === "string" ? body.task.trim() : "";

    if (!task) {
      return json({ error: "TASK_REQUIRED" }, 400);
    }

    const sessionId = request.headers.get("X-Session-Id") || body.sessionId || "default-session";
    const mode = ["single", "team", "control"].includes(body.mode) ? body.mode : "single";
    const agent = typeof body.agent === "string" ? body.agent : "ORCHESTRATOR";
    const provider = typeof body.provider === "string" ? body.provider : "workers-ai";

    // Log chat request
    await logTrace(env, traceId, "api", "chat.request", "info",
      `Chat: ${task.slice(0, 100)}`, { sessionId, mode, agent, provider });

    // Route message through CHAT_AGENT Durable Object
    const id = env.CHAT_AGENT.idFromName(sessionId);
    const stub = env.CHAT_AGENT.get(id);

    const doRequest = new Request("https://chat-agent/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Trinity-Trace-Id": traceId,
      },
      body: JSON.stringify({ task, mode, agent, provider }),
    });

    const response = await stub.fetch(doRequest);

    // Log response
    const respBody = await response.json();
    await logTrace(env, traceId, "api", "chat.response",
      respBody.error ? "error" : "info",
      respBody.error ? `Error: ${respBody.error}` : "Chat OK",
      { model: respBody.model, fallbackUsed: respBody.fallbackUsed, latencyMs: respBody.latencyMs },
      respBody.error ? "error" : "ok",
      respBody.latencyMs
    );

    const corsHeaders = new Headers({
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "X-Trinity-Trace-Id": traceId,
    });

    return new Response(JSON.stringify({ ...respBody, trace_id: traceId }), {
      status: response.status,
      headers: corsHeaders,
    });
  } catch (err) {
    await logTrace(env, traceId, "api", "chat.error", "error", err.message, { error: err.stack });
    return json({ error: "INTERNAL_CORE_FAULT", message: err.message, trace_id: traceId }, 500);
  }
});

// Chat History retrieval
router.get("/api/chat/history", async ({ request, env, url }) => {
  const sessionId = request.headers.get("X-Session-Id") || url.searchParams.get("sessionId") || "default-session";
  const id = env.CHAT_AGENT.idFromName(sessionId);
  const stub = env.CHAT_AGENT.get(id);

  const response = await stub.fetch("https://chat-agent/history");
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(response.body, {
    status: response.status,
    headers,
  });
});

// Clear chat history
router.delete("/api/chat/history", async ({ request, env, url }) => {
  const sessionId = request.headers.get("X-Session-Id") || url.searchParams.get("sessionId") || "default-session";
  const id = env.CHAT_AGENT.idFromName(sessionId);
  const stub = env.CHAT_AGENT.get(id);

  const response = await stub.fetch("https://chat-agent/clear");
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(response.body, {
    status: response.status,
    headers,
  });
});

// ═══════════════════════════════════════════════════════════
// TOOLS API — Tool Execution Loop
// ═══════════════════════════════════════════════════════════

// List all available tools
router.get("/api/tools", async ({ env }) => {
  try {
    const r = await env.DB.prepare(
      "SELECT tool_id, name, category, description, handler_target, success_count, error_count, avg_latency_ms FROM trinity_tool_registry WHERE enabled=1 ORDER BY category, name"
    ).all();
    return json({ tools: r.results || [], count: r.results?.length || 0 });
  } catch (e) {
    return json({ error: e.message, tools: [] });
  }
});

// Execute a tool via service binding
router.post("/api/tools/execute", async ({ request, env }) => {
  const traceId = request.headers.get("X-Trinity-Trace-Id") || crypto.randomUUID();

  try {
    const body = await request.json();
    const { tool, input = {}, run_id, step = 0 } = body;

    if (!tool || typeof tool !== "string") {
      return json({ error: "TOOL_REQUIRED" }, 400);
    }

    const rid = run_id || crypto.randomUUID();
    const receiptId = crypto.randomUUID();

    // Get tool definition from registry
    const toolDef = await env.DB.prepare(
      "SELECT * FROM trinity_tool_registry WHERE tool_id=? AND enabled=1"
    ).bind(tool).first();

    if (!toolDef) {
      return json({ status: "not_found", error: `Tool ${tool} not registered` }, 404);
    }

    // Get service binding
    const binding = env[toolDef.handler_target];
    if (!binding) {
      // Record failed receipt
      try {
        await env.DB.prepare(
          "INSERT INTO core_tool_receipts (id, run_id, step, tool, status, receipt_id, input_json, output_json) VALUES (?,?,?,?,?,?,?,?)"
        ).bind(crypto.randomUUID(), rid, step, tool, "failed", receiptId,
          JSON.stringify(input).slice(0, 8192), '{"error":"no binding"}').run();
      } catch (e) {}

      await logTrace(env, traceId, "tool-executor", "tool.no_handler", "error",
        `No binding for ${tool}: ${toolDef.handler_target}`,
        { tool, target: toolDef.handler_target });

      return json({ status: "no_handler", error: `Service binding not available: ${toolDef.handler_target}`, trace_id: traceId }, 502);
    }

    // Execute via service binding
    const start = Date.now();
    try {
      const resp = await binding.fetch(`/tool/${tool}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Trinity-Trace-Id": traceId,
        },
        body: JSON.stringify({ tool, input, run_id: rid, step }),
      });

      const ms = Date.now() - start;
      const output = await resp.json();

      if (resp.ok) {
        // Record success receipt
        try {
          await env.DB.prepare(
            "INSERT INTO core_tool_receipts (id, run_id, step, tool, status, receipt_id, input_json, output_json) VALUES (?,?,?,?,?,?,?,?)"
          ).bind(crypto.randomUUID(), rid, step, tool, "completed", receiptId,
            JSON.stringify(input).slice(0, 8192), JSON.stringify(output).slice(0, 8192)).run();

          await env.DB.prepare(
            "UPDATE trinity_tool_registry SET success_count=success_count+1, avg_latency_ms=(avg_latency_ms+?)/2, last_used=datetime('now') WHERE tool_id=?"
          ).bind(ms, tool).run();
        } catch (e) {}

        await logTrace(env, traceId, "tool-executor", "tool.success", "info",
          `${tool} completed in ${ms}ms`, { tool, ms }, "ok", ms);

        return json({ status: "success", output, receipt_id: receiptId, latencyMs: ms, trace_id: traceId });
      } else {
        // Record error receipt
        try {
          await env.DB.prepare(
            "INSERT INTO core_tool_receipts (id, run_id, step, tool, status, receipt_id, input_json, output_json) VALUES (?,?,?,?,?,?,?,?)"
          ).bind(crypto.randomUUID(), rid, step, tool, "failed", receiptId,
            JSON.stringify(input).slice(0, 8192), JSON.stringify(output).slice(0, 8192)).run();

          await env.DB.prepare(
            "UPDATE trinity_tool_registry SET error_count=error_count+1, last_used=datetime('now') WHERE tool_id=?"
          ).bind(tool).run();
        } catch (e) {}

        await logTrace(env, traceId, "tool-executor", "tool.error", "error",
          `${tool} failed`, { tool, ms, error: output.error });

        return json({ status: "error", error: output.error, receipt_id: receiptId, latencyMs: ms, trace_id: traceId }, resp.status);
      }
    } catch (err) {
      const ms = Date.now() - start;
      try {
        await env.DB.prepare(
          "INSERT INTO core_tool_receipts (id, run_id, step, tool, status, receipt_id, input_json, output_json) VALUES (?,?,?,?,?,?,?,?)"
        ).bind(crypto.randomUUID(), rid, step, tool, "failed", receiptId,
          JSON.stringify(input).slice(0, 8192), JSON.stringify({ error: err.message }).slice(0, 8192)).run();

        await env.DB.prepare(
          "UPDATE trinity_tool_registry SET error_count=error_count+1, last_used=datetime('now') WHERE tool_id=?"
        ).bind(tool).run();
      } catch (e) {}

      await logTrace(env, traceId, "tool-executor", "tool.exception", "error",
        `${tool} threw: ${err.message}`, { tool, ms, error: err.message });

      return json({ status: "exception", error: err.message, receipt_id: receiptId, latencyMs: ms, trace_id: traceId }, 500);
    }
  } catch (err) {
    return json({ error: err.message, trace_id: traceId }, 500);
  }
});

// List tool receipts
router.get("/api/tools/receipts", async ({ env, url }) => {
  try {
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const r = await env.DB.prepare(
      "SELECT * FROM core_tool_receipts ORDER BY created_at DESC LIMIT ?"
    ).bind(limit).all();
    return json({ receipts: r.results || [], count: r.results?.length || 0 });
  } catch (e) {
    return json({ error: e.message, receipts: [] });
  }
});

// ═══════════════════════════════════════════════════════════
// DOMAIN ORCHESTRATION & ESCROW (RING 0)
// ═══════════════════════════════════════════════════════════

router.post("/api/domains/orchestrate", async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { handleDomainOrchestration } = await import("./tools/domain-orchestrator.js");
    const result = await handleDomainOrchestration(env, body);
    return json(result);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

router.get("/api/domains", async ({ env }) => {
  try {
    const domains = await env.DB.prepare(
      "SELECT * FROM managed_domains ORDER BY created_at DESC"
    ).all();
    const dns = await env.DB.prepare(
      "SELECT * FROM domain_dns_records ORDER BY created_at DESC"
    ).all();
    return json({ domains: domains.results || [], dns: dns.results || [] });
  } catch (err) {
    return json({ error: err.message, domains: [], dns: [] });
  }
});

router.get("/api/domains/escrow", async ({ env }) => {
  try {
    const deals = await env.DB.prepare(
      "SELECT * FROM domain_escrow_deals ORDER BY created_at DESC"
    ).all();
    return json({ deals: deals.results || [], count: deals.results?.length || 0 });
  } catch (err) {
    return json({ error: err.message, deals: [] });
  }
});

// ═══════════════════════════════════════════════════════════
// MODEL HEALTH
// ═══════════════════════════════════════════════════════════

router.get("/api/health/models", async ({ env }) => {
  try {
    const health = await env.DB.prepare("SELECT * FROM trinity_model_health ORDER BY checked_at DESC").all();
    const routes = await env.DB.prepare(
      "SELECT id, model, fallback_model, success_count, error_count, fallback_triggered, avg_latency_ms FROM model_routes"
    ).all();
    return json({ models: health.results || [], routes: routes.results || [] });
  } catch (e) {
    return json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════
// TRACES
// ═══════════════════════════════════════════════════════════

router.get("/api/traces", async ({ env, url }) => {
  try {
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const r = await env.DB.prepare(
      "SELECT * FROM trinity_trace_log ORDER BY created_at DESC LIMIT ?"
    ).bind(limit).all();
    return json({ traces: r.results || [], count: r.results?.length || 0 });
  } catch (e) {
    return json({ error: e.message, traces: [] });
  }
});

// ═══════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════

router.get("/api/settings", async ({ env }) => {
  try {
    const r = await env.DB.prepare("SELECT key, value, category FROM settings ORDER BY category, key").all();
    const settings = {};
    for (const s of r.results || []) settings[s.key] = s.value;
    return json(settings);
  } catch (e) {
    return json({ error: e.message });
  }
});

router.put("/api/settings/:key", async ({ request, env, params }) => {
  try {
    const body = await request.json();
    const { value, category = "general", description = null } = body;
    if (value === undefined) return json({ error: "VALUE_REQUIRED" }, 400);

    await env.DB.prepare(
      "INSERT INTO settings (key, value, category, description, updated_at) VALUES (?, ?, ?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=?, category=?, description=?, updated_at=datetime('now')"
    ).bind(params.key, String(value), category, description, String(value), category, description).run();

    return json({ ok: true, key: params.key, value });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// MAIN WORKER EXPORT
// ═══════════════════════════════════════════════════════════

export default {
  async fetch(request, env, ctx) {
    // 1. Check API routes
    const apiResponse = await router.handle(request, env, ctx);
    if (apiResponse) {
      return apiResponse;
    }

    // 2. Fallback to Cloudflare Static Assets (public/)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },

  // Cron trigger — model health check every 15 min
  async scheduled(event, env, ctx) {
    const traceId = crypto.randomUUID();
    await logTrace(env, traceId, "cron", "healthcheck.start", "info", "Scheduled health check");

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
            max_tokens: 50,
          });
        }
        const ms = Date.now() - start;

        // Update health
        try {
          await env.DB.prepare(
            "UPDATE trinity_model_health SET latency_ms=?, status=?, error_message=NULL, checked_at=datetime('now') WHERE id=?"
          ).bind(ms, ms > 5000 ? "slow" : "healthy", `health-${route.id}-primary`).run();

          await env.DB.prepare(
            "UPDATE model_routes SET success_count=success_count+1, avg_latency_ms=?, last_success_at=datetime('now') WHERE id=?"
          ).bind(ms, route.id).run();
        } catch (e) {}

        await logTrace(env, traceId, "cron", "model.healthy", "info",
          `${route.id} OK ${ms}ms`, { route: route.id, ms }, "ok", ms);
      } catch (err) {
        const ms = Date.now() - start;

        try {
          await env.DB.prepare(
            "UPDATE trinity_model_health SET status='error', error_message=?, checked_at=datetime('now') WHERE id=?"
          ).bind(err.message.slice(0, 500), `health-${route.id}-primary`).run();

          await env.DB.prepare(
            "UPDATE model_routes SET error_count=error_count+1, last_error=?, last_error_at=datetime('now'), fallback_triggered=fallback_triggered+1 WHERE id=?"
          ).bind(err.message.slice(0, 500), route.id).run();
        } catch (e) {}

        await logTrace(env, traceId, "cron", "model.error", "error",
          `${route.id} failed: ${err.message}`, { route: route.id, ms });

        // Try fallback
        try {
          if (route.id === "route-embedding") {
            await env.AI.run(route.fallback, { text: [route.test] });
          } else {
            await env.AI.run(route.fallback, {
              messages: [{ role: "user", content: route.test }],
              max_tokens: 50,
            });
          }
          await env.DB.prepare(
            "UPDATE trinity_model_health SET status='healthy', checked_at=datetime('now') WHERE id=?"
          ).bind(`health-${route.id}-fallback`).run();

          await logTrace(env, traceId, "cron", "fallback.success", "warn",
            `Fallback OK for ${route.id}`);
        } catch (fbErr) {
          await env.DB.prepare(
            "UPDATE trinity_model_health SET status='error', error_message=?, checked_at=datetime('now') WHERE id=?"
          ).bind(fbErr.message.slice(0, 500), `health-${route.id}-fallback`).run();

          await logTrace(env, traceId, "cron", "fallback.failed", "error",
            `Fallback also failed for ${route.id}: ${fbErr.message}`);
        }
      }
    }

    await logTrace(env, traceId, "cron", "healthcheck.complete", "info", "Health check done");
  },
};
