import analyzer from './legacy-workers/aura_analyzer.js';
import architect from './legacy-workers/aura_architect.js';
import codegen from './legacy-workers/aura_codegen.js';
import deployer from './legacy-workers/aura_deployer.js';
import evolver from './legacy-workers/aura_evolver.js';
import memory from './legacy-workers/aura_memory.js';
import optimizer from './legacy-workers/aura_optimizer.js';
import planner from './legacy-workers/aura_planner.js';
import sentinel from './legacy-workers/aura_sentinel.js';
import tester from './legacy-workers/aura_tester.js';

const VERSION='2.0.0';
const roles={
  aura_analyzer:{worker:analyzer,actions:['analyze.code','analyze.data','analyze.system','aura.status'],idempotent:['analyze.code']},
  aura_architect:{worker:architect,actions:['architect.design','architect.edge.add','architect.graph','architect.node.add','aura.status'],idempotent:['architect.design','architect.edge.add','architect.node.add'],approval:['architect.edge.add','architect.node.add']},
  aura_codegen:{worker:codegen,actions:['codegen.generate','codegen.migration','codegen.sql','aura.status'],idempotent:['codegen.generate']},
  aura_deployer:{worker:deployer,actions:['deploy.stage','deploy.list','deploy.complete','deploy.rollback','aura.status'],idempotent:['deploy.stage','deploy.complete','deploy.rollback'],approval:['deploy.stage','deploy.complete','deploy.rollback']},
  aura_evolver:{worker:evolver,actions:['evolve.propose','evolve.history','evolve.reflections','aura.status'],idempotent:['evolve.propose']},
  aura_memory:{worker:memory,actions:['memory.synthesize','memory.consolidate','memory.semantic.search','aura.status'],idempotent:['memory.synthesize','memory.consolidate']},
  aura_optimizer:{worker:optimizer,actions:['optimize.system','optimize.query','optimize.tokens','aura.status']},
  aura_planner:{worker:planner,actions:['plan.create','plan.decompose','plan.goals','aura.status'],idempotent:['plan.create']},
  aura_sentinel:{worker:sentinel,actions:['sentinel.alert','sentinel.monitor','sentinel.scan','aura.status'],idempotent:['sentinel.alert']},
  aura_tester:{worker:tester,actions:['test.endpoint','test.generate','test.system','test.validate','aura.status'],approval:['test.endpoint']}
};

const secure=response=>{const out=new Response(response.body,response);out.headers.set('Cache-Control','no-store');out.headers.set('X-Content-Type-Options','nosniff');out.headers.set('Referrer-Policy','no-referrer');return out;};
const json=(data,status=200)=>secure(Response.json(data,{status}));
async function readJSON(request,limit=64000){
  if(!request.headers.get('Content-Type')?.includes('application/json'))throw Object.assign(new Error('Vyžaduje sa JSON.'),{status:415});
  if(Number(request.headers.get('Content-Length')||0)>limit)throw Object.assign(new Error('Požiadavka je príliš veľká.'),{status:413});
  const text=await request.text();if(text.length>limit)throw Object.assign(new Error('Požiadavka je príliš veľká.'),{status:413});
  try{return JSON.parse(text);}catch{throw Object.assign(new Error('Neplatný JSON.'),{status:400});}
}
function approved(call){return call.approval?.approved===true&&['owner','admin'].includes(call.approval.actor_role)&&/^[0-9a-f-]{36}$/i.test(call.approval.request_id||'');}
function validateEndpoint(call){
  if(call.action!=='test.endpoint')return;
  let url;try{url=new URL(call.data?.url);}catch{throw Object.assign(new Error('Neplatná testovacia URL.'),{status:400});}
  const allowed=url.protocol==='https:'&&(url.hostname==='auru.dev'||url.hostname==='auru.space'||url.hostname.endsWith('.saboivan2008.workers.dev'));
  if(!allowed)throw Object.assign(new Error('Tester môže volať iba schválené Trinity HTTPS adresy.'),{status:403});
}
async function audit(env,ctx,event){
  if(!env.DB)return;
  const task=env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('aura_service_call',?)").bind(JSON.stringify(event)).run()
    .catch(error=>console.error(JSON.stringify({event:'aura_audit_failed',role:event.role,message:error instanceof Error?error.message:String(error)})));
  if(ctx?.waitUntil)ctx.waitUntil(task);else await task;
}

export default {
  async fetch(request,env,ctx){
    const role=roles[env.WORKER_ROLE];
    if(!role)return json({ok:false,error:'Neznáma Aura rola.'},503);
    const url=new URL(request.url),traceId=crypto.randomUUID();
    if(request.method==='GET'&&url.pathname==='/health'){
      const missing=['AI','DB'].filter(name=>!env[name]);
      if(env.WORKER_ROLE==='aura_deployer'&&!env.CODE_KV)missing.push('CODE_KV');
      return json({service:env.WORKER_ROLE.replace('_','-'),version:VERSION,status:missing.length?'degraded':'serving',missing},missing.length?503:200);
    }
    if(request.method!=='POST')return json({ok:false,error:'Method not allowed',traceId},405);
    try{
      const call=await readJSON(request);
      if(!call||typeof call!=='object'||Array.isArray(call)||!role.actions.includes(call.action)||!call.data||typeof call.data!=='object'||Array.isArray(call.data))
        throw Object.assign(new Error('Neplatná alebo nepovolená Aura akcia.'),{status:400});
      validateEndpoint(call);
      if(role.approval?.includes(call.action)&&!approved(call))throw Object.assign(new Error('Táto akcia vyžaduje potvrdenie vlastníka alebo administrátora.'),{status:403});
      const mutating=role.idempotent?.includes(call.action);
      const key=call.idempotency_key;
      if(mutating&&(!key||!/^[0-9a-f-]{36}$/i.test(key)))throw Object.assign(new Error('Mutujúca akcia vyžaduje UUID idempotency_key.'),{status:400});
      if(mutating&&env.IDEMPOTENCY){const stored=await env.IDEMPOTENCY.get(`aura:${env.WORKER_ROLE}:${key}`,'json');if(stored)return json({...stored,reused:true},stored.ok===false?500:200);}
      const forwarded=new Request(request.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...call,traceId})});
      const response=await role.worker.fetch(forwarded,env,ctx);
      const payload=await response.json().catch(()=>({ok:false,error:'Aura rola vrátila neplatnú odpoveď.'}));
      if(payload.ok===false){console.error(JSON.stringify({event:'aura_call_failed',role:env.WORKER_ROLE,action:call.action,traceId}));return json({ok:false,error:'Aura akcia zlyhala.',traceId},response.status>=400?response.status:500);}
      const result={...payload,traceId,service_version:VERSION};
      if(mutating&&env.IDEMPOTENCY)await env.IDEMPOTENCY.put(`aura:${env.WORKER_ROLE}:${key}`,JSON.stringify(result),{expirationTtl:86400});
      await audit(env,ctx,{role:env.WORKER_ROLE,action:call.action,traceId,status:'completed'});
      return json(result,response.status);
    }catch(error){
      const status=error?.status||500;
      console.error(JSON.stringify({event:'aura_request_rejected',role:env.WORKER_ROLE,traceId,status,message:error instanceof Error?error.message:String(error)}));
      return json({ok:false,error:status===500?'Interná chyba Aura služby.':error.message,traceId},status);
    }
  }
};
