// AURA Tester — testuje, validuje a zabezpečuje kvalitu systému (Trinity 10.2)
import {runAuraAi, parseAuraJson, safeDbRun, safeDbWrite, AURA_SERVICE_VERSION} from './aura_helpers.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "test.generate") {
        const text = await runAuraAi(env,
          "Si AURA Tester. Generuj dôkladné testovacie scenáre (unit, edge case, failure). Odpovedz VÝHRADNE ako validný JSON: {\"tests\":[{\"name\":\"...\", \"input\":{}, \"expected\":{}, \"type\":\"unit|integration|edge\"}]}",
          "Cieľ: " + (d.target || "") + "\nKód: " + (d.code || "")
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-tester" });
      }
      if (call.action === "test.validate") {
        const text = await runAuraAi(env,
          "Si AURA Tester. Validuj predložený kód. Skontroluj: syntax, edge-cases, logiku, bezpečnosť, výkonnosť. Odpovedz VÝHRADNE ako validný JSON: {\"valid\": boolean, \"issues\":[{\"severity\":\"critical|warning|info\", \"description\":\"...\", \"fix\":\"...\"}], \"score\": 0-100}",
          d.code || d.target || ""
        );
        const result = parseAuraJson(text);
        await safeDbWrite(env.DB.prepare("INSERT INTO audit_log (id, module, action, details, severity, created_at) VALUES (lower(hex(randomblob(16))), 'tester', 'validate', ?, ?, datetime('now'))").bind(JSON.stringify(result), result.valid ? "info" : "warning").run());
        return Response.json({ ok: true, result, traceId, from: "aura-tester" });
      }
      if (call.action === "test.endpoint") {
        const method=d.method||'GET';
        if(!['GET','HEAD'].includes(method)||d.headers||d.body)throw Object.assign(new Error('Only credential-free GET/HEAD health checks are supported'),{status:400});
        const r=await fetch(d.url,{method,redirect:'manual',signal:AbortSignal.timeout(5000)});
        if(r.status>=300&&r.status<400)throw Object.assign(new Error('Redirects are disabled for endpoint probes'),{status:502});
        let body='';
        if(method==='GET'&&r.body){
          const reader=r.body.getReader(),decoder=new TextDecoder();
          let bytes=0;
          try {
            while(bytes<2048) {
              const {value,done}=await reader.read();if(done)break;
              const part=value.subarray(0,2048-bytes);bytes+=part.byteLength;
              body+=decoder.decode(part,{stream:true});
              if(part.byteLength<value.byteLength)break;
            }
            body+=decoder.decode();
          } finally {await reader.cancel().catch(()=>{});}
        }
        return Response.json({ok:true,result:{status:r.status,ok:r.ok,body},traceId,from:'aura-tester'});
      }
      if (call.action === "test.system") {
        const tables = await safeDbRun(env.DB.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'").first());
        const agents = await safeDbRun(env.DB.prepare("SELECT COUNT(*) as c FROM agents WHERE status='active'").first());
        const brain = await safeDbRun(env.DB.prepare("SELECT component, state FROM trinity_brain_state ORDER BY updated_at DESC LIMIT 5").all()) || { results: [] };
        const text = await runAuraAi(env,
          "Si AURA Tester. Vyhodnoť stav a integritu systému Trinity. Odpovedz VÝHRADNE ako validný JSON: {\"all_pass\": boolean, \"results\":[{\"test\":\"...\", \"passed\": boolean, \"details\":\"...\"}]}",
          "Tables: " + (tables?.c || 0) + "\nAgents: " + (agents?.c || 0) + "\nBrain: " + JSON.stringify(brain.results)
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-tester" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "tester", role: "Testuje, validuje kód a zabezpečuje kvalitu systému", status: "active", version: AURA_SERVICE_VERSION }, traceId, from: "aura-tester" });
      }
      const text = await runAuraAi(env, "Si AURA Tester. Spusti testy a validáciu.", d.prompt || call.action);
      return Response.json({ ok: true, result: { response: text }, traceId, from: "aura-tester" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-tester" }, {status: e.status || 500}); }
  }
};