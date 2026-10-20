--09565435c88aa47f42359e3e8ff399ead3de7125a706127ede1106ef0fa6
Content-Disposition: form-data; name="worker.js"

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "monitor.health") {
        const r = await env.DB.prepare("SELECT component, status, message, checked_at FROM system_health ORDER BY checked_at DESC LIMIT 50").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "sentinel" });
      }
      if (call.action === "monitor.scan") {
        const health = await env.DB.prepare("SELECT component, status, message FROM system_health ORDER BY checked_at DESC LIMIT 20").all();
        const pending = await env.DB.prepare("SELECT COUNT(*) as c FROM autonomous_tasks WHERE status = 'pending'").first();
        const errors = await env.DB.prepare("SELECT COUNT(*) as c FROM audit_log WHERE severity = 'critical' AND created_at > datetime('now','-1 hour')").first();
        const tokens = await env.DB.prepare("SELECT SUM(tokens_in + tokens_out) as t FROM token_usage WHERE created_at > datetime('now','-1 hour')").first();
        return Response.json({ ok: true, result: { health: health.results, pendingTasks: pending?.c||0, criticalErrors: errors?.c||0, tokensLastHour: tokens?.t||0, status: (errors?.c||0) > 5 ? "degraded" : "healthy" }, traceId, from: "sentinel" });
      }
      if (call.action === "monitor.tokens") {
        const r = await env.DB.prepare("SELECT model, module, agent, SUM(tokens_in) as tin, SUM(tokens_out) as tout, SUM(cost) as cost FROM token_usage GROUP BY model, module, agent ORDER BY cost DESC LIMIT ?").bind(d.limit||50).all();
        return Response.json({ ok: true, result: r.results, traceId, from: "sentinel" });
      }
      if (call.action === "monitor.events") {
        const r = await env.DB.prepare("SELECT id, event_type, source, message, created_at FROM ops_events ORDER BY created_at DESC LIMIT ?").bind(d.limit||50).all();
        return Response.json({ ok: true, result: r.results, traceId, from: "sentinel" });
      }
      if (call.action === "monitor.autonomous.list") {
        const r = await env.DB.prepare("SELECT id, task_type, description, status, priority FROM autonomous_tasks ORDER BY priority DESC LIMIT 50").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "sentinel" });
      }
      return Response.json({ ok: false, error: "Unknown: " + call.action, traceId, from: "sentinel" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "sentinel" }); }
  }
};
--09565435c88aa47f42359e3e8ff399ead3de7125a706127ede1106ef0fa6--
