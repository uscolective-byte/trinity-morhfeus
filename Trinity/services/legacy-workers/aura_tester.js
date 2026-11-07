// AURA Tester — testuje, validuje a zabezpečuje kvalitu systému (Trinity 10.2)
import {runAuraAi, parseAuraJson, safeDbRun} from './aura_helpers.js';

export default {
  async fetch(request, env) {
    if (request.method === "GET" && new URL(request.url).pathname === "/health") {
      return Response.json({ ok: true, service: "aura_tester", version: "10.3.0", status: "serving", bindings: { AI: !!env.AI, DB: !!env.DB } });
    }

    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "test.generate") {
        const text = await runAuraAi(env,
          "Si AURA Tester. Generuj dôkladné testovacie scenáre (unit, edge case, failure). Odpovedz VÝHRADNE ako validný JSON: {\"tests\":[{\"name\":\"...\", \"input\":{}, \"expected\":{}, \"type\":\"unit|integration|edge\"}]}",
          "Cieľ: " + (d.target || "") + "\nKód: " + (d.code || "")
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-tester" });
      }
      if (call.action === "test.validate") {
        const text = await runAuraAi(env,
          "Si AURA Tester. Validuj predložený kód. Skontroluj: syntax, edge-cases, logiku, bezpečnosť, výkonnosť. Odpovedz VÝHRADNE ako validný JSON: {\"valid\": boolean, \"issues\":[{\"severity\":\"critical|warning|info\", \"description\":\"...\", \"fix\":\"...\"}], \"score\": 0-100}",
          d.code || d.target || ""
        );
        const result = parseAuraJson(text);
        await safeDbRun(env.DB.prepare("INSERT INTO audit_log (id, module, action, details, severity, created_at) VALUES (lower(hex(randomblob(16))), 'tester', 'validate', ?, ?, datetime('now'))").bind(JSON.stringify(result), result.valid ? "info" : "warning").run());
        return Response.json({ ok: true, result, traceId, from: "aura-tester" });
      }
      if (call.action === "test.endpoint") {
        try {
          const r = await fetch(d.url, { method: d.method || "GET", headers: d.headers || {}, body: d.body ? JSON.stringify(d.body) : undefined });
          const body = await r.text();
          return Response.json({ ok: true, result: { status: r.status, ok: r.ok, body: body.substring(0, 2000) }, traceId, from: "aura-tester" });
        } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-tester" }); }
      }
      if (call.action === "test.system") {
        const tables = await safeDbRun(env.DB.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'").first());
        const agents = await safeDbRun(env.DB.prepare("SELECT COUNT(*) as c FROM agents WHERE status='active'").first());
        const brain = await safeDbRun(env.DB.prepare("SELECT component, state FROM trinity_brain_state ORDER BY updated_at DESC LIMIT 5").all()) || { results: [] };
        const text = await runAuraAi(env,
          "Si AURA Tester. Vyhodnoť stav a integritu systému Trinity. Odpovedz VÝHRADNE ako validný JSON: {\"all_pass\": boolean, \"results\":[{\"test\":\"...\", \"passed\": boolean, \"details\":\"...\"}]}",
          "Tables: " + (tables?.c || 0) + "\nAgents: " + (agents?.c || 0) + "\nBrain: " + JSON.stringify(brain.results)
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-tester" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "tester", role: "Testuje, validuje kód a zabezpečuje kvalitu systému", status: "active", version: "10.3.0" }, traceId, from: "aura-tester" });
      }
      const text = await runAuraAi(env, "Si AURA Tester. Spusti testy a validáciu.", d.prompt || call.action);
      return Response.json({ ok: true, result: { response: text }, traceId, from: "aura-tester" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-tester" }); }
  }
};