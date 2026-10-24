// Trinity Skills Worker (services/skills.js)
const VERSION = '2.1.0';

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

    // Priorita 1: Autorizácia interných operácií
    const authHeader = request.headers.get('Authorization') || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const expectedSecret = env?.TRINITY_INTERNAL_KEY || env?.TRINITY_GATEWAY_KEY;
    const isInternalBinding = url.hostname === 'trinity.internal' || url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    // Ak je definovaný serverový kľúč, vyžaduje sa presná zhoda. Inak je povolený len vnútorný service binding.
    const isAuthorized = expectedSecret
      ? (Boolean(bearerToken) && bearerToken === expectedSecret)
      : isInternalBinding;

    const mutatingActions = ['skill.register', 'skill.execute', 'skill.enable', 'skill.disable'];
    if (mutatingActions.includes(call.action) && !isAuthorized) {
      return Response.json({
        ok: false,
        error: "Unauthorized: valid server secret token required",
        status: "unauthorized",
        traceId,
        from: "skills"
      }, { status: 401 });
    }

    try {
      if (call.action === "skill.list") {
        if (!env?.DB) return Response.json({ ok: true, result: [], traceId, from: "skills" });
        const r = await env.DB.prepare("SELECT id, name, description, category, type, enabled, created_at FROM trinity_skills ORDER BY name ASC").all();
        return Response.json({ ok: true, result: r.results || [], traceId, from: "skills" });
      }

      if (call.action === "skill.register") {
        if (!env?.DB) {
          return Response.json({ ok: false, error: "Database not available", status: "database_unavailable", traceId, from: "skills" }, { status: 503 });
        }
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO trinity_skills (id, name, description, category, type, config, handler, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))")
          .bind(id, d.name || "Skill", d.description || "", d.category || "general", d.type || "tool", d.config || "{}", d.handler || "")
          .run();
        return Response.json({ ok: true, result: { id, name: d.name || "Skill" }, traceId, from: "skills" });
      }

      if (call.action === "skill.execute") {
        if (!env?.DB) return Response.json({ ok: false, error: "Database not available", traceId, from: "skills" }, { status: 503 });
        const skill = await env.DB.prepare("SELECT * FROM trinity_skills WHERE id = ? AND enabled = 1").bind(d.skill_id).first();
        if (!skill) {
          return Response.json({ ok: false, error: "Skill not found or disabled", traceId, from: "skills" }, { status: 404 });
        }
        if (skill.type === "ai" && env.AI) {
          try {
            const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
              messages: [
                { role: "system", content: "You are executing skill: " + skill.name + ". Config: " + skill.config },
                { role: "user", content: d.input || "" }
              ]
            });
            return Response.json({ ok: true, result: { output: ai.response, skill: skill.name, status: "completed" }, traceId, from: "skills" });
          } catch (err) {
            return Response.json({
              ok: false,
              error: `AI Execution failed: ${err.message}`,
              status: "failed",
              traceId,
              from: "skills"
            }, { status: 502 });
          }
        }
        if (skill.handler && skill.handler.trim() === 'echo') {
          return Response.json({
            ok: true,
            result: { status: "completed", output: d.input || "echo", echoed_at: new Date().toISOString() },
            traceId,
            from: "skills"
          });
        }
        if (skill.handler && skill.handler.trim() === 'system_info') {
          return Response.json({
            ok: true,
            result: { status: "completed", service: "trinity-skills", version: VERSION, uptime: Date.now() },
            traceId,
            from: "skills"
          });
        }
        return Response.json({
          ok: false,
          error: `Handler not implemented for non-AI skill: ${skill.name} (${skill.handler || 'no handler'})`,
          status: "unsupported",
          traceId,
          from: "skills"
        }, { status: 501 });
      }

      if (call.action === "skill.enable") {
        if (!env?.DB) {
          return Response.json({ ok: false, error: "Database not available", status: "database_unavailable", traceId, from: "skills" }, { status: 503 });
        }
        const r = await env.DB.prepare("UPDATE trinity_skills SET enabled = 1, updated_at = datetime('now') WHERE id = ?").bind(d.skill_id).run();
        if (r && r.meta && r.meta.changes === 0) {
          return Response.json({ ok: false, error: "Skill not found", status: "not_found", traceId, from: "skills" }, { status: 404 });
        }
        return Response.json({ ok: true, traceId, from: "skills" });
      }

      if (call.action === "skill.disable") {
        if (!env?.DB) {
          return Response.json({ ok: false, error: "Database not available", status: "database_unavailable", traceId, from: "skills" }, { status: 503 });
        }
        const r = await env.DB.prepare("UPDATE trinity_skills SET enabled = 0, updated_at = datetime('now') WHERE id = ?").bind(d.skill_id).run();
        if (r && r.meta && r.meta.changes === 0) {
          return Response.json({ ok: false, error: "Skill not found", status: "not_found", traceId, from: "skills" }, { status: 404 });
        }
        return Response.json({ ok: true, traceId, from: "skills" });
      }

      if (call.action === "plugin.list") {
        if (!env.DB) return Response.json({ ok: true, result: [], traceId, from: "skills" });
        const r = await env.DB.prepare("SELECT id, name, version, type, status, config FROM plugin_registry ORDER BY name ASC").all();
        return Response.json({ ok: true, result: r.results || [], traceId, from: "skills" });
      }

      return Response.json({
        ok: false,
        error: "Unsupported action: " + call.action,
        status: "unsupported",
        traceId,
        from: "skills"
      }, { status: 400 });
    } catch (e) {
      return Response.json({
        ok: false,
        error: e.message,
        status: "failed",
        traceId,
        from: "skills"
      }, { status: 500 });
    }
  }
};
