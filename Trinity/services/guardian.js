import {authenticate,checkOrigin,secure} from '../src/security.js';
async function inspect(env){
  try{const r=await env.TRINITY.fetch('https://trinity.internal/health',{signal:AbortSignal.timeout(10000)});
    const d=await r.json();return {ok:r.ok&&d.status==='serving',service:'trinity-guardian',trinity_version:d.version,time:new Date().toISOString()};}
  catch{return {ok:false,service:'trinity-guardian',error:'Trinity neodpovedá.',time:new Date().toISOString()};}
}
async function record(env){
  const state=await inspect(env);
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('guardian_check',?)").bind(JSON.stringify(state)).run();return state;
}
export default {
  async fetch(request,env){
    try{
      const path=new URL(request.url).pathname;
      if(path==='/health'&&request.method==='GET'){const state=await inspect(env);return secure(Response.json(state,{status:state.ok?200:503}));}

      // Servisný kontrakt pre Trinity orchestrátor (POST s action cez service binding)
      if(request.method==='POST'){
        let call=null;
        try{call=await request.json();}catch{}
        if(call&&typeof call==='object'&&call.action){
          const traceId=call.traceId||crypto.randomUUID();
          const d=call.data||{};
          if(call.action==='audit.list'){
            const limit=Math.min(Math.max(Number(d.limit||50),1),100);
            const rows=await env.DB.prepare("SELECT id, action, details, created_at FROM ops_events ORDER BY id DESC LIMIT ?").bind(limit).all();
            return secure(Response.json({ok:true,result:rows.results,traceId,from:'guardian'}));
          }
          if(call.action==='audit.check'||call.action==='audit.status'){
            const state=await record(env);
            return secure(Response.json({ok:true,result:state,traceId,from:'guardian'}));
          }
          if(call.action==='audit.logs'){
            const rows=await env.DB.prepare("SELECT * FROM ops_events WHERE action='guardian_check' ORDER BY id DESC LIMIT 50").all();
            return secure(Response.json({ok:true,result:rows.results,traceId,from:'guardian'}));
          }
          return secure(Response.json({ok:false,error:'Unknown action: '+call.action,traceId,from:'guardian'},{status:400}));
        }
      }

      checkOrigin(request);await authenticate(request,env);
      if(path==='/api/check'&&request.method==='GET')return secure(Response.json(await record(env)));
      if(path==='/api/logs'&&request.method==='GET')return secure(Response.json((await env.DB.prepare("SELECT * FROM ops_events WHERE action='guardian_check' ORDER BY id DESC LIMIT 50").all()).results));
      return secure(Response.json({error:'Použi operačné centrum Trinity. Staré automatické wake/browse/talk akcie boli nahradené sledovanými úlohami.'},{status:410}));
    }catch(e){return secure(Response.json({error:e.status?e.message:'Monitoring zlyhal.'},{status:e.status||500}));}
  },
  async scheduled(_event,env){await record(env);}
};
