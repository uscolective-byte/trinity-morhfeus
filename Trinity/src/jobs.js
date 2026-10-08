import {z} from 'zod';
import {agentById,selectTeam} from './registry.js';
import {HttpError} from './security.js';
import {normalizeLanguage} from './cognition.js';
import {planTask} from './planner.js';
export const jobSchema=z.object({task:z.string().trim().min(1).max(12000),
  agent:z.string().default('auto'),mode:z.enum(['single','team']).default('single'),
  provider:z.enum(['workers-ai','openai','gemini','ollama','local']).default('workers-ai'),
  session_id:z.string().uuid().optional(),team:z.array(z.string()).min(1).max(5).optional(),
  language:z.string().max(35).default('auto').transform(normalizeLanguage),remember:z.boolean().default(false),owner_mode:z.boolean().default(false),idempotency_key:z.string().uuid().optional()}).strict();
export async function createJob(env, body) {
  const data=jobSchema.parse(body);
  if(data.agent!=='auto'&&!agentById(data.agent))throw new HttpError(400,'Neznámy agent.');
  const team=data.team?[...new Set(data.team)]:selectTeam(data.task,data.mode,data.agent);
  if(team.some(id=>!agentById(id)))throw new HttpError(400,'Neznámy agent.');
  if(!env.OPS_WORKFLOW)throw new HttpError(503,'Workflow nie je pripojený.');
  const id=crypto.randomUUID(), session=data.session_id||crypto.randomUUID(), plan=planTask(data.task);
  await env.DB.prepare(`INSERT INTO ops_jobs(id,session_id,task,team,provider,idempotency_key,language,intent,risk_level,plan_json,owner_mode) VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(idempotency_key) DO NOTHING`).bind(id,session,data.task,JSON.stringify(team),data.provider,data.idempotency_key||null,data.language,plan.intent,plan.risk,JSON.stringify(plan),data.owner_mode?1:0).run();
  const row=await env.DB.prepare(data.idempotency_key?'SELECT * FROM ops_jobs WHERE idempotency_key=?':'SELECT * FROM ops_jobs WHERE id=?').bind(data.idempotency_key||id).first();
  if(row.id!==id)return {id:row.id,session_id:row.session_id,status:row.status,intent:row.intent,risk_level:row.risk_level,plan:JSON.parse(row.plan_json||'{}'),reused:true};
  if(data.remember)await env.DB.prepare("INSERT INTO ops_memory(key,value,source) VALUES(?,?,'user-explicit')").bind('rozhovor/'+id,data.task).run();
  try {await env.OPS_WORKFLOW.create({id,params:{job_id:id}});}
  catch {await env.DB.prepare("UPDATE ops_jobs SET status='failed', error='Workflow sa nepodarilo spustiť.' WHERE id=?").bind(id).run();throw new HttpError(502,'Workflow sa nepodarilo spustiť.');}
  return {id,session_id:session,status:'queued',team,intent:plan.intent,risk_level:plan.risk,plan};
}
export async function getJob(env,id) {
  const job=await env.DB.prepare('SELECT * FROM ops_jobs WHERE id=?').bind(id).first();
  if(!job)throw new HttpError(404,'Úloha neexistuje.');
  const steps=await env.DB.prepare('SELECT * FROM ops_steps WHERE job_id=? ORDER BY position').bind(id).all();
  return {...job,team:JSON.parse(job.team),plan:JSON.parse(job.plan_json||'{}'),context_summary:JSON.parse(job.context_summary||'null'),steps:steps.results.map(s=>({...s,tool_log:JSON.parse(s.tool_log||'[]')}))};
}

export async function listJobs(env,limit=20){
  const bounded=Math.max(1,Math.min(50,Number.isInteger(limit)?limit:20));
  const rows=await env.DB.prepare('SELECT id,session_id,task,team,status,provider,intent,risk_level,created_at,updated_at FROM ops_jobs ORDER BY created_at DESC,rowid DESC LIMIT ?').bind(bounded).all();
  return (rows.results||[]).map(row=>({...row,team:JSON.parse(row.team||'[]')}));
}
