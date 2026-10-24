// Trinity Skills Worker (services/skills.js)
const VERSION = '2.0.0';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      const missing = ['DB'].filter(name => !env[name]);
      return Response.json({
        service: 'trinity-skills',
        version: VERSION,
        status: missing.length ? 'degraded' : 'serving',
        missing
      }, { status: missing.length ? 503 : 200 });
    }

    if (request.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    let call;
    try {
      call = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();

    try {
      if (call.action === "skill.list") {
        if (!env.DB) return Response.json({ ok: true, result: [], traceId, from: "skills" });
        const r = await env.DB.prepare("SELECT id, name, description, category, type, enabled, created_at FROM trinity_skills ORDER BY name ASC").all().catch(() => ({ results: [] }));
        return Response.json({ ok: true, result: r.results || [], traceId, from: "skills" });
      }

      if (call.action === "skill.register") {
        const id = crypto.randomUUID();
        if (env.DB) {
          await env.DB.prepare("INSERT INTO trinity_skills (id, name, description, category, type, config, handler, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))")
            .bind(id, d.name || "Skill", d.description || "", d.category || "general", d.type || "tool", d.config || "{}", d.handler || "")
            .run()
            .catch(() => {});
        }
        return Response.json({ ok: true, result: { id }, traceId, from: "skills" });
      }

      if (call.action === "skill.execute") {
        if (!env.DB) return Response.json({ ok: false, error: "Database not available", traceId, from: "skills" }, { status: 503 });
        const skill = await env.DB.prepare("SELECT * FROM trinity_skills WHERE id = ? AND enabled = 1").bind(d.skill_id).first().catch(() => null);
        if (!skill) {
          return Response.json({ ok: false, error: "Skill not found or disabled", traceId, from: "skills" }, { status: 404 });
        }
        if (skill.type === "ai" && env.AI) {
          const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: [
              { role: "system", content: "You are executing skill: " + skill.name + ". Config: " + skill.config },
              { role: "user", content: d.input || "" }
            ]
          }).catch(err => ({ response: `Execution error: ${err.message}` }));
          return Response.json({ ok: true, result: { output: ai.response, skill: skill.name }, traceId, from: "skills" });
        }
        return Response.json({ ok: true, result: { status: "completed", output: `Executed skill: ${skill.name}` }, traceId, from: "skills" });
      }

      if (call.action === "skill.enable") {
        if (env.DB) {
          await env.DB.prepare("UPDATE trinity_skills SET enabled = 1, updated_at = datetime('now') WHERE id = ?").bind(d.skill_id).run().catch(() => {});
        }
        return Response.json({ ok: true, traceId, from: "skills" });
      }

      if (call.action === "skill.disable") {
        if (env.DB) {
          await env.DB.prepare("UPDATE trinity_skills SET enabled = 0, updated_at = datetime('now') WHERE id = ?").bind(d.skill_id).run().catch(() => {});
        }
        return Response.json({ ok: true, traceId, from: "skills" });
      }

      if (call.action === "plugin.list") {
        if (!env.DB) return Response.json({ ok: true, result: [], traceId, from: "skills" });
        const r = await env.DB.prepare("SELECT id, name, version, type, status, config FROM plugin_registry ORDER BY name ASC").all().catch(() => ({ results: [] }));
        return Response.json({ ok: true, result: r.results || [], traceId, from: "skills" });
      }

      return Response.json({ ok: false, error: "Unknown: " + call.action, traceId, from: "skills" }, { status: 400 });
    } catch (e) {
      return Response.json({ ok: false, error: e.message, traceId, from: "skills" }, { status: 500 });
    }
  }
};
