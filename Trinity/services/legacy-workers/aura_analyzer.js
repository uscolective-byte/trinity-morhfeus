// AURA Analyzer — analyzuje kód, dáta, systémové správanie (Trinity 10.2)
import {runAuraAi, parseAuraJson, safeDbRun, safeDbWrite, AURA_SERVICE_VERSION} from './aura_helpers.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "analyze.code") {
        const text = await runAuraAi(env,
          "Si AURA Analyzer. Dôkladne analyzuj kód a nájdi: bugy, bezpečnostné slabiny, výkonnostné problémy a konkrétne návrhy na zlepšenie. Odpovedz VÝHRADNE ako validný JSON: {\"bugs\":[], \"security\":[], \"performance\":[], \"improvements\":[], \"score\": 0-100}",
          "Analyzuj tento kód:\n" + (d.code || "")
        );
        const result = parseAuraJson(text);
        await safeDbWrite(env.DB.prepare("INSERT INTO code_snippets (id, title, language, code, tags, created_at) VALUES (lower(hex(randomblob(16))), 'Analysis', 'analysis', ?, 'analysis', datetime('now'))").bind(text).run());
        return Response.json({ ok: true, result, traceId, from: "aura-analyzer" });
      }
      if (call.action === "analyze.system") {
        const health = await safeDbRun(env.DB.prepare("SELECT component, status, message FROM system_health ORDER BY checked_at DESC LIMIT 20").all()) || { results: [] };
        const errors = await safeDbRun(env.DB.prepare("SELECT module, action, details, severity FROM audit_log WHERE severity = 'critical' AND created_at > datetime('now','-1 day') ORDER BY created_at DESC LIMIT 20").all()) || { results: [] };
        const tokens = await safeDbRun(env.DB.prepare("SELECT model, SUM(tokens_in+tokens_out) as total FROM token_usage WHERE created_at > datetime('now','-1 day') GROUP BY model").all()) || { results: [] };
        const text = await runAuraAi(env,
          "Si AURA Analyzer. Analyzuj stav systému Trinity a identifikuj anomálie a odporúčania. Odpovedz VÝHRADNE ako validný JSON: {\"anomalies\":[], \"recommendations\":[], \"risk_level\":\"low|medium|high\"}",
          "Health: " + JSON.stringify(health.results) + "\nErrors: " + JSON.stringify(errors.results) + "\nTokens: " + JSON.stringify(tokens.results)
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-analyzer" });
      }
      if (call.action === "analyze.data") {
        const text = await runAuraAi(env,
          "Si AURA Analyzer. Analyzuj dáta a nájdi dôležité patterny, trendy, a anomálie. Odpovedz VÝHRADNE ako validný JSON: {\"patterns\":[], \"trends\":[], \"anomalies\":[], \"summary\":\"\"}",
          d.data || d.prompt || ""
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-analyzer" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "analyzer", role: "Analyzuje kód, dáta, systémové správanie a bezpečnosť", status: "active", version: AURA_SERVICE_VERSION }, traceId, from: "aura-analyzer" });
      }
      const text = await runAuraAi(env, "Si AURA Analyzer. Analyzuj a poskytni presné, štruktúrované výsledky.", d.prompt || call.action);
      return Response.json({ ok: true, result: { response: text }, traceId, from: "aura-analyzer" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-analyzer" }); }
  }
};