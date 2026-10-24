// Trinity Core Worker (services/core.js)
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
        service: 'trinity-core',
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
      if (call.action === "core.reason") {
        let sp = null;
        if (env.DB) {
          sp = await env.DB.prepare("SELECT content FROM system_prompts WHERE active = 1 ORDER BY priority DESC LIMIT 1").first().catch(() => null);
        }
        let thought = "No response";
        if (env.AI) {
          const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: [
              { role: "system", content: sp?.content || "You are Trinity." },
              { role: "user", content: d.prompt || "" }
            ]
          }).catch(err => ({ response: `Reasoning fallback: ${err.message}` }));
          thought = ai?.response || thought;
        } else {
          thought = `Autonomous reasoning result for: ${d.prompt || 'general task'}`;
        }
        if (env.DB) {
          await env.DB.prepare("INSERT INTO thoughts (id, thought_type, content, trigger_message, resulting_action, created_at) VALUES (?, 'reasoning', ?, ?, ?, datetime('now'))")
            .bind(crypto.randomUUID(), d.prompt || "", d.prompt || "", String(thought).slice(0, 2000))
            .run()
            .catch(() => {});
        }
        return Response.json({ ok: true, result: { thought }, traceId, from: "core" });
      }

      if (call.action === "core.reflect") {
        let recent = { results: [] };
        if (env.DB) {
          recent = await env.DB.prepare("SELECT content, resulting_action FROM thoughts ORDER BY created_at DESC LIMIT 10").all().catch(() => ({ results: [] }));
        }
        let reflection = "Trinity autonomous reflection";
        if (env.AI) {
          const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: [
              { role: "system", content: "You are Trinity reflecting. Generate an insight." },
              { role: "user", content: JSON.stringify(recent.results) }
            ]
          }).catch(err => ({ response: `Reflection fallback: ${err.message}` }));
          reflection = ai?.response || reflection;
        }
        if (env.DB) {
          await env.DB.prepare("INSERT INTO reflections (reflection, insight, mood, created_at) VALUES (?, ?, 'contemplative', datetime('now'))")
            .bind(d.topic || "general", reflection)
            .run()
            .catch(() => {});
        }
        return Response.json({ ok: true, result: { reflection }, traceId, from: "core" });
      }

      if (call.action === "core.state.get") {
        if (!env.DB) return Response.json({ ok: true, result: [], traceId, from: "core" });
        if (d.key) {
          const s = await env.DB.prepare("SELECT value FROM inner_state WHERE key = ?").bind(d.key).first().catch(() => null);
          return Response.json(s ? { ok: true, result: { key: d.key, value: s.value }, traceId, from: "core" } : { ok: false, error: "Not found", traceId, from: "core" });
        }
        const r = await env.DB.prepare("SELECT key, value, updated_at FROM inner_state ORDER BY updated_at DESC").all().catch(() => ({ results: [] }));
        return Response.json({ ok: true, result: r.results || [], traceId, from: "core" });
      }

      if (call.action === "core.state.set") {
        if (!env.DB) return Response.json({ ok: true, traceId, from: "core" });
        await env.DB.prepare("INSERT INTO inner_state (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')")
          .bind(d.key, d.value)
          .run()
          .catch(() => {});
        return Response.json({ ok: true, traceId, from: "core" });
      }

      if (call.action === "core.personality.get") {
        if (!env.DB) return Response.json({ ok: true, result: [], traceId, from: "core" });
        const r = await env.DB.prepare("SELECT trait, value FROM personality").all().catch(() => ({ results: [] }));
        return Response.json({ ok: true, result: r.results || [], traceId, from: "core" });
      }

      if (call.action === "core.personality.set") {
        if (!env.DB) return Response.json({ ok: true, traceId, from: "core" });
        await env.DB.prepare("INSERT INTO personality (trait, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(trait) DO UPDATE SET value = excluded.value, updated_at = datetime('now')")
          .bind(d.trait, d.value)
          .run()
          .catch(() => {});
        return Response.json({ ok: true, traceId, from: "core" });
      }

      if (call.action === "core.brain.state") {
        if (!env.DB) return Response.json({ ok: true, result: [], traceId, from: "core" });
        const r = await env.DB.prepare("SELECT component, state, last_active, updated_at FROM trinity_brain_state ORDER BY updated_at DESC").all().catch(() => ({ results: [] }));
        return Response.json({ ok: true, result: r.results || [], traceId, from: "core" });
      }

      if (call.action === "core.decide") {
        let decision = { choice: d.options?.[0] || "default", reasoning: "autonomous policy" };
        if (env.AI) {
          const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: [
              { role: "system", content: "You are Trinity's decision engine. Pick best option. JSON: {\"choice\": \"...\", \"reasoning\": \"...\"}" },
              { role: "user", content: "Options: " + JSON.stringify(d.options) + " Criteria: " + (d.criteria || "") }
            ]
          }).catch(() => null);
          if (ai?.response) {
            try { decision = JSON.parse(ai.response); } catch { decision = { choice: ai.response, reasoning: "raw" }; }
          }
        }
        return Response.json({ ok: true, result: decision, traceId, from: "core" });
      }

      return Response.json({ ok: false, error: "Unknown: " + call.action, traceId, from: "core" }, { status: 400 });
    } catch (e) {
      return Response.json({ ok: false, error: e.message, traceId, from: "core" }, { status: 500 });
    }
  }
};
