// AURA Deployer — nasadzuje Workery, spravuje verzie a rollback (Trinity 10.2)
import {runAuraAi, parseAuraJson, safeDbRun} from './aura_helpers.js';

export default {
  async fetch(request, env) {
    if (request.method === "GET" && new URL(request.url).pathname === "/health") {
      return Response.json({ ok: true, service: "aura_deployer", version: "10.3.0", status: "serving", bindings: { AI: !!env.AI, DB: !!env.DB } });
    }

    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "deploy.stage") {
        const version = "v" + Date.now();
        const key = "deploy:" + (d.name || "unknown") + ":" + version;
        if (env.CODE_KV) {
          await env.CODE_KV.put(key, d.code || "");
        }
        await safeDbRun(env.DB.prepare("INSERT INTO ops_studio_versions (id, project_name, version, status, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, 'staged', datetime('now'))").bind(d.name || "unknown", version).run());
        return Response.json({ ok: true, result: { key, version, status: "staged" }, traceId, from: "aura-deployer" });
      }
      if (call.action === "deploy.list") {
        const r = await safeDbRun(env.DB.prepare("SELECT id, project_name, version, status, created_at FROM ops_studio_versions ORDER BY created_at DESC LIMIT 50").all()) || { results: [] };
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-deployer" });
      }
      if (call.action === "deploy.complete") {
        await safeDbRun(env.DB.prepare("UPDATE ops_studio_versions SET status = 'deployed', deployed_at = datetime('now') WHERE id = ?").bind(d.version_id).run());
        await safeDbRun(env.DB.prepare("INSERT INTO timeline (id, event, category, details, created_at) VALUES (lower(hex(randomblob(16))), 'DEPLOY_COMPLETE', 'deploy', ?, datetime('now'))").bind("Version " + d.version_id + " deployed").run());
        return Response.json({ ok: true, result: { status: "deployed", version_id: d.version_id }, traceId, from: "aura-deployer" });
      }
      if (call.action === "deploy.rollback") {
        await safeDbRun(env.DB.prepare("UPDATE ops_studio_versions SET status = 'rolled_back' WHERE id = ?").bind(d.version_id).run());
        return Response.json({ ok: true, result: { status: "rolled_back", version_id: d.version_id }, traceId, from: "aura-deployer" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "deployer", role: "Nasadzuje Workery, spravuje verzie a rollback", status: "active", version: "10.3.0" }, traceId, from: "aura-deployer" });
      }
      const text = await runAuraAi(env, "Si AURA Deployer. Odpovedaj na otázky týkajúce sa nasadzovania, CI/CD a infraštruktúry Cloudflare Workers.", d.prompt || call.action);
      return Response.json({ ok: true, result: { response: text }, traceId, from: "aura-deployer" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-deployer" }); }
  }
};