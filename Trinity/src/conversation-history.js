import {usableModelText} from './services.js';

export async function loadConversationHistory(env,sessionId,jobId) {
  const rows=await env.DB.prepare("SELECT task,substr(result,1,1600) AS result FROM ops_jobs WHERE session_id=? AND id<>? AND status='completed' ORDER BY created_at DESC,rowid DESC LIMIT 4").bind(sessionId,jobId).all();
  return rows.results.filter(row=>usableModelText(row.result||'') && !/m[oô]j zoznam n[aá]strojov/i.test(row.result||'')).reverse();
}
