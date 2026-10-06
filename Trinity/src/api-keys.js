import {z} from 'zod';
import {hash,HttpError} from './security.js';

export const createApiKeySchema=z.object({
  name:z.string().trim().min(2).max(80),
  scopes:z.array(z.enum(['api:invoke'])).min(1).max(1).default(['api:invoke']),
  rate_limit_per_minute:z.number().int().min(1).max(600).default(60),
  expires_at:z.string().datetime({offset:true}).nullable().default(null)
}).strict();

const present=row=>({id:row.id,name:row.name,key_prefix:row.key_prefix,scopes:JSON.parse(row.scopes_json),rate_limit_per_minute:row.rate_limit_per_minute,status:row.status,created_at:row.created_at,last_used_at:row.last_used_at,expires_at:row.expires_at,revoked_at:row.revoked_at});
export async function listApiKeys(env,ownerId){const rows=await env.DB.prepare('SELECT * FROM ops_api_access_keys WHERE owner_id=? ORDER BY created_at DESC LIMIT 100').bind(ownerId).all();return rows.results.map(present);}
export async function createApiKey(env,ownerId,input){
  const data=createApiKeySchema.parse(input),bytes=crypto.getRandomValues(new Uint8Array(32));
  const material=Buffer.from(bytes).toString('base64url'),secret=`trn_live_${material}`,id=crypto.randomUUID(),prefix=secret.slice(0,17);
  const row=await env.DB.prepare(`INSERT INTO ops_api_access_keys(id,owner_id,name,key_hash,key_prefix,scopes_json,rate_limit_per_minute,expires_at) VALUES(?,?,?,?,?,?,?,?) RETURNING *`)
    .bind(id,ownerId,data.name,await hash(secret),prefix,JSON.stringify(data.scopes),data.rate_limit_per_minute,data.expires_at).first();
  return {...present(row),secret,secret_visible_once:true};
}
export async function revokeApiKey(env,ownerId,id){const row=await env.DB.prepare("UPDATE ops_api_access_keys SET status='revoked',revoked_at=datetime('now') WHERE id=? AND owner_id=? AND status='active' RETURNING *").bind(id,ownerId).first();if(!row)throw new HttpError(404,'Aktívny API kľúč neexistuje.');return present(row);}
export async function authenticateApiKey(request,env,scope='api:invoke'){
  const secret=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||request.headers.get('X-Trinity-API-Key')||'';
  if(!secret.startsWith('trn_live_')||secret.length<40)throw new HttpError(401,'Neplatný Trinity API kľúč.');
  const row=await env.DB.prepare("SELECT * FROM ops_api_access_keys WHERE key_hash=? AND status='active' AND (expires_at IS NULL OR expires_at>datetime('now'))").bind(await hash(secret)).first();
  if(!row)throw new HttpError(401,'Neplatný alebo zrušený Trinity API kľúč.');
  const scopes=JSON.parse(row.scopes_json);if(!scopes.includes(scope))throw new HttpError(403,'API kľúč nemá potrebné oprávnenie.');
  const window=Math.floor(Date.now()/60000);const usage=await env.DB.prepare(`INSERT INTO ops_api_key_usage(key_id,minute_window,request_count) VALUES(?,?,1) ON CONFLICT(key_id,minute_window) DO UPDATE SET request_count=request_count+1 RETURNING request_count`).bind(row.id,window).first();
  if(usage.request_count>row.rate_limit_per_minute)throw new HttpError(429,'Minútová kvóta API kľúča bola prekročená.');
  await env.DB.prepare("UPDATE ops_api_access_keys SET last_used_at=datetime('now') WHERE id=?").bind(row.id).run();
  return {id:row.id,owner_id:row.owner_id,name:row.name,scopes,rate_limit_per_minute:row.rate_limit_per_minute};
}
