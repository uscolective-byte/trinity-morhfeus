// AURA Memory — konsoliduje pamäť a syntetizuje znalosti (Trinity 10.2)
import {runAuraAi, parseAuraJson, safeDbRun, safeDbWrite, AURA_SERVICE_VERSION} from './aura_helpers.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "memory.synthesize") {
        const memories = await safeDbRun(env.DB.prepare("SELECT content, category, importance FROM memories ORDER BY importance DESC, created_at DESC LIMIT 50").all()) || { results: [] };
        const text = await runAuraAi(env,
          "Si AURA Memory. Syntetizuj pamäťové záznamy do súvislého, prehľadného znalostného súhrnu. Identifikuj kľúčové preferencie používateľa, fakty a trvalé vzorce.",
          JSON.stringify(memories.results)
        );
        const synthesis = text || "";
        const id = crypto.randomUUID();
        await safeDbWrite(env.DB.prepare("INSERT INTO memory_semantic (id, title, content, source, created_at) VALUES (?, 'Memory Synthesis', ?, 'aura-memory', datetime('now'))").bind(id, synthesis).run());
        return Response.json({ ok: true, result: { synthesis, id }, traceId, from: "aura-memory" });
      }
      if (call.action === "memory.consolidate") {
        const recent = await safeDbRun(env.DB.prepare("SELECT id, content, category FROM memories WHERE created_at > datetime('now','-1 day') ORDER BY importance DESC LIMIT 20").all()) || { results: [] };
        const text = await runAuraAi(env,
          "Si AURA Memory. Konsoliduj krátkodobé pamäte a rozhovory do trvalých znalostí. Odpovedz VÝHRADNE ako validný JSON: {\"consolidated\":[{\"title\":\"...\",\"content\":\"...\",\"importance\":1-10}]}",
          JSON.stringify(recent.results)
        );
        const result = parseAuraJson(text);
        if (result.consolidated && Array.isArray(result.consolidated)) {
          for (const c of result.consolidated) {
            await safeDbWrite(env.DB.prepare("INSERT INTO memory_long (id, title, content, importance, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, datetime('now'))").bind(c.title, c.content, c.importance || 5).run());
          }
        }
        return Response.json({ ok: true, result, traceId, from: "aura-memory" });
      }
      if (call.action === "memory.semantic.search") {
        const q = d.query || "";
        const r = await safeDbRun(env.DB.prepare("SELECT id, title, content, source, created_at FROM memory_semantic WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC LIMIT 50").bind("%" + q + "%", "%" + q + "%").all()) || { results: [] };
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-memory" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "memory", role: "Konsoliduje pamäť, prepája D1 kontext a syntetizuje znalosti", status: "active", version: AURA_SERVICE_VERSION }, traceId, from: "aura-memory" });
      }
      const text = await runAuraAi(env, "Si AURA Memory. Asistuj pri organizácii pamäte.", d.prompt || call.action);
      return Response.json({ ok: true, result: { response: text }, traceId, from: "aura-memory" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-memory" }); }
  }
};