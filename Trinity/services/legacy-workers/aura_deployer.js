// AURA Deployer — nasadzuje Workery, spravuje verzie a rollback (Trinity 10.2)
import {runAuraAi, AURA_SERVICE_VERSION} from './aura_helpers.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "deploy.stage") {
        if (!env.CODE_KV || !env.DB) throw Object.assign(new Error('CODE_KV and DB required'),{status:503});
        if (typeof d.name !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(d.name)) throw Object.assign(new Error('Invalid project name'),{status:400});
        if (typeof d.code !== 'string' || !d.code.trim() || new TextEncoder().encode(d.code).byteLength > 64000) throw Object.assign(new Error('Code must be 1-64000 UTF-8 bytes'),{status:400});
        const id=crypto.randomUUID(),version='v-'+id,key='deploy:'+d.name+':'+version;
        await env.CODE_KV.put(key,d.code);
        try {
          await env.DB.prepare("INSERT INTO ops_studio_versions (id, project_name, version, status, created_at) VALUES (?, ?, ?, 'staged', datetime('now'))").bind(id,d.name,version).run();
        } catch (error) {
          await env.CODE_KV.delete(key).catch(()=>{});
          throw error;
        }
        return Response.json({ok:true,result:{id,key,version,status:'staged',cloudflare_deployed:false},traceId,from:'aura-deployer'});
      }
      if (call.action === "deploy.list") {
        if(!env.DB)throw Object.assign(new Error('DB required'),{status:503});
        const r=await env.DB.prepare("SELECT id, project_name, version, status, created_at FROM ops_studio_versions ORDER BY created_at DESC LIMIT 50").all();
        return Response.json({ok:true,result:r.results||[],traceId,from:'aura-deployer'});
      }
      if (call.action === "deploy.complete" || call.action === "deploy.rollback") {
        // This legacy worker has no actual Cloudflare release/rollback integration.
        // Failing closed prevents forged deployment audit records and misleading UI.
        return Response.json({ok:false,error:'Live Cloudflare deployment is not implemented in Aura Deployer; use verified Wrangler/CI release receipts.',traceId,from:'aura-deployer'},{status:501});
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "deployer", role: "Nasadzuje Workery, spravuje verzie a rollback", status: "active", version: AURA_SERVICE_VERSION }, traceId, from: "aura-deployer" });
      }
      const text = await runAuraAi(env, "Si AURA Deployer. Odpovedaj na otázky týkajúce sa nasadzovania, CI/CD a infraštruktúry Cloudflare Workers.", d.prompt || call.action);
      return Response.json({ ok: true, result: { response: text }, traceId, from: "aura-deployer" });
    } catch (e) { return Response.json({ok:false,error:e.status&&e.status<500?e.message:"Aura Deployer failed",traceId,from:"aura-deployer"},{status:e.status||500}); }
  }
};