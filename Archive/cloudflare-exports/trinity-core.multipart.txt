--4651a8f21fb7307b74175ee3f13c612ecc4d9239c53ac9d2bf11add4a48b
Content-Disposition: form-data; name="worker.js"

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "core.reason") {
        const sp = await env.DB.prepare("SELECT content FROM system_prompts WHERE active = 1 ORDER BY priority DESC LIMIT 1").first();
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: sp?.content || "You are Trinity." }, { role: "user", content: d.prompt }] });
        const thought = ai.response || "No response";
        await env.DB.prepare("INSERT INTO thoughts (id, thought_type, content, trigger_message, resulting_action, created_at) VALUES (?, 'reasoning', ?, ?, ?, datetime('now'))").bind(crypto.randomUUID(), d.prompt, d.prompt, thought.slice(0,2000)).run();
        return Response.json({ ok: true, result: { thought }, traceId, from: "core" });
      }
      if (call.action === "core.reflect") {
        const recent = await env.DB.prepare("SELECT content, resulting_action FROM thoughts ORDER BY created_at DESC LIMIT 10").all();
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "You are Trinity reflecting. Generate an insight." }, { role: "user", content: JSON.stringify(recent.results) }] });
        await env.DB.prepare("INSERT INTO reflections (reflection, insight, mood, created_at) VALUES (?, ?, 'contemplative', datetime('now'))").bind(d.topic||"general", ai.response||"").run();
        return Response.json({ ok: true, result: { reflection: ai.response }, traceId, from: "core" });
      }
      if (call.action === "core.state.get") {
        if (d.key) {
          const s = await env.DB.prepare("SELECT value FROM inner_state WHERE key = ?").bind(d.key).first();
          return Response.json(s ? { ok: true, result: { key: d.key, value: s.value }, traceId, from: "core" } : { ok: false, error: "Not found", traceId, from: "core" });
        }
        const r = await env.DB.prepare("SELECT key, value, updated_at FROM inner_state ORDER BY updated_at DESC").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "core" });
      }
      if (call.action === "core.state.set") {
        await env.DB.prepare("INSERT INTO inner_state (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')").bind(d.key, d.value).run();
        return Response.json({ ok: true, traceId, from: "core" });
      }
      if (call.action === "core.personality.get") {
        const r = await env.DB.prepare("SELECT trait, value FROM personality").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "core" });
      }
      if (call.action === "core.personality.set") {
        await env.DB.prepare("INSERT INTO personality (trait, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(trait) DO UPDATE SET value = excluded.value, updated_at = datetime('now')").bind(d.trait, d.value).run();
        return Response.json({ ok: true, traceId, from: "core" });
      }
      if (call.action === "core.brain.state") {
        const r = await env.DB.prepare("SELECT component, state, last_active, updated_at FROM trinity_brain_state ORDER BY updated_at DESC").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "core" });
      }
      if (call.action === "core.decide") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "You are Trinity's decision engine. Pick best option. JSON: {choice, reasoning}" }, { role: "user", content: "Options: " + JSON.stringify(d.options) + " Criteria: " + (d.criteria||"") }] });
        let decision; try { decision = JSON.parse(ai.response); } catch { decision = { choice: ai.response, reasoning: "raw" }; }
        return Response.json({ ok: true, result: decision, traceId, from: "core" });
      }
      return Response.json({ ok: false, error: "Unknown: " + call.action, traceId, from: "core" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "core" }); }
  }
};
--4651a8f21fb7307b74175ee3f13c612ecc4d9239c53ac9d2bf11add4a48b--
