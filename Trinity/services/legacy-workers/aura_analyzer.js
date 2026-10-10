// AURA Analyzer — analyzuje kód, dáta, systémové správanie
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "analyze.code") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Analyzer. Analyzuj kód a nájdi: bugy, bezpečnostné problémy, výkonnostné problémy, návrhy na zlepšenie. JSON: {bugs:[], security:[], performance:[], improvements:[]}" },
          { role: "user", content: "Analyzuj tento kód:\n" + d.code }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        await env.DB.prepare("INSERT INTO code_snippets (id, title, language, code, tags, created_at) VALUES (lower(hex(randomblob(16))), 'Analysis', 'analysis', ?, 'analysis', datetime('now'))").bind(ai.response).run();
        return Response.json({ ok: true, result, traceId, from: "aura-analyzer" });
      }
      if (call.action === "analyze.system") {
        const health = await env.DB.prepare("SELECT component, status, message FROM system_health ORDER BY checked_at DESC LIMIT 20").all();
        const errors = await env.DB.prepare("SELECT module, action, details, severity FROM audit_log WHERE severity = 'critical' AND created_at > datetime('now','-1 day') ORDER BY created_at DESC LIMIT 20").all();
        const tokens = await env.DB.prepare("SELECT model, SUM(tokens_in+tokens_out) as total FROM token_usage WHERE created_at > datetime('now','-1 day') GROUP BY model").all();
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Analyzer. Analyzuj stav systému a nájdi anomálie. JSON: {anomalies:[], recommendations:[], risk_level:'low|medium|high'}" },
          { role: "user", content: "Health: " + JSON.stringify(health.results) + "\nErrors: " + JSON.stringify(errors.results) + "\nTokens: " + JSON.stringify(tokens.results) }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        return Response.json({ ok: true, result, traceId, from: "aura-analyzer" });
      }
      if (call.action === "analyze.data") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Analyzer. Analyzuj dáta a nájdi patterny, trendy, a anomálie. JSON: {patterns:[], trends:[], anomalies:[]}" },
          { role: "user", content: d.data || d.prompt || "" }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        return Response.json({ ok: true, result, traceId, from: "aura-analyzer" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "analyzer", role: "Analyzuje kód, dáta, systémové správanie", status: "active" }, traceId, from: "aura-analyzer" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Analyzer. Analyzuj a poskytní presné výsledky." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-analyzer" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-analyzer" }); }
  }
};