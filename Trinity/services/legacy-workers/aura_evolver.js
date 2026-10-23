// AURA Evolver — navrhuje a testuje vylepšenia systému (Trinity 10.2)
import {runAuraAi, parseAuraJson, safeDbRun, safeDbWrite} from './aura_helpers.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "evolve.propose") {
        const text = await runAuraAi(env,
          "Si AURA Evolver. Navrhni 3 konkrétne, vysoko hodnotné vylepšenia systému Trinity. Pre každé uveď popis, očakávaný dopad a úroveň rizika. Odpovedz VÝHRADNE ako validný JSON: {\"proposals\":[{\"title\":\"...\",\"description\":\"...\",\"impact\":\"high|medium|low\",\"risk\":\"low|medium|high\",\"area\":\"...\"}]}",
          "Oblasť: " + (d.area || "system") + " Súčasný stav: " + (d.current_state || "v10.2.0")
        );
        const proposals = parseAuraJson(text);
        const id = crypto.randomUUID();
        await safeDbWrite(env.DB.prepare("INSERT INTO evolution_proposals (id, type, description, proposed_code, status, approval_status, created_at) VALUES (?, ?, ?, ?, 'proposed', 'pending', datetime('now'))").bind(id, d.area || "system", text, text).run());
        await safeDbWrite(env.DB.prepare("INSERT INTO timeline (id, event, category, details, created_at) VALUES (lower(hex(randomblob(16))), 'EVOLUTION_PROPOSED', 'evolution', ?, datetime('now'))").bind("Area: " + (d.area || "system")).run());
        return Response.json({ ok: true, result: { proposalId: id, proposals }, traceId, from: "aura-evolver" });
      }
      if (call.action === "evolve.history") {
        const r = await safeDbRun(env.DB.prepare("SELECT id, type, description, status, approval_status, created_at, deployed_at FROM evolution_proposals ORDER BY created_at DESC LIMIT 50").all()) || { results: [] };
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-evolver" });
      }
      if (call.action === "evolve.reflections") {
        const r = await safeDbRun(env.DB.prepare("SELECT reflection, insight, mood, created_at FROM reflections ORDER BY created_at DESC LIMIT 20").all()) || { results: [] };
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-evolver" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "evolver", role: "Navrhuje a testuje evolučné vylepšenia systému Trinity", status: "active", version: "10.2.0" }, traceId, from: "aura-evolver" });
      }
      const text = await runAuraAi(env, "Si AURA Evolver. Navrhni evolučné vylepšenia a sebareflexiu.", d.prompt || call.action);
      return Response.json({ ok: true, result: { response: text }, traceId, from: "aura-evolver" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-evolver" }); }
  }
};