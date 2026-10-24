// Trinity Sentinel Worker (services/sentinel.js)
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
        service: 'trinity-sentinel',
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
      if (call.action === "monitor.health") {
        if (!env.DB) return Response.json({ ok: true, result: [], traceId, from: "sentinel" });
        const r = await env.DB.prepare("SELECT component, status, message, checked_at FROM system_health ORDER BY checked_at DESC LIMIT 50").all().catch(() => ({ results: [] }));
        return Response.json({ ok: true, result: r.results || [], traceId, from: "sentinel" });
      }

      if (call.action === "monitor.scan") {
        if (!env.DB) return Response.json({ ok: true, result: { health: [], pendingTasks: 0, criticalErrors: 0, tokensLastHour: 0, status: "healthy" }, traceId, from: "sentinel" });
        const health = await env.DB.prepare("SELECT component, status, message FROM system_health ORDER BY checked_at DESC LIMIT 20").all().catch(() => ({ results: [] }));
        const pending = await env.DB.prepare("SELECT COUNT(*) as c FROM tasks WHERE status = 'pending'").first().catch(() => ({ c: 0 }));
        const errors = await env.DB.prepare("SELECT COUNT(*) as c FROM ops_events WHERE action LIKE '%error%' OR action LIKE '%fail%'").first().catch(() => ({ c: 0 }));
        const tokens = await env.DB.prepare("SELECT SUM(tokens_in + tokens_out) as t FROM token_usage WHERE created_at > datetime('now','-1 hour')").first().catch(() => ({ t: 0 }));
        return Response.json({
          ok: true,
          result: {
            health: health.results || [],
            pendingTasks: pending?.c || 0,
            criticalErrors: errors?.c || 0,
            tokensLastHour: tokens?.t || 0,
            status: (errors?.c || 0) > 5 ? "degraded" : "healthy"
          },
          traceId,
          from: "sentinel"
        });
      }

      if (call.action === "monitor.tokens") {
        if (!env.DB) return Response.json({ ok: true, result: [], traceId, from: "sentinel" });
        const r = await env.DB.prepare("SELECT model, module, agent, SUM(tokens_in) as tin, SUM(tokens_out) as tout, SUM(cost) as cost FROM token_usage GROUP BY model, module, agent ORDER BY cost DESC LIMIT ?")
          .bind(d.limit || 50)
          .all()
          .catch(() => ({ results: [] }));
        return Response.json({ ok: true, result: r.results || [], traceId, from: "sentinel" });
      }

      if (call.action === "monitor.events") {
        if (!env.DB) return Response.json({ ok: true, result: [], traceId, from: "sentinel" });
        const r = await env.DB.prepare("SELECT id, action, details, created_at FROM ops_events ORDER BY id DESC LIMIT ?")
          .bind(d.limit || 50)
          .all()
          .catch(() => ({ results: [] }));
        return Response.json({ ok: true, result: r.results || [], traceId, from: "sentinel" });
      }

      if (call.action === "monitor.autonomous.list") {
        if (!env.DB) return Response.json({ ok: true, result: [], traceId, from: "sentinel" });
        const r = await env.DB.prepare("SELECT id, title, status, priority, assigned_agent FROM tasks ORDER BY created_at DESC LIMIT 50").all().catch(() => ({ results: [] }));
        return Response.json({ ok: true, result: r.results || [], traceId, from: "sentinel" });
      }

      return Response.json({ ok: false, error: "Unknown: " + call.action, traceId, from: "sentinel" }, { status: 400 });
    } catch (e) {
      return Response.json({ ok: false, error: e.message, traceId, from: "sentinel" }, { status: 500 });
    }
  }
};
