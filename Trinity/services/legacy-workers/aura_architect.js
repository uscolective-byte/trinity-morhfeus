// AURA Architect — navrhuje systémovú architektúru
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "architect.design") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Architect. Navrhni systémovú architektúru. Poskytni: komponenty, dátové toky, spojenia, potrebné tabuľky. JSON: {components:[], data_flows:[], connections:[], tables:[]}" },
          { role: "user", content: "Požiadavky: " + d.requirements }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        await env.DB.prepare("INSERT INTO graph_nodes (id, type, label, properties, content, created_at) VALUES (lower(hex(randomblob(16))), 'architecture', ?, '{}', ?, datetime('now'))").bind("Architecture: " + (d.requirements||"").slice(0,50), ai.response).run();
        return Response.json({ ok: true, result, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.graph") {
        const nodes = await env.DB.prepare("SELECT id, type, label, content FROM graph_nodes ORDER BY created_at DESC LIMIT 50").all();
        const edges = await env.DB.prepare("SELECT id, source_id, target_id, relation FROM graph_edges ORDER BY created_at DESC LIMIT 50").all();
        return Response.json({ ok: true, result: { nodes: nodes.results, edges: edges.results }, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.node.add") {
        await env.DB.prepare("INSERT INTO graph_nodes (id, type, label, properties, content, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, '{}', ?, datetime('now'))").bind(d.type||"concept", d.label, d.content||"").run();
        return Response.json({ ok: true, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.edge.add") {
        await env.DB.prepare("INSERT INTO graph_edges (id, source_id, target_id, relation, weight, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'))").bind(d.source_id, d.target_id, d.relation||"related", d.weight||1.0).run();
        return Response.json({ ok: true, traceId, from: "aura-architect" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "architect", role: "Navrhuje systémovú architektúru a komponenty", status: "active" }, traceId, from: "aura-architect" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Architect. Navrhni architektúru." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-architect" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-architect" }); }
  }
};