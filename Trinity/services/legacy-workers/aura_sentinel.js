// AURA Sentinel — monitoruje bezpečnosť a detekuje anomálie (Trinity 10.2)
import {runAuraAi, parseAuraJson, safeDbRun, safeDbWrite, AURA_SERVICE_VERSION} from './aura_helpers.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "sentinel.scan") {
        const events = await safeDbRun(env.DB.prepare("SELECT event_type, severity, source, COUNT(*) as count FROM security_events WHERE created_at > datetime('now','-1 hour') GROUP BY event_type ORDER BY count DESC LIMIT 20").all()) || { results: [] };
        const critical = await safeDbRun(env.DB.prepare("SELECT COUNT(*) as c FROM security_events WHERE severity = 'critical' AND created_at > datetime('now','-1 hour')").first());
        const errors = await safeDbRun(env.DB.prepare("SELECT COUNT(*) as c FROM audit_log WHERE severity = 'critical' AND created_at > datetime('now','-1 hour')").first());
        const text = await runAuraAi(env,
          "Si AURA Sentinel. Analyzuj bezpečnostné udalosti a incidenty, deteguj anomálie a urči celkový rizikový profil. Odpovedz VÝHRADNE ako validný JSON: {\"anomalies\":[], \"risk_level\":\"low|medium|high\", \"recommendations\":[]}",
          "Events: " + JSON.stringify(events.results) + "\nCritical: " + (critical?.c || 0) + "\nErrors: " + (errors?.c || 0)
        );
        const result = parseAuraJson(text);
        await safeDbWrite(env.DB.prepare("INSERT INTO timeline (id, event, category, details, created_at) VALUES (lower(hex(randomblob(16))), 'SENTINEL_SCAN', 'security', ?, datetime('now'))").bind("Risk: " + (result.risk_level || "unknown")).run());
        return Response.json({ ok: true, result, traceId, from: "aura-sentinel" });
      }
      if (call.action === "sentinel.monitor") {
        const health = await safeDbRun(env.DB.prepare("SELECT component, status, message, checked_at FROM system_health ORDER BY checked_at DESC LIMIT 20").all()) || { results: [] };
        const agents = await safeDbRun(env.DB.prepare("SELECT name, status FROM agents ORDER BY name").all()) || { results: [] };
        const text = await runAuraAi(env,
          "Si AURA Sentinel. Monitoruj integritu a stav systému a poskytni prehľadný report. Odpovedz VÝHRADNE ako validný JSON: {\"overall_status\":\"healthy|degraded|critical\", \"issues\":[], \"healthy_components\":[]}",
          "Health: " + JSON.stringify(health.results) + "\nAgents: " + JSON.stringify(agents.results)
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-sentinel" });
      }
      if (call.action === "sentinel.alert") {
        await safeDbWrite(env.DB.prepare("INSERT INTO security_events (event_type, severity, source, details, created_at) VALUES (?, ?, 'aura-sentinel', ?, datetime('now'))").bind(d.event_type || "alert", d.severity || "warning", d.details || "").run());
        return Response.json({ ok: true, traceId, from: "aura-sentinel" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "sentinel", role: "Monitoruje bezpečnosť, deteguje anomálie a riadi alerty", status: "active", version: AURA_SERVICE_VERSION }, traceId, from: "aura-sentinel" });
      }
      const text = await runAuraAi(env, "Si AURA Sentinel. Vykonaj bezpečnostné monitorovanie.", d.prompt || call.action);
      return Response.json({ ok: true, result: { response: text }, traceId, from: "aura-sentinel" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-sentinel" }); }
  }
};