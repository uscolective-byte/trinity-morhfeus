import {reviewReply} from './quality.mjs';

export const ROLE={id:'chat-maintainer',name:'Správca chatu Trinity',version:'1.0.0',
  duties:['reply-quality','stalled-job-detection','workflow-reconciliation','chat-diagnostics'],
  automatic_replay:false,interval_minutes:5};
const ERROR='Správca chatu ukončil nefunkčnú úlohu. Skús správu znova; pred opakovaním akcie over jej výsledok.';
function target(env,environment){
  if(!['production','development'].includes(environment))throw new Error('Invalid environment');
  const db=environment==='production'?env.PRODUCTION_DB:env.DEVELOPMENT_DB;
  const workflow=environment==='production'?env.PRODUCTION_WORKFLOW:env.DEVELOPMENT_WORKFLOW;
  if(!db||!workflow)throw new Error('Chat maintenance bindings unavailable');
  return {db,workflow};
}
export async function maintenanceStatus(env,environment){
  const {db}=target(env,environment);
  const [last,incidents]=await Promise.all([
    db.prepare("SELECT value FROM ops_memory WHERE key='chat-maintenance:last-check'").first(),
    db.prepare('SELECT job_id,kind,resolution,created_at FROM ops_chat_incidents ORDER BY created_at DESC LIMIT 10').all()
  ]);
  return {role:ROLE,environment,last_check:last?JSON.parse(last.value):null,incidents:incidents.results||[]};
}
export async function inspectChat(env,environment,{repair=false,now=Date.now()}={}){
  const {db,workflow}=target(env,environment);
  const active=(await db.prepare("SELECT id,status,updated_at FROM ops_jobs WHERE status IN ('queued','running') ORDER BY created_at LIMIT 20").all()).results||[];
  const report={environment,checked_at:new Date(now).toISOString(),checked:active.length,repaired:0,errors:0,automatic_replay:false};
  for(const job of active){
    const updated=Date.parse(job.updated_at.replace(' ','T')+'Z');
    if(!Number.isFinite(updated)||now-updated<5*60_000)continue;
    try{
      const instance=await workflow.get(job.id),state=await instance.status();
      const terminal=['errored','terminated','complete'].includes(state.status);
      const stalled=now-updated>45*60_000 && ['queued','running','waiting','paused','waitingForPause'].includes(state.status);
      if(!terminal&&!stalled)continue;
      if(!repair)continue;
      if(!terminal)await instance.terminate();
      const changed=await db.prepare("UPDATE ops_jobs SET status='failed',error=?,updated_at=datetime('now') WHERE id=? AND status=? AND updated_at=?")
        .bind(ERROR,job.id,job.status,job.updated_at).run();
      if(!changed.meta?.changes)continue;
      await db.batch([
        db.prepare("UPDATE ops_steps SET status='failed',error=?,updated_at=datetime('now') WHERE job_id=? AND status IN ('pending','running')").bind(ERROR,job.id),
        db.prepare("INSERT OR IGNORE INTO ops_chat_incidents(job_id,kind,resolution) VALUES(?,'stalled-job','failed-without-replay')").bind(job.id)
      ]);
      report.repaired++;
    }catch{report.errors++;}
  }
  const recent=(await db.prepare("SELECT id,substr(result,1,12000) AS result FROM ops_jobs WHERE status='completed' ORDER BY updated_at DESC LIMIT 20").all()).results||[];
  for(const job of recent){
    if(reviewReply(job.result).ok||!repair)continue;
    // Preserve the original answer and artifact for inspection. Never rerun a side effect.
    await db.prepare("INSERT OR IGNORE INTO ops_chat_incidents(job_id,kind,resolution) VALUES(?,'invalid-reply','preserved-for-review')").bind(job.id).run();
  }
  await db.prepare("INSERT INTO ops_memory(key,value,source,updated_at) VALUES('chat-maintenance:last-check',?,'chat-maintainer',datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
    .bind(JSON.stringify(report)).run();
  return report;
}
