// AURA Sentinel — monitoruje a detekuje anomálie
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "sentinel.scan") {
        const events = await env.DB.prepare("SELECT event_type, severity, source, COUNT(*) as count FROM security_events WHERE created_at > datetime('now','-1 hour') GROUP BY event_type ORDER BY count DESC LIMIT 20").all();
        const critical = await env.DB.prepare("SELECT COUNT(*) as c FROM security_events WHERE severity = 'critical' AND created_at > datetime('now','-1 hour')").first();
        const errors = await env.DB.prepare("SELECT COUNT(*) as c FROM audit_log WHERE severity = 'critical' AND created_at > datetime('now','-1 hour')").first();
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Sentinel. Analyzuj bezpečnostné udalosti a nájdi anomálie. JSON: {anomalies:[], risk_level:'low|medium|high', recommendations:[]}" },
          { role: "user", content: "Events: " + JSON.stringify(events.results) + "\nCritical: " + (critical?.c||0) + "\nErrors: " + (errors?.c||0) }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        await env.DB.prepare("INSERT INTO timeline (id, event, category, details, created_at) VALUES (lower(hex(randomblob(16))), 'SENTINEL_SCAN', 'security', ?, datetime('now'))").bind("Risk: " + (result.risk_level||"unknown")).run();
        return Response.json({ ok: true, result, traceId, from: "aura-sentinel" });
      }
      if (call.action === "sentinel.monitor") {
        const health = await env.DB.prepare("SELECT component, status, message, checked_at FROM system_health ORDER BY checked_at DESC LIMIT 20").all();
        const agents = await env.DB.prepare("SELECT name, status FROM agents ORDER BY name").all();
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Sentinel. Monitoruj systém a nahlás stav. JSON: {overall_status, issues:[], healthy_components:[]}" },
          { role: "user", content: "Health: " + JSON.stringify(health.results) + "\nAgents: " + JSON.stringify(agents.results) }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        return Response.json({ ok: true, result, traceId, from: "aura-sentinel" });
      }
      if (call.action === "sentinel.alert") {
        await env.DB.prepare("INSERT INTO security_events (event_type, severity, source, details, created_at) VALUES (?, ?, 'aura-sentinel', ?, datetime('now'))").bind(d.event_type||"alert", d.severity||"warning", d.details||"").run();
        return Response.json({ ok: true, traceId, from: "aura-sentinel" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "sentinel", role: "Monitoruje a detekuje anomálie, bezpečnosť", status: "active" }, traceId, from: "aura-sentinel" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Sentinel." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-sentinel" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-sentinel" }); }
  }
};