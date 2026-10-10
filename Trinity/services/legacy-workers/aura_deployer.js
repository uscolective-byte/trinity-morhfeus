// AURA Deployer — nasadzuje Workery, spravuje verzie
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "deploy.stage") {
        const version = "v" + Date.now();
        const key = "deploy:" + (d.name||"unknown") + ":" + version;
        await env.CODE_KV.put(key, d.code||"");
        await env.DB.prepare("INSERT INTO ops_studio_versions (id, project_name, version, status, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, 'staged', datetime('now'))").bind(d.name||"unknown", version).run();
        return Response.json({ ok: true, result: { key, version }, traceId, from: "aura-deployer" });
      }
      if (call.action === "deploy.list") {
        const r = await env.DB.prepare("SELECT id, project_name, version, status, created_at FROM ops_studio_versions ORDER BY created_at DESC LIMIT 50").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-deployer" });
      }
      if (call.action === "deploy.complete") {
        await env.DB.prepare("UPDATE ops_studio_versions SET status = 'deployed', deployed_at = datetime('now') WHERE id = ?").bind(d.version_id).run();
        await env.DB.prepare("INSERT INTO timeline (id, event, category, details, created_at) VALUES (lower(hex(randomblob(16))), 'DEPLOY_COMPLETE', 'deploy', ?, datetime('now'))").bind("Version " + d.version_id + " deployed").run();
        return Response.json({ ok: true, traceId, from: "aura-deployer" });
      }
      if (call.action === "deploy.rollback") {
        await env.DB.prepare("UPDATE ops_studio_versions SET status = 'rolled_back' WHERE id = ?").bind(d.version_id).run();
        return Response.json({ ok: true, traceId, from: "aura-deployer" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "deployer", role: "Nasadzuje Workery, spravuje verzie a rollback", status: "active" }, traceId, from: "aura-deployer" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Deployer." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-deployer" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-deployer" }); }
  }
};