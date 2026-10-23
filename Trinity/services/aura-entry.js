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
import {listAuraSafeSkills,executeAuraSafeSkill} from './legacy-workers/aura-safe-skills.js';

const VERSION='2.1.0';
const WRITE_ACTIONS=new Set(['analyze.code','architect.design','architect.edge.add','architect.node.add','codegen.generate','codegen.refactor','codegen.scaffold','evolve.propose','memory.synthesize','memory.consolidate','plan.task','plan.project','plan.create','plan.goals','sentinel.alert','sentinel.scan','test.validate','deploy.stage','deploy.complete','deploy.rollback']);
const COMMON_AURA_SKILLS=['aura.skills','aura.execute_skill'];
const roles={
  aura_analyzer:{worker:analyzer,actions:['analyze.code','analyze.data','analyze.system','aura.status',...COMMON_AURA_SKILLS],idempotent:['analyze.code']},
  aura_architect:{worker:architect,actions:['architect.design','architect.review','architect.evaluate','architect.diagram','architect.edge.add','architect.graph','architect.node.add','aura.status',...COMMON_AURA_SKILLS],idempotent:['architect.design','architect.edge.add','architect.node.add'],approval:['architect.edge.add','architect.node.add']},
  aura_codegen:{worker:codegen,actions:['codegen.generate','codegen.refactor','codegen.scaffold','codegen.docs','codegen.migration','codegen.sql','aura.status',...COMMON_AURA_SKILLS],idempotent:['codegen.generate','codegen.refactor','codegen.scaffold']},
  aura_deployer:{worker:deployer,actions:['deploy.stage','deploy.list','deploy.complete','deploy.rollback','aura.status',...COMMON_AURA_SKILLS],idempotent:['deploy.stage','deploy.complete','deploy.rollback'],approval:['deploy.stage','deploy.complete','deploy.rollback']},
  aura_evolver:{worker:evolver,actions:['evolve.propose','evolve.history','evolve.reflections','aura.status',...COMMON_AURA_SKILLS],idempotent:['evolve.propose']},
  aura_memory:{worker:memory,actions:['memory.synthesize','memory.consolidate','memory.semantic.search','aura.status',...COMMON_AURA_SKILLS],idempotent:['memory.synthesize','memory.consolidate']},
  aura_optimizer:{worker:optimizer,actions:['optimize.system','optimize.query','optimize.tokens','aura.status',...COMMON_AURA_SKILLS]},
  aura_planner:{worker:planner,actions:['plan.task','plan.project','plan.sprint','plan.timeline','plan.create','plan.decompose','plan.goals','aura.status',...COMMON_AURA_SKILLS],idempotent:['plan.task','plan.project','plan.create']},
  aura_sentinel:{worker:sentinel,actions:['sentinel.alert','sentinel.monitor','sentinel.scan','aura.status',...COMMON_AURA_SKILLS],idempotent:['sentinel.alert']},
  aura_tester:{worker:tester,actions:['test.endpoint','test.generate','test.system','test.validate','aura.status',...COMMON_AURA_SKILLS],approval:['test.endpoint']}
};

const secure=response=>{const out=new Response(response.body,response);out.headers.set('Cache-Control','no-store');out.headers.set('X-Content-Type-Options','nosniff');out.headers.set('Referrer-Policy','no-referrer');return out;};
const json=(data,status=200)=>secure(Response.json(data,{status}));
async function readJSON(request,limit=64000){
  if(!request.headers.get('Content-Type')?.includes('application/json'))throw Object.assign(new Error('Vyžaduje sa JSON.'),{status:415});
  if(Number(request.headers.get('Content-Length')||0)>limit)throw Object.assign(new Error('Požiadavka je príliš veľká.'),{status:413});
  const text=await request.text();if(new TextEncoder().encode(text).byteLength>limit)throw Object.assign(new Error('Požiadavka je príliš veľká.'),{status:413});
  try{return JSON.parse(text);}catch{throw Object.assign(new Error('Neplatný JSON.'),{status:400});}
}
function approved(call){return call.approval?.approved===true&&['owner','admin'].includes(call.approval.actor_role)&&/^[0-9a-f-]{36}$/i.test(call.approval.request_id||'');}
async function validServiceToken(request,env){
  const supplied=request.headers.get('X-Aura-Service-Token')||'';
  if(typeof env.AURA_SERVICE_TOKEN!=='string'||env.AURA_SERVICE_TOKEN.length<32||supplied.length<32||supplied.length>512)return false;
  const encode=new TextEncoder();
  const [wanted,actual]=await Promise.all([crypto.subtle.digest('SHA-256',encode.encode(env.AURA_SERVICE_TOKEN)),crypto.subtle.digest('SHA-256',encode.encode(supplied))]);
  const a=new Uint8Array(wanted),b=new Uint8Array(actual);
  let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
  return difference===0;
}
function validateEndpoint(call){
  if(call.action!=='test.endpoint')return;
  let url;try{url=new URL(call.data?.url);}catch{throw Object.assign(new Error('Neplatná testovacia URL.'),{status:400});}
  const allowed=url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash&&['/health','/ready'].includes(url.pathname)&&['auru.dev','auru.space'].includes(url.hostname);
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
      const mutating=WRITE_ACTIONS.has(call.action)||role.idempotent?.includes(call.action);
      if(mutating||role.approval?.includes(call.action)){
        if(!approved(call)||!await validServiceToken(request,env))throw Object.assign(new Error('Táto akcia vyžaduje overený interný token a schválenie.'),{status:403});
        if(!env.IDEMPOTENCY)throw Object.assign(new Error('Idempotency store is required for mutations'),{status:503});
      }
      const key=call.idempotency_key;
      if(mutating&&(!key||!/^[0-9a-f-]{36}$/i.test(key)))throw Object.assign(new Error('Mutujúca akcia vyžaduje UUID idempotency_key.'),{status:400});
      if(mutating&&env.IDEMPOTENCY){const stored=await env.IDEMPOTENCY.get(`aura:${env.WORKER_ROLE}:${key}`,'json');if(stored)return json({...stored,reused:true},stored.ok===false?500:200);}
      if(call.action==='aura.skills'){
        const list=listAuraSafeSkills();
        const result={ok:true,role:env.WORKER_ROLE,skills_count:list.length,skills:list,traceId,service_version:VERSION};
        await audit(env,ctx,{role:env.WORKER_ROLE,action:call.action,traceId,status:'completed'});
        return json(result,200);
      }
      if(call.action==='aura.execute_skill'){
        const skillName=call.data?.skill;
        if(!skillName||typeof skillName!=='string')throw Object.assign(new Error('Chýba názov skillu.'),{status:400});
        if(Array.isArray(call.data?.args)&&call.data.args.length>1)throw Object.assign(new Error('Only one argument is supported'),{status:400});
        const input=Array.isArray(call.data?.args)?call.data.args[0]:call.data?.params;
        const skillResult=await executeAuraSafeSkill(skillName,input,env);
        const result={ok:true,role:env.WORKER_ROLE,skill:skillName,result:skillResult,traceId,service_version:VERSION};
        if(mutating&&env.IDEMPOTENCY)await env.IDEMPOTENCY.put(`aura:${env.WORKER_ROLE}:${key}`,JSON.stringify(result),{expirationTtl:86400});
        await audit(env,ctx,{role:env.WORKER_ROLE,action:call.action,traceId,status:'completed'});
        return json(result,200);
      }
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
