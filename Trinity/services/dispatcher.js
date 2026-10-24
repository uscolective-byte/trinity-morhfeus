// Trinity Dispatcher Worker (services/dispatcher.js)
const VERSION = '2.0.0';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      const missing = ['DB'].filter(name => !env[name]);
      return Response.json({
        service: 'trinity-dispatcher',
        version: VERSION,
        status: missing.length ? 'degraded' : 'serving',
        missing
      }, { status: missing.length ? 503 : 200 });
    }

    if (request.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    let call;
    try {
      call = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();

    try {
      if (call.action === "task.create" || call.action === "dispatch") {
        const id = crypto.randomUUID();
        if (env.DB) {
          await env.DB.prepare("INSERT INTO tasks (id, title, description, status, assigned_agent, project_id, priority, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, NULL, ?, datetime('now'), datetime('now'))")
            .bind(id, d.title || "Dispatched Task", d.description || "", d.assigned_agent || "auto", d.priority || "normal")
            .run()
            .catch(() => {});
        }
        return Response.json({ ok: true, result: { id, status: "pending" }, traceId, from: "dispatcher" });
      }

      if (call.action === "task.list") {
        if (!env.DB) return Response.json({ ok: true, result: [], traceId, from: "dispatcher" });
        const r = await env.DB.prepare("SELECT id, title, status, assigned_agent, priority, created_at FROM tasks ORDER BY created_at DESC LIMIT ?")
          .bind(d.limit || 50)
          .all()
          .catch(() => ({ results: [] }));
        return Response.json({ ok: true, result: r.results || [], traceId, from: "dispatcher" });
      }

      if (call.action === "job.create") {
        const id = crypto.randomUUID();
        if (env.DB) {
          await env.DB.prepare("INSERT INTO ops_jobs (id, session_id, task, team, provider, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))")
            .bind(id, d.session_id || traceId, d.task || "Dispatched Job", d.team || "[orchestrator]", d.provider || "ollama")
            .run()
            .catch(() => {});
        }
        return Response.json({ ok: true, result: { id, status: "pending" }, traceId, from: "dispatcher" });
      }

      if (call.action === "job.list") {
        if (!env.DB) return Response.json({ ok: true, result: [], traceId, from: "dispatcher" });
        const r = await env.DB.prepare("SELECT id, task, team, provider, status, created_at FROM ops_jobs ORDER BY created_at DESC LIMIT ?")
          .bind(d.limit || 50)
          .all()
          .catch(() => ({ results: [] }));
        return Response.json({ ok: true, result: r.results || [], traceId, from: "dispatcher" });
      }

      if (call.action === "route_aura") {
        if (!env.TRINITY) {
          return Response.json({ ok: false, error: "TRINITY binding not configured", traceId, from: "dispatcher" }, { status: 503 });
        }
        const resp = await env.TRINITY.fetch("https://trinity-internal/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: d.action, data: d.data, traceId })
        });
        return Response.json(await resp.json());
      }

      return Response.json({ ok: false, error: "Unknown: " + call.action, traceId, from: "dispatcher" }, { status: 400 });
    } catch (e) {
      return Response.json({ ok: false, error: e.message, traceId, from: "dispatcher" }, { status: 500 });
    }
  }
};
