import {z} from 'zod';
import {HttpError} from './security.js';

export const secretInputSchema=z.object({
  provider:z.enum(['github','cloudflare','gemini','custom']),
  name:z.string().trim().min(2).max(80),
  secret:z.string().trim().min(8).max(4096)
}).strict();

const encode=value=>Buffer.from(value).toString('base64url');
const decode=value=>new Uint8Array(Buffer.from(value,'base64url'));
async function key(env){
  if(typeof env.TRINITY_VAULT_KEY!=='string')throw new HttpError(503,'Trezor tajomstiev ešte nemá hlavný šifrovací kľúč.');
  const raw=decode(env.TRINITY_VAULT_KEY);if(raw.length!==32)throw new HttpError(503,'Hlavný kľúč trezora má neplatný formát.');
  return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function encrypt(env,ownerId,provider,name,value){const iv=crypto.getRandomValues(new Uint8Array(12)),aad=new TextEncoder().encode(`${ownerId}:${provider}:${name}`),plain=new TextEncoder().encode(value);const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},await key(env),plain);return {ciphertext:encode(new Uint8Array(cipher)),iv:encode(iv)};}
async function decrypt(env,row){const aad=new TextEncoder().encode(`${row.owner_id}:${row.provider}:${row.name}`);try{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(row.secret_iv),additionalData:aad},await key(env),decode(row.secret_ciphertext));return new TextDecoder().decode(plain);}catch{throw new HttpError(500,'Tajomstvo sa nepodarilo bezpečne dešifrovať.');}}
const present=row=>({id:row.id,provider:row.provider,name:row.name,secret_hint:row.secret_hint,status:row.status,verification:row.verification_json?JSON.parse(row.verification_json):null,created_at:row.created_at,updated_at:row.updated_at,last_verified_at:row.last_verified_at,revoked_at:row.revoked_at});
export async function listSecrets(env,ownerId){const rows=await env.DB.prepare("SELECT * FROM ops_secret_vault WHERE owner_id=? AND status!='revoked' ORDER BY created_at DESC LIMIT 100").bind(ownerId).all();return rows.results.map(present);}
export async function storeSecret(env,ownerId,input){const data=secretInputSchema.parse(input),encrypted=await encrypt(env,ownerId,data.provider,data.name,data.secret),hint=`••••${data.secret.slice(-4)}`,id=crypto.randomUUID();const row=await env.DB.prepare(`INSERT INTO ops_secret_vault(id,owner_id,provider,name,secret_ciphertext,secret_iv,secret_hint) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner_id,provider,name) DO UPDATE SET secret_ciphertext=excluded.secret_ciphertext,secret_iv=excluded.secret_iv,secret_hint=excluded.secret_hint,status='stored',verification_json=NULL,updated_at=datetime('now'),last_verified_at=NULL,revoked_at=NULL RETURNING *`).bind(id,ownerId,data.provider,data.name,encrypted.ciphertext,encrypted.iv,hint).first();await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('secret_stored',?)").bind(JSON.stringify({id:row.id,provider:data.provider,name:data.name,owner_id:ownerId})).run();return present(row);}
async function verifyGitHub(secret){const headers={Authorization:`Bearer ${secret}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Trinity-Integration-Hub'};const [user,repo]=await Promise.all([fetch('https://api.github.com/user',{headers,signal:AbortSignal.timeout(15000)}),fetch('https://api.github.com/repos/uscolective-byte/trinity-morhfeus',{headers,signal:AbortSignal.timeout(15000)})]);if(!user.ok)throw new Error(`GitHub odmietol poverenie (HTTP ${user.status}).`);const account=await user.json();return {connected:true,account:account.login,repository_access:repo.ok,repository:'uscolective-byte/trinity-morhfeus'};}
async function verifyCloudflare(secret){const response=await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify',{headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(15000)});const data=await response.json().catch(()=>({}));if(!response.ok||!data.success)throw new Error(`Cloudflare odmietol token (HTTP ${response.status}).`);return {connected:true,token_status:data.result?.status||'active'};}
async function verifyGemini(secret){
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':secret},signal:AbortSignal.timeout(15000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`Gemini odmietlo API kľúč (HTTP ${response.status}).`);
  const models=(data.models||[]).filter(item=>(item.supportedGenerationMethods||[]).includes('generateContent')).map(item=>item.name).filter(name=>/^models\/gemini-/i.test(name)).slice(0,100);
  if(!models.length)throw new Error('Gemini nevrátilo žiadny model pre generovanie textu.');
  const model=models.includes('models/gemini-3.8-flash')?'models/gemini-3.8-flash':models.find(name=>/flash/i.test(name)&&!/image|tts|preview/i.test(name))||models[0];
  const live=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',headers:{'x-goog-api-key':secret,'Content-Type':'application/json'},
    body:JSON.stringify({model:model.replace(/^models\//,''),input:'Reply exactly OK.',store:false,generation_config:{max_output_tokens:8,temperature:0}}),
    signal:AbortSignal.timeout(30000),redirect:'manual'
  });
  const liveData=await live.json().catch(()=>({}));
  if(!live.ok)throw new Error(`Gemini živý test zlyhal (HTTP ${live.status}): ${String(liveData.error?.message||'projekt nemá prístup').slice(0,240)}`);
  if(!String(liveData.output_text||'').trim())throw new Error('Gemini živý test vrátil prázdnu odpoveď.');
  return {connected:true,models,model_count:models.length,generation_verified:true,verified_model:model};
}
export async function getSecretMaterial(env,{ownerId,id,provider}){const row=await env.DB.prepare("SELECT * FROM ops_secret_vault WHERE id=? AND owner_id=? AND provider=? AND status!='revoked'").bind(id,ownerId,provider).first();if(!row)throw new HttpError(404,'Tajomstvo neexistuje.');return {...row,secret:await decrypt(env,row)};}
export const isGeminiCandidate=name=>/gemini/i.test(String(name||''));
export async function promoteCustomSecretToGemini(env,ownerId,id){
  const source=await getSecretMaterial(env,{ownerId,id,provider:'custom'});
  if(!isGeminiCandidate(source.name))throw new HttpError(400,'Ako Gemini možno priradiť iba vlastný kľúč s názvom Gemini.');
  const stored=await storeSecret(env,ownerId,{provider:'gemini',name:source.name,secret:source.secret});
  const verified=await verifySecret(env,ownerId,stored.id);
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('secret_promoted_to_gemini',?)")
    .bind(JSON.stringify({owner_id:ownerId,source_id:id,target_id:verified.id})).run();
  return verified;
}
export async function verifySecret(env,ownerId,id){const row=await env.DB.prepare("SELECT * FROM ops_secret_vault WHERE id=? AND owner_id=? AND status!='revoked'").bind(id,ownerId).first();if(!row)throw new HttpError(404,'Tajomstvo neexistuje.');if(row.provider==='custom')throw new HttpError(400,'Vlastné tajomstvo nemá automatický test.');try{const secret=await decrypt(env,row);const verification=row.provider==='github'?await verifyGitHub(secret):row.provider==='cloudflare'?await verifyCloudflare(secret):await verifyGemini(secret);const changed=await env.DB.prepare("UPDATE ops_secret_vault SET status='verified',verification_json=?,last_verified_at=datetime('now'),updated_at=datetime('now') WHERE id=? RETURNING *").bind(JSON.stringify(verification),id).first();return present(changed);}catch(error){await env.DB.prepare("UPDATE ops_secret_vault SET status='failed',verification_json=?,last_verified_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(JSON.stringify({connected:false,error:error.message}),id).run();throw new HttpError(502,error.message);}}
export async function revokeSecret(env,ownerId,id){const row=await env.DB.prepare("UPDATE ops_secret_vault SET status='revoked',secret_ciphertext='',secret_iv='',verification_json=NULL,revoked_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND owner_id=? AND status!='revoked' RETURNING *").bind(id,ownerId).first();if(!row)throw new HttpError(404,'Aktívne tajomstvo neexistuje.');await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('secret_revoked',?)").bind(JSON.stringify({id,provider:row.provider,name:row.name,owner_id:ownerId})).run();return present(row);}
