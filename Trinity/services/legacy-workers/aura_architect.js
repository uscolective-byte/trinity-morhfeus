// AURA Architect — navrhuje architektúru systémov a komponentov (Trinity 10.2)
import {runAuraAi, parseAuraJson, safeDbRun, safeDbWrite, AURA_SERVICE_VERSION} from './aura_helpers.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "architect.design") {
        const text = await runAuraAi(env,
          "Si AURA Architect. Navrhni modernú, škálovateľnú systémovú architektúru pre Cloudflare a edge systémy. Odpovedz VÝHRADNE ako validný JSON: {\"components\":[{\"name\":\"\",\"responsibility\":\"\",\"technology\":\"\",\"connections\":[]}],\"data_flow\":\"\",\"scalability_notes\":\"\",\"security_notes\":\"\"}",
          "Požiadavky: " + (d.requirements || "") + "\nŠkála: " + (d.scale || "medium") + "\nObmedzenia: " + (d.constraints || "")
        );
        const result = parseAuraJson(text);
        await safeDbWrite(env.DB.prepare("INSERT INTO thoughts (id, thought_type, content, trigger_message, resulting_action, created_at) VALUES (?, 'architecture', ?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), JSON.stringify(result), d.requirements||"", "architect.design").run());
        return Response.json({ ok: true, result, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.review") {
        const text = await runAuraAi(env,
          "Si AURA Architect. Zhodnoť architektúru, jej slabiny, odolnosť a súlad s best-practices. Odpovedz VÝHRADNE ako validný JSON: {\"score\":0-100,\"strengths\":[],\"weaknesses\":[],\"recommendations\":[],\"risk_level\":\"low|medium|high\"}",
          "Architektúra na review:\n" + (d.architecture || d.description || "")
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.evaluate") {
        const text = await runAuraAi(env,
          "Si AURA Architect. Vyhodnoť technologické možnosti a odporuč najvhodnejší stack. Odpovedz VÝHRADNE ako validný JSON: {\"recommendation\":\"\",\"alternatives\":[{\"name\":\"\",\"pros\":[],\"cons\":[],\"fit_score\":0-100}],\"reasoning\":\"\"}",
          "Problém: " + (d.problem || "") + "\nMožnosti: " + JSON.stringify(d.options || [])
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.diagram") {
        const text = await runAuraAi(env,
          "Si AURA Architect. Generuj prehľadný Mermaid diagram architektúry systému. Odpovedz VÝHRADNE ako validný JSON: {\"mermaid\":\"graph TD; ...\",\"description\":\"\",\"legend\":[]}",
          "Systém: " + (d.system || "") + "\nKomponenty: " + (d.components || "")
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.graph") {
        const nodes = await safeDbRun(env.DB.prepare("SELECT id, type, label, content FROM graph_nodes ORDER BY created_at DESC LIMIT 50").all()) || { results: [] };
        const edges = await safeDbRun(env.DB.prepare("SELECT id, source_id, target_id, relation FROM graph_edges ORDER BY created_at DESC LIMIT 50").all()) || { results: [] };
        return Response.json({ ok: true, result: { nodes: nodes.results, edges: edges.results }, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.node.add") {
        await safeDbWrite(env.DB.prepare("INSERT INTO graph_nodes (id, type, label, properties, content, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, '{}', ?, datetime('now'))").bind(d.type||"concept", d.label, d.content||"").run());
        return Response.json({ ok: true, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.edge.add") {
        await safeDbWrite(env.DB.prepare("INSERT INTO graph_edges (id, source_id, target_id, relation, weight, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'))").bind(d.source_id, d.target_id, d.relation||"related", d.weight||1.0).run());
        return Response.json({ ok: true, traceId, from: "aura-architect" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "architect", role: "Navrhuje systémovú architektúru, diagramy a grafové závislosti", status: "active", version: AURA_SERVICE_VERSION }, traceId, from: "aura-architect" });
      }
      return Response.json({ ok: false, error: "Unknown action: " + call.action, traceId, from: "aura-architect" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-architect" }); }
  }
};
