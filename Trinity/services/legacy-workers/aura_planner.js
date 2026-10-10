// AURA Planner — plánuje a rozdeľuje úlohy
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "plan.create") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Planner. Vytvor krok-za-krokom plán. Pre každý krok: akcia, agent, odhadovaný čas, závislosti. JSON: {steps:[{action, agent, time, deps}]}" },
          { role: "user", content: "Cieľ: " + d.goal }
        ]});
        let plan; try { plan = JSON.parse(ai.response); } catch { plan = { raw: ai.response }; }
        const goalId = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO goals (id, goal, priority, status, owner, created_at, updated_at) VALUES (?, ?, ?, 'active', 'aura-planner', datetime('now'), datetime('now'))").bind(goalId, d.goal, d.priority||5).run();
        return Response.json({ ok: true, result: { goalId, plan }, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.decompose") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Planner. Rozdeľ úlohu na menšie podúlohy. JSON: {subtasks:[{title, description, priority, assigned_agent}]}" },
          { role: "user", content: "Úloha: " + d.task }
        ]});
        let result; try { result = JSON.parse(ai.response); } catch { result = { raw: ai.response }; }
        if (result.subtasks) {
          for (const t of result.subtasks) {
            const id = crypto.randomUUID();
            await env.DB.prepare("INSERT INTO tasks (id, title, description, status, assigned_agent, project_id, priority, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, NULL, ?, datetime('now'), datetime('now'))").bind(id, t.title, t.description||"", t.assigned_agent||"auto", t.priority||"normal").run();
          }
        }
        return Response.json({ ok: true, result, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.goals") {
        const r = await env.DB.prepare("SELECT id, goal, priority, status, owner, created_at FROM goals WHERE status = 'active' ORDER BY priority DESC").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-planner" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "planner", role: "Plánuje a rozdeľuje úlohy, vytvára ciele", status: "active" }, traceId, from: "aura-planner" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Planner." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-planner" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-planner" }); }
  }
};