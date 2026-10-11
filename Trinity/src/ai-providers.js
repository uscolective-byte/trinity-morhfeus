import {z} from 'zod';
import {HttpError} from './security.js';
import {getSecretMaterial,listSecrets} from './secret-vault.js';

export const aiProviderInputSchema=z.object({
  secret_id:z.string().uuid(),
  model:z.string().trim().regex(/^models\/gemini-[a-z0-9._-]+$/i).max(160),
  enabled:z.boolean().default(true),
  project_control:z.boolean().default(false)
}).strict();

const decodeVerification=value=>{try{return value?JSON.parse(value):null;}catch{return null;}};
const safeError=value=>String(value||'Neznáma chyba').replace(/([?&](?:key|api_key)=)[^&\s]+/gi,'$1[redacted]').replace(/(x-goog-api-key\s*[:=]\s*)\S+/gi,'$1[redacted]').slice(0,500);
export const GEMINI_OPERATOR_ACTIONS=['read','write','edit','selfwrite','run','deploy','share','upload','upgrade','screenshot','open_app','notify','system_info','scrape','web_fetch','download','git_commit','git_pr'];
export const GEMINI_OPERATOR_POLICY={mode:'authenticated-admin-direct',approval_required:false,direct_pc_execution:true,workflow:['authenticated-request','bounded-action','pc-gateway','verified-receipt']};
const decodeChecks=rows=>{
  const checks=new Map();
  for(const row of rows){const item=decodeVerification(row.details);if(!item?.provider||checks.has(item.provider))continue;checks.set(item.provider,{status:item.status==='verified'?'verified':'failed',model:item.model||null,latency_ms:Number(item.latency_ms)||null,error:item.error||null,checked_at:row.created_at});}
  return checks;
};

export async function recordAIProviderCheck(env,ownerId,input){
  const check={owner_id:ownerId,provider:input.provider,status:input.status==='verified'?'verified':'failed',model:input.model||null,latency_ms:Math.max(0,Math.round(Number(input.latency_ms)||0)),error:input.error?safeError(input.error):null};
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('ai_provider_test',?)").bind(JSON.stringify(check)).run();
  return check;
}

export async function listAIProviders(env,ownerId){
  const [settings,secrets,eventRows]=await Promise.all([
    env.DB.prepare('SELECT provider,secret_id,model,enabled,project_control,updated_at FROM ops_ai_provider_settings WHERE owner_id=?').bind(ownerId).all(),
    listSecrets(env,ownerId),
    env.DB.prepare("SELECT details,created_at FROM ops_events WHERE action='ai_provider_test' ORDER BY rowid DESC LIMIT 100").all()
  ]);
  const checks=decodeChecks(eventRows.results.filter(row=>decodeVerification(row.details)?.owner_id===ownerId));
  const geminiSetting=settings.results.find(item=>item.provider==='gemini')||null;
  const geminiSecrets=secrets.filter(item=>item.provider==='gemini');
  const environmentGemini=typeof env.GEMINI_API_KEY==='string'&&env.GEMINI_API_KEY.length>=8;
  return {items:[
    {id:'workers-ai',name:'Cloudflare Workers AI',configured:!!env.AI,enabled:true,model:env.AI_MODEL||'@cf/openai/gpt-oss-120b',managed_by:'cloudflare',last_check:checks.get('workers-ai')||null},
    {id:'openai',name:'OpenAI / ChatGPT API',configured:typeof env.OPENAI_API_KEY==='string'&&env.OPENAI_API_KEY.length>=20,enabled:typeof env.OPENAI_API_KEY==='string'&&env.OPENAI_API_KEY.length>=20,model:env.OPENAI_MODEL||'gpt-5.6-luna',managed_by:'worker-secret',secret_source:'worker-secret',last_check:checks.get('openai')||null},
    {id:'gemini',name:'Google Gemini',configured:!!geminiSetting||environmentGemini,enabled:geminiSetting?geminiSetting.enabled===1:environmentGemini,project_control:geminiSetting?.project_control===1,approval_policy:'authenticated-admin-request',operator_policy:GEMINI_OPERATOR_POLICY,allowed_actions:GEMINI_OPERATOR_ACTIONS,model:geminiSetting?.model||env.GEMINI_MODEL||null,secret_id:geminiSetting?.secret_id||null,secret_source:geminiSetting?'encrypted-vault':environmentGemini?'worker-secret':null,credentials:geminiSecrets,updated_at:geminiSetting?.updated_at||null,last_check:checks.get('gemini')||null}
  ]};
}

export async function configureAIProvider(env,ownerId,provider,input){
  if(provider!=='gemini')throw new HttpError(404,'Neznámy AI poskytovateľ.');
  const data=aiProviderInputSchema.parse(input);
  const material=await getSecretMaterial(env,{ownerId,id:data.secret_id,provider});
  if(material.status!=='verified')throw new HttpError(409,'Najprv API kľúč úspešne over.');
  const verification=decodeVerification(material.verification_json);
  const allowed=verification?.models||[];
  if(allowed.length&&!allowed.includes(data.model))throw new HttpError(400,'Vybraný model nebol nájdený pri overení Gemini kľúča.');
  const row=await env.DB.prepare(`INSERT INTO ops_ai_provider_settings(owner_id,provider,secret_id,model,enabled,project_control)
    VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id,provider) DO UPDATE SET secret_id=excluded.secret_id,model=excluded.model,
    enabled=excluded.enabled,project_control=excluded.project_control,updated_at=datetime('now') RETURNING provider,secret_id,model,enabled,project_control,updated_at`)
    .bind(ownerId,provider,data.secret_id,data.model,data.enabled?1:0,data.project_control?1:0).first();
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('ai_provider_configured',?)")
    .bind(JSON.stringify({owner_id:ownerId,provider,model:data.model,enabled:data.enabled,project_control:data.project_control,approval_policy:'authenticated-admin-request'})).run();
  return {...row,enabled:row.enabled===1,project_control:row.project_control===1,approval_policy:'authenticated-admin-request'};
}

export async function geminiProjectControlEnabled(env,ownerId){
  const row=await env.DB.prepare("SELECT project_control FROM ops_ai_provider_settings WHERE owner_id=? AND provider='gemini' AND enabled=1").bind(ownerId).first();
  return row?.project_control===1;
}

export async function getConfiguredAIProvider(env,provider){
  const row=await env.DB.prepare(`SELECT s.owner_id,s.provider,s.secret_id,s.model,v.status,v.verification_json
    FROM ops_ai_provider_settings s JOIN ops_secret_vault v ON v.id=s.secret_id AND v.owner_id=s.owner_id
    WHERE s.provider=? AND s.enabled=1 AND v.status='verified' ORDER BY s.updated_at DESC LIMIT 1`).bind(provider).first();
  if(!row&&provider==='gemini'&&typeof env.GEMINI_API_KEY==='string'&&env.GEMINI_API_KEY.length>=8){
    let model=env.GEMINI_MODEL?String(env.GEMINI_MODEL).replace(/^models\//,''):'';
    if(!model&&env.Mastermind)model=await env.Mastermind.get('ai:gemini:default-model')||'';
    if(!model){
      const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':env.GEMINI_API_KEY},signal:AbortSignal.timeout(15000)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new HttpError(502,`Gemini odmietlo nakonfigurovaný Worker Secret (HTTP ${response.status}).`);
      const models=(data.models||[]).filter(item=>(item.supportedGenerationMethods||[]).includes('generateContent')).map(item=>String(item.name||'').replace(/^models\//,''));
      model=models.find(name=>/^gemini-[\d.]+-flash$/i.test(name))||models.find(name=>/gemini-.*flash/i.test(name)&&!/preview|exp/i.test(name))||models[0]||'';
      if(!model)throw new HttpError(502,'Gemini neposkytlo použiteľný textový model.');
      if(env.Mastermind)await env.Mastermind.put('ai:gemini:default-model',model,{expirationTtl:21600});
    }
    return {apiKey:env.GEMINI_API_KEY,model:`models/${model}`};
  }
  if(!row)throw new HttpError(503,`${provider==='gemini'?'Gemini':'AI poskytovateľ'} nie je nakonfigurovaný a overený.`);
  const material=await getSecretMaterial(env,{ownerId:row.owner_id,id:row.secret_id,provider});
  return {apiKey:material.secret,model:row.model};
}
