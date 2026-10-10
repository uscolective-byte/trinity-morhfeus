// AURA Memory — konsoliduje pamäť a syntetizuje znalosti
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "memory.synthesize") {
        const memories = await env.DB.prepare("SELECT content, category, importance FROM memories ORDER BY importance DESC, created_at DESC LIMIT 50").all();
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Memory. Syntetizuj pamäte do súvislého znalostného súhrnu. Nájdi kľúčové patterny a insights." },
          { role: "user", content: JSON.stringify(memories.results) }
        ]});
        const synthesis = ai.response || "";
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO memory_semantic (id, title, content, source, created_at) VALUES (?, 'Memory Synthesis', ?, 'aura-memory', datetime('now'))").bind(id, synthesis).run();
        return Response.json({ ok: true, result: { synthesis, id }, traceId, from: "aura-memory" });
      }
      if (call.action === "memory.consolidate") {
        // Consolidate short-term memories into long-term
        const recent = await env.DB.prepare("SELECT id, content, category FROM memories WHERE created_at > datetime('now','-1 day') ORDER BY importance DESC LIMIT 20").all();
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Memory. Konsoliduj tieto krátkodobé pamäte do dlhodobých znalostí. JSON: {consolidated:[{title, content, importance}]}" },
          { role: "user", content: JSON.stringify(recent.results) }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        if (result.consolidated) {
          for (const c of result.consolidated) {
            await env.DB.prepare("INSERT INTO memory_long (id, title, content, importance, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, datetime('now'))").bind(c.title, c.content, c.importance||5).run();
          }
        }
        return Response.json({ ok: true, result, traceId, from: "aura-memory" });
      }
      if (call.action === "memory.semantic.search") {
        const r = await env.DB.prepare("SELECT id, title, content, source, created_at FROM memory_semantic WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC LIMIT 50").bind("%"+d.query+"%", "%"+d.query+"%").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-memory" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "memory", role: "Konsoliduje pamäť a syntetizuje znalosti", status: "active" }, traceId, from: "aura-memory" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Memory." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-memory" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-memory" }); }
  }
};