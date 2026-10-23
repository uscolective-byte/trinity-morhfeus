// AURA Optimizer — optimalizuje výkon, náklady a zdroje (Trinity 10.2)
import {runAuraAi, parseAuraJson, safeDbRun, AURA_SERVICE_VERSION} from './aura_helpers.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "optimize.system") {
        const tokens = await safeDbRun(env.DB.prepare("SELECT model, module, SUM(tokens_in) as tin, SUM(tokens_out) as tout, SUM(cost) as cost FROM token_usage GROUP BY model, module ORDER BY cost DESC").all()) || { results: [] };
        const jobs = await safeDbRun(env.DB.prepare("SELECT status, COUNT(*) as c FROM ops_jobs GROUP BY status").all()) || { results: [] };
        const health = await safeDbRun(env.DB.prepare("SELECT component, status FROM system_health ORDER BY checked_at DESC LIMIT 10").all()) || { results: [] };
        const text = await runAuraAi(env,
          "Si AURA Optimizer. Analyzuj systémové metriky Trinity a navrhni konkrétne optimalizácie. Odpovedz VÝHRADNE ako validný JSON: {\"optimizations\":[{\"area\":\"...\", \"action\":\"...\", \"expected_gain\":\"...\", \"priority\":\"high|medium|low\"}], \"cost_savings\": 0}",
          "Tokens: " + JSON.stringify(tokens.results) + "\nJobs: " + JSON.stringify(jobs.results) + "\nHealth: " + JSON.stringify(health.results)
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-optimizer" });
      }
      if (call.action === "optimize.tokens") {
        const r = await safeDbRun(env.DB.prepare("SELECT model, SUM(tokens_in+tokens_out) as total, SUM(cost) as cost FROM token_usage WHERE created_at > datetime('now','-1 day') GROUP BY model ORDER BY cost DESC").all()) || { results: [] };
        const text = await runAuraAi(env,
          "Si AURA Optimizer. Navrhni ako znížiť token usage, optimalizovať kontextové okná a znížiť náklady. Odpovedz VÝHRADNE ako validný JSON: {\"recommendations\":[], \"potential_savings\": 0}",
          JSON.stringify(r.results)
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-optimizer" });
      }
      if (call.action === "optimize.query") {
        const text = await runAuraAi(env,
          "Si AURA Optimizer. Optimalizuj tento SQL dotaz pre Cloudflare D1 / SQLite (indexy, EXPLAIN QUERY PLAN, redukcia skenov). Vráť iba optimalizovaný SQL dotaz.",
          d.sql || ""
        );
        const cleaned = text.replace(/^```(?:sql)?\s*/i, '').replace(/\s*```$/i, '').trim();
        return Response.json({ ok: true, result: { optimized: cleaned }, traceId, from: "aura-optimizer" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "optimizer", role: "Optimalizuje výkon, náklady, token usage a D1 dotazy", status: "active", version: AURA_SERVICE_VERSION }, traceId, from: "aura-optimizer" });
      }
      const text = await runAuraAi(env, "Si AURA Optimizer. Navrhni optimalizácie.", d.prompt || call.action);
      return Response.json({ ok: true, result: { response: text }, traceId, from: "aura-optimizer" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-optimizer" }); }
  }
};