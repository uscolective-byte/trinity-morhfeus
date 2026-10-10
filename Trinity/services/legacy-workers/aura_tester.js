// AURA Tester — testuje a validuje systém
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "test.generate") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Tester. Generuj test cases. Pre každý: názov, vstup, očakávaný výstup, typ. JSON: {tests:[{name, input, expected, type}]}" },
          { role: "user", content: "Cieľ: " + d.target + "\nKód: " + (d.code||"") }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        return Response.json({ ok: true, result, traceId, from: "aura-tester" });
      }
      if (call.action === "test.validate") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Tester. Validuj tento kód. Skontroluj: syntax, logiku, bezpečnosť, výkonnosť. JSON: {valid: boolean, issues:[{severity, description, fix}], score: 0-100}" },
          { role: "user", content: d.code || d.target || "" }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        await env.DB.prepare("INSERT INTO audit_log (id, module, action, details, severity, created_at) VALUES (lower(hex(randomblob(16))), 'tester', 'validate', ?, ?, datetime('now'))").bind(JSON.stringify(result), result.valid ? "info" : "warning").run();
        return Response.json({ ok: true, result, traceId, from: "aura-tester" });
      }
      if (call.action === "test.endpoint") {
        try {
          const r = await fetch(d.url, { method: d.method||"GET", headers: d.headers||{}, body: d.body ? JSON.stringify(d.body) : undefined });
          const body = await r.text();
          return Response.json({ ok: true, result: { status: r.status, ok: r.ok, body: body.substring(0, 2000) }, traceId, from: "aura-tester" });
        } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-tester" }); }
      }
      if (call.action === "test.system") {
        const tables = await env.DB.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'").first();
        const agents = await env.DB.prepare("SELECT COUNT(*) as c FROM agents WHERE status='active'").first();
        const brain = await env.DB.prepare("SELECT component, state FROM trinity_brain_state ORDER BY updated_at DESC LIMIT 5").all();
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Tester. Testuj systém a nahlás stav. JSON: {all_pass: boolean, results:[{test, passed, details}]}" },
          { role: "user", content: "Tables: " + (tables?.c||0) + "\nAgents: " + (agents?.c||0) + "\nBrain: " + JSON.stringify(brain.results) }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        return Response.json({ ok: true, result, traceId, from: "aura-tester" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "tester", role: "Testuje, validuje a zabezpečuje kvalitu", status: "active" }, traceId, from: "aura-tester" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Tester." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-tester" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-tester" }); }
  }
};