--72b9515da9811de5cf230940638ac94699062b40cee68f6541588791ac67
Content-Disposition: form-data; name="worker.js"

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "task.create" || call.action === "dispatch") {
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO tasks (id, title, description, status, assigned_agent, project_id, priority, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, NULL, ?, datetime('now'), datetime('now'))").bind(id, d.title, d.description||"", d.assigned_agent||"auto", d.priority||"normal").run();
        return Response.json({ ok: true, result: { id, status: "pending" }, traceId, from: "dispatcher" });
      }
      if (call.action === "task.list") {
        const r = await env.DB.prepare("SELECT id, title, status, assigned_agent, priority, created_at FROM tasks ORDER BY created_at DESC LIMIT ?").bind(d.limit||50).all();
        return Response.json({ ok: true, result: r.results, traceId, from: "dispatcher" });
      }
      if (call.action === "job.create") {
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO ops_jobs (id, session_id, task, team, provider, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))").bind(id, d.session_id||traceId, d.task, d.team||"[orchestrator]", d.provider||"ollama").run();
        return Response.json({ ok: true, result: { id, status: "pending" }, traceId, from: "dispatcher" });
      }
      if (call.action === "job.list") {
        const r = await env.DB.prepare("SELECT id, task, team, provider, status, created_at FROM ops_jobs ORDER BY created_at DESC LIMIT ?").bind(d.limit||50).all();
        return Response.json({ ok: true, result: r.results, traceId, from: "dispatcher" });
      }
      if (call.action === "route_aura") {
        const resp = await env.TRINITY.fetch("https://trinity-internal/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: d.action, data: d.data, traceId }) });
        return Response.json(await resp.json());
      }
      return Response.json({ ok: false, error: "Unknown: " + call.action, traceId, from: "dispatcher" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "dispatcher" }); }
  }
};
--72b9515da9811de5cf230940638ac94699062b40cee68f6541588791ac67--
