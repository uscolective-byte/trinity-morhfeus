--db0e5c7ad43da4322f7f16d082acb07f72064239921c5756549f7976c004
Content-Disposition: form-data; name="worker.js"

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "skill.list") {
        const r = await env.DB.prepare("SELECT id, name, description, category, type, enabled, created_at FROM trinity_skills ORDER BY name ASC").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "skills" });
      }
      if (call.action === "skill.register") {
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO trinity_skills (id, name, description, category, type, config, handler, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))").bind(id, d.name, d.description||"", d.category||"general", d.type||"tool", d.config||"{}", d.handler||"").run();
        return Response.json({ ok: true, result: { id }, traceId, from: "skills" });
      }
      if (call.action === "skill.execute") {
        const skill = await env.DB.prepare("SELECT * FROM trinity_skills WHERE id = ? AND enabled = 1").bind(d.skill_id).first();
        if (!skill) return Response.json({ ok: false, error: "Skill not found or disabled", traceId, from: "skills" });
        if (skill.type === "ai") {
          const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "You are executing skill: " + skill.name + ". Config: " + skill.config }, { role: "user", content: d.input || "" }] });
          return Response.json({ ok: true, result: { output: ai.response, skill: skill.name }, traceId, from: "skills" });
        }
        return Response.json({ ok: true, result: { status: "pending_external" }, traceId, from: "skills" });
      }
      if (call.action === "skill.enable") {
        await env.DB.prepare("UPDATE trinity_skills SET enabled = 1, updated_at = datetime('now') WHERE id = ?").bind(d.skill_id).run();
        return Response.json({ ok: true, traceId, from: "skills" });
      }
      if (call.action === "skill.disable") {
        await env.DB.prepare("UPDATE trinity_skills SET enabled = 0, updated_at = datetime('now') WHERE id = ?").bind(d.skill_id).run();
        return Response.json({ ok: true, traceId, from: "skills" });
      }
      if (call.action === "plugin.list") {
        const r = await env.DB.prepare("SELECT id, name, version, type, status, config FROM plugin_registry ORDER BY name ASC").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "skills" });
      }
      return Response.json({ ok: false, error: "Unknown: " + call.action, traceId, from: "skills" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "skills" }); }
  }
};
--db0e5c7ad43da4322f7f16d082acb07f72064239921c5756549f7976c004--
