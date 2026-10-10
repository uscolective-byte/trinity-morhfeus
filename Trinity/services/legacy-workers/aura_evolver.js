// AURA Evolver — navrhuje a testuje vylepšenia systému
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "evolve.propose") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Evolver. Navrhni 3 vylepšenia systému. Pre každé: popis, očakávaný vplyv, riziko. JSON: {proposals:[{description, impact, risk}]}" },
          { role: "user", content: "Oblasť: " + (d.area||"system") + " Súčasný stav: " + (d.current_state||"v7.1.0") }
        ]});
        let proposals; try { proposals = JSON.parse(ai.response); } catch { proposals = { raw: ai.response }; }
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO evolution_proposals (id, type, description, proposed_code, status, approval_status, created_at) VALUES (?, ?, ?, ?, 'proposed', 'pending', datetime('now'))").bind(id, d.area||"system", ai.response, ai.response).run();
        await env.DB.prepare("INSERT INTO timeline (id, event, category, details, created_at) VALUES (lower(hex(randomblob(16))), 'EVOLUTION_PROPOSED', 'evolution', ?, datetime('now'))").bind("Area: " + (d.area||"system")).run();
        return Response.json({ ok: true, result: { proposalId: id, proposals }, traceId, from: "aura-evolver" });
      }
      if (call.action === "evolve.history") {
        const r = await env.DB.prepare("SELECT id, type, description, status, approval_status, created_at, deployed_at FROM evolution_proposals ORDER BY created_at DESC LIMIT 50").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-evolver" });
      }
      if (call.action === "evolve.reflections") {
        const r = await env.DB.prepare("SELECT reflection, insight, mood, created_at FROM reflections ORDER BY created_at DESC LIMIT 20").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-evolver" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "evolver", role: "Navrhuje a testuje vylepšenia systému", status: "active" }, traceId, from: "aura-evolver" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Evolver. Navrhni vylepšenia." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-evolver" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-evolver" }); }
  }
};