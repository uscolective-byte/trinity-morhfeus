import {readiness} from './services.js';
import {getPCBridgeStatus} from './system-actions.js';

// Read-only, bounded diagnostics. The route must requireAdmin before calling.
export async function developerStatus(env,version,probes={}){
  const errors=[];
  const read=async(name,fn,fallback)=>{
    try{return await fn();}catch{errors.push(name);return fallback;}
  };
  const boundedPC=async()=>{
    let timer;
    try{return await Promise.race([
      (probes.pc||getPCBridgeStatus)(env),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('PC status timeout')),probes.timeoutMs||4000);}),
    ]);}finally{clearTimeout(timer);}
  };
  const [ready,pc,jobs,events]=await Promise.all([
    read('readiness',()=> (probes.readiness||readiness)(env),{ready:false,checks:{}}),
    read('pc',boundedPC,{connected:false,status:'unavailable'}),
    read('jobs',async()=> (await env.DB.prepare('SELECT id,substr(task,1,160) AS task,status,updated_at,error IS NOT NULL AS has_error FROM ops_jobs ORDER BY created_at DESC,rowid DESC LIMIT 20').all()).results,[]),
    read('events',async()=> (await env.DB.prepare('SELECT id,action,created_at FROM ops_events ORDER BY id DESC LIMIT 15').all()).results,[]),
  ]);
  const seen=pc.last_seen_at||pc.last_seen||pc.lastSeen;
  const lastSeen=(typeof seen==='number'&&Number.isFinite(seen)&&seen>0)||(typeof seen==='string'&&seen.length<=64&&Number.isFinite(Date.parse(seen)))?seen:null;
  return {
    version,checked_at:new Date().toISOString(),read_only:true,partial:errors.length>0,unavailable_sections:errors,
    readiness:{ready:ready.ready===true,checks:ready.checks||{}},
    storage:{database:!!env.DB,cache:!!env.Mastermind,artifacts:!!env.ARTIFACTS,workflow:!!env.OPS_WORKFLOW},
    providers:{workers_ai:!!env.AI,openai:!!env.OPENAI_API_KEY,ollama:!!(env.OLLAMA_SECRET||env.OLLAMA_API_KEY)},
    pc:{connected:pc.connected===true,status:String(pc.status||'unknown').slice(0,60),
      last_seen:lastSeen},
    jobs,events,
    evidence_note:'Bindings mean configured, not successful inference. PC status is a service report, not proof of PC action completion.',
  };
}