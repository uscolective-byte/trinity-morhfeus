import {getJob} from './jobs.js';
import {HttpError} from './security.js';
export async function cancelWorkflowJob(env,id,load=getJob){
 const job=await load(env,id);
 if(['completed','failed','cancelled'].includes(job.status))return {status:job.status};
 try{await (await env.OPS_WORKFLOW.get(id)).terminate();}
 catch{throw new HttpError(502,'Workflow nepotvrdil zastavenie. Úloha nie je označená ako zrušená.');}
 const changed=await env.DB.prepare("UPDATE ops_jobs SET status='cancelled',updated_at=datetime('now') WHERE id=? AND status IN ('queued','running') RETURNING status").bind(id).first();
 const status=changed?.status||(await env.DB.prepare('SELECT status FROM ops_jobs WHERE id=?').bind(id).first())?.status;
 if(status==='cancelled')await env.DB.prepare("UPDATE ops_steps SET status='cancelled',updated_at=datetime('now') WHERE job_id=? AND status IN ('pending','running')").bind(id).run();
 if(!['cancelled','completed','failed'].includes(status))throw new HttpError(409,'Aktuálny stav úlohy nie je potvrdený. Obnov jej detail.');
 return {status};
}
