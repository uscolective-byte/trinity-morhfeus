// AURA Optimizer — optimalizuje výkon, náklady, zdroje
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "optimize.system") {
        const tokens = await env.DB.prepare("SELECT model, module, SUM(tokens_in) as tin, SUM(tokens_out) as tout, SUM(cost) as cost FROM token_usage GROUP BY model, module ORDER BY cost DESC").all();
        const jobs = await env.DB.prepare("SELECT status, COUNT(*) as c FROM ops_jobs GROUP BY status").all();
        const health = await env.DB.prepare("SELECT component, status FROM system_health ORDER BY checked_at DESC LIMIT 10").all();
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Optimizer. Analyzuj metriky a navrhni optimalizácie. JSON: {optimizations:[{area, action, expected_gain, priority}], cost_savings: number}" },
          { role: "user", content: "Tokens: " + JSON.stringify(tokens.results) + "\nJobs: " + JSON.stringify(jobs.results) + "\nHealth: " + JSON.stringify(health.results) }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        return Response.json({ ok: true, result, traceId, from: "aura-optimizer" });
      }
      if (call.action === "optimize.tokens") {
        const r = await env.DB.prepare("SELECT model, SUM(tokens_in+tokens_out) as total, SUM(cost) as cost FROM token_usage WHERE created_at > datetime('now','-1 day') GROUP BY model ORDER BY cost DESC").all();
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Optimizer. Navrhni ako znížiť token usage a náklady. JSON: {recommendations:[], potential_savings: number}" },
          { role: "user", content: JSON.stringify(r.results) }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        return Response.json({ ok: true, result, traceId, from: "aura-optimizer" });
      }
      if (call.action === "optimize.query") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Optimizer. Optimalizuj tento SQL dotaz pre D1/SQLite. Iba optimalizovaný SQL." },
          { role: "user", content: d.sql }
        ]});
        return Response.json({ ok: true, result: { optimized: ai.response }, traceId, from: "aura-optimizer" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "optimizer", role: "Optimalizuje výkon, náklady, token usage", status: "active" }, traceId, from: "aura-optimizer" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Optimizer." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-optimizer" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-optimizer" }); }
  }
};