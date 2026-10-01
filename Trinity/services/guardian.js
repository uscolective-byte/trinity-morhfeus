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
      checkOrigin(request);await authenticate(request,env);
      if(path==='/api/check'&&request.method==='GET')return secure(Response.json(await record(env)));
      if(path==='/api/logs'&&request.method==='GET')return secure(Response.json((await env.DB.prepare("SELECT * FROM ops_events WHERE action='guardian_check' ORDER BY id DESC LIMIT 50").all()).results));
      return secure(Response.json({error:'Použi operačné centrum Trinity. Staré automatické wake/browse/talk akcie boli nahradené sledovanými úlohami.'},{status:410}));
    }catch(e){return secure(Response.json({error:e.status?e.message:'Monitoring zlyhal.'},{status:e.status||500}));}
  },
  async scheduled(_event,env){await record(env);}
};
