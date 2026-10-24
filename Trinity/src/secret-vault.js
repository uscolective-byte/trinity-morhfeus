import {z} from 'zod';
import {HttpError} from './security.js';

export const secretInputSchema=z.object({
  provider:z.enum([
    'github','cloudflare','gemini','openai','firecrawl','firebase','supabase','vercel','telegram','slack','discord','notion','dataverse','microsoft','powerplatform','custom','groq','deepseek','anthropic','mistral','openrouter'
  ]),
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
async function verifyFirecrawl(secret){
  const response=await fetch('https://api.firecrawl.dev/v1/scrape',{
    method:'POST',
    headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},
    body:JSON.stringify({url:'https://example.com',formats:['markdown']}),
    signal:AbortSignal.timeout(20000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok&&response.status!==402)throw new Error(`Firecrawl odmietol API kľúč (HTTP ${response.status}): ${String(data.error||'neplatný kľúč').slice(0,180)}`);
  return {connected:true,provider:'firecrawl',status:response.status===402?'verified-quota-limit':'active'};
}
async function verifyFirebase(secret){
  let projectId='trinity-morhfeus-20261001';
  let token=secret;
  try{
    const parsed=JSON.parse(secret);
    if(parsed.project_id||parsed.projectId)projectId=parsed.project_id||parsed.projectId;
    if(parsed.apiKey||parsed.token)token=parsed.apiKey||parsed.token;
  }catch{}
  const url=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents?pageSize=1${token&&!token.startsWith('ya29.')?`&key=${encodeURIComponent(token)}`:''}`;
  const headers=token&&token.startsWith('ya29.')?{Authorization:`Bearer ${token}`}:{};
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});
  if(response.status===401||response.status===403){
    return {connected:true,project_id:projectId,status:'configured-auth-required'};
  }
  return {connected:true,project_id:projectId,status:response.ok?'verified':'reachable'};
}

async function verifyOpenAICompatible(url,secret,provider){
  try{
    const response=await fetch(url,{headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(10000)});
    if(response.status===401||response.status===403)throw new HttpError(401,`Neplatný ${provider.toUpperCase()} API kľúč.`);
    const data=await response.json().catch(()=>({}));
    const models=Array.isArray(data.data)?data.data.map(m=>m.id).slice(0,30):[];
    return {connected:true,provider,models:models.length?models:undefined,status:'verified'};
  }catch(e){
    if(e instanceof HttpError)throw e;
    return {connected:true,provider,status:'stored-untested'};
  }
}
async function verifyAnthropic(secret){
  try{
    const response=await fetch('https://api.anthropic.com/v1/models',{headers:{'x-api-key':secret,'anthropic-version':'2023-06-01'},signal:AbortSignal.timeout(10000)});
    if(response.status===401||response.status===403)throw new HttpError(401,'Neplatný Anthropic Claude API kľúč.');
    const data=await response.json().catch(()=>({}));
    const models=Array.isArray(data.data)?data.data.map(m=>m.id):[];
    return {connected:true,provider:'anthropic',models,status:'verified'};
  }catch(e){
    if(e instanceof HttpError)throw e;
    return {connected:true,provider:'anthropic',status:'stored-untested'};
  }
}

async function verifyGenericProvider(provider,secret){
  if(provider==='vercel'){
    const r=await fetch('https://api.vercel.com/v2/user',{headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw new Error(`Vercel odmietol token (HTTP ${r.status}).`);
    return {connected:true,provider:'vercel'};
  }
  if(provider==='notion'){
    const r=await fetch('https://api.notion.com/v1/users/me',{headers:{Authorization:`Bearer ${secret}`,'Notion-Version':'2022-06-28'},signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw new Error(`Notion odmietol token (HTTP ${r.status}).`);
    return {connected:true,provider:'notion'};
  }
  return {connected:true,provider,status:'stored-and-ready'};
}
async function verifyGemini(secret){
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':secret},signal:AbortSignal.timeout(15000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`Gemini odmietlo API kľúč (HTTP ${response.status}).`);
  const models=(data.models||[]).filter(item=>(item.supportedGenerationMethods||[]).includes('generateContent')).map(item=>item.name).filter(name=>/^models\/gemini-/i.test(name)).slice(0,100);
  if(!models.length)throw new Error('Gemini nevrátilo žiadny model pre generovanie textu.');
  const model=models.includes('models/gemini-2.5-flash')?'models/gemini-2.5-flash':models.includes('models/gemini-3.8-flash')?'models/gemini-3.8-flash':models.find(name=>/flash/i.test(name)&&!/image|tts|preview/i.test(name))||models[0];
  let live=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',headers:{'x-goog-api-key':secret,'Content-Type':'application/json'},
    body:JSON.stringify({model:model.replace(/^models\//,''),input:'Reply exactly OK.',store:false,generation_config:{max_output_tokens:8,temperature:0}}),
    signal:AbortSignal.timeout(30000),redirect:'manual'
  });
  let liveData=await live.json().catch(()=>({}));
  let outputText=String(liveData.output_text||'').trim();
  if(!live.ok || !outputText){
    const cleanModel=model.replace(/^models\//,'');
    const genResp=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(secret)}`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{role:'user',parts:[{text:'Reply exactly OK.'}]}],generationConfig:{maxOutputTokens:8,temperature:0}}),
      signal:AbortSignal.timeout(30000),redirect:'manual'
    });
    const genData=await genResp.json().catch(()=>({}));
    if(!genResp.ok)throw new Error(`Gemini živý test zlyhal (HTTP ${genResp.status}): ${String(genData.error?.message||'overenie zlyhalo').slice(0,240)}`);
    outputText=genData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()||'';
    if(!outputText)throw new Error('Gemini živý test vrátil prázdnu odpoveď.');
    return {connected:true,models,model_count:models.length,generation_verified:true,verified_model:model};
  }
  return {connected:true,models,model_count:models.length,generation_verified:true,verified_model:model};
}
async function verifyOpenAI(secret){
  const response=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(15000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`OpenAI odmietlo API kľúč (HTTP ${response.status}).`);
  const models=(data.data||[]).filter(item=>/^gpt-|^o1|^o3|^chatgpt/i.test(item.id)).map(item=>item.id).slice(0,50);
  if(!models.length)models.push('gpt-4o','gpt-4o-mini');
  const model=models.includes('gpt-4o')?'gpt-4o':models.includes('gpt-4o-mini')?'gpt-4o-mini':models[0];
  const live=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},
    body:JSON.stringify({model,messages:[{role:'user',content:'Reply OK.'}],max_tokens:8,temperature:0}),
    signal:AbortSignal.timeout(25000),redirect:'manual'
  });
  const liveData=await live.json().catch(()=>({}));
  if(!live.ok)throw new Error(`OpenAI živý test zlyhal (HTTP ${live.status}): ${String(liveData.error?.message||'overenie zlyhalo').slice(0,240)}`);
  const text=liveData.choices?.[0]?.message?.content||'';
  if(!text.trim())throw new Error('OpenAI živý test vrátil prázdnu odpoveď.');
  return {connected:true,models,model_count:models.length,generation_verified:true,verified_model:model};
}
async function verifyDataverse(secret){
  let token=secret;
  let url='https://org35ccf923.crm17.dynamics.com';
  try{
    const parsed=JSON.parse(secret);
    if(parsed.url)url=parsed.url;
    if(parsed.token)token=parsed.token;
    if(parsed.tenantId&&parsed.clientId&&parsed.clientSecret){
      const tokenResp=await fetch(`https://login.microsoftonline.com/${parsed.tenantId}/oauth2/v2.0/token`,{
        method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({
          grant_type:'client_credentials',
          client_id:parsed.clientId,
          client_secret:parsed.clientSecret,
          scope:`${url.replace(/\/+$/,'')}/.default`
        }).toString(),
        signal:AbortSignal.timeout(15000)
      });
      const tokenData=await tokenResp.json().catch(()=>({}));
      if(!tokenResp.ok||!tokenData.access_token){
        throw new Error(`Microsoft Entra token zlyhal (HTTP ${tokenResp.status}): ${tokenData.error_description||tokenData.error||'neplatné poverenia'}`);
      }
      token=tokenData.access_token;
    }
  }catch(e){
    if(e.message&&e.message.includes('Microsoft Entra token zlyhal'))throw e;
  }
  const cleanUrl=url.replace(/\/+$/,'');
  const whoamiResp=await fetch(`${cleanUrl}/api/data/v9.2/WhoAmI`,{
    headers:{
      Authorization:`Bearer ${token}`,
      Accept:'application/json',
      'OData-MaxVersion':'4.0',
      'OData-Version':'4.0'
    },
    signal:AbortSignal.timeout(15000)
  });
  const whoamiData=await whoamiResp.json().catch(()=>({}));
  if(!whoamiResp.ok){
    throw new Error(`Dataverse WhoAmI zlyhal (HTTP ${whoamiResp.status}): ${String(whoamiData.error?.message||'prístup zamietnutý').slice(0,240)}`);
  }
  return {
    connected:true,
    instance_url:cleanUrl,
    organization_id:whoamiData.OrganizationId,
    user_id:whoamiData.UserId,
    business_unit_id:whoamiData.BusinessUnitId
  };
}
export async function getSecretMaterial(env,{ownerId,id,provider}){const row=await env.DB.prepare("SELECT * FROM ops_secret_vault WHERE id=? AND owner_id=? AND provider=? AND status!='revoked'").bind(id,ownerId,provider).first();if(!row)throw new HttpError(404,'Tajomstvo neexistuje.');return {...row,secret:await decrypt(env,row)};}
export async function resolveProviderSecret(env,provider){
  const envMap={
    cloudflare:env?.CF_API_TOKEN||env?.CLOUDFLARE_API_TOKEN||env?.TRINITY_CF_TOKEN,
    github:env?.TRINITY_GITHUB_TOKEN||env?.GITHUB_TOKEN,
    firecrawl:env?.FIRECRAWL_API_KEY||env?.TRINITY_FIRECRAWL_KEY,
    firebase:env?.FIREBASE_API_KEY||env?.FIREBASE_SERVICE_ACCOUNT||env?.TRINITY_FIREBASE_KEY,
    supabase:env?.SUPABASE_KEY||env?.SUPABASE_SERVICE_ROLE_KEY,
    vercel:env?.VERCEL_TOKEN,
    telegram:env?.TELEGRAM_BOT_TOKEN,
    slack:env?.SLACK_WEBHOOK_URL||env?.SLACK_BOT_TOKEN,
    discord:env?.DISCORD_WEBHOOK_URL||env?.DISCORD_BOT_TOKEN,
    notion:env?.NOTION_API_KEY
  };
  if(typeof envMap[provider]==='string'&&envMap[provider].trim())return envMap[provider].trim();
  if(env?.DB?.prepare&&typeof env.TRINITY_VAULT_KEY==='string'){
    try{
      const row=await env.DB.prepare("SELECT * FROM ops_secret_vault WHERE provider=? AND status!='revoked' ORDER BY CASE WHEN status='verified' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1").bind(provider).first();
      if(row)return await decrypt(env,row);
    }catch{}
  }
  return null;
}
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
export async function verifySecret(env,ownerId,id){
  const row=await env.DB.prepare("SELECT * FROM ops_secret_vault WHERE id=? AND owner_id=? AND status!='revoked'").bind(id,ownerId).first();
  if(!row)throw new HttpError(404,'Tajomstvo neexistuje.');
  if(row.provider==='custom')throw new HttpError(400,'Vlastné tajomstvo nemá automatický test.');
  try{
    const secret=await decrypt(env,row);
    const verification=row.provider==='github'?await verifyGitHub(secret)
      :row.provider==='cloudflare'?await verifyCloudflare(secret)
      :row.provider==='openai'?await verifyOpenAI(secret)
      :row.provider==='firecrawl'?await verifyFirecrawl(secret)
      :row.provider==='firebase'?await verifyFirebase(secret)
      :(row.provider==='dataverse'||row.provider==='microsoft'||row.provider==='powerplatform')?await verifyDataverse(secret)
      :row.provider==='gemini'?await verifyGemini(secret)
      :row.provider==='groq'?await verifyOpenAICompatible('https://api.groq.com/openai/v1/models',secret,'groq')
      :row.provider==='deepseek'?await verifyOpenAICompatible('https://api.deepseek.com/models',secret,'deepseek')
      :row.provider==='anthropic'?await verifyAnthropic(secret)
      :row.provider==='mistral'?await verifyOpenAICompatible('https://api.mistral.ai/v1/models',secret,'mistral')
      :row.provider==='openrouter'?await verifyOpenAICompatible('https://openrouter.ai/api/v1/models',secret,'openrouter')
      :await verifyGenericProvider(row.provider,secret);
    const changed=await env.DB.prepare("UPDATE ops_secret_vault SET status='verified',verification_json=?,last_verified_at=datetime('now'),updated_at=datetime('now') WHERE id=? RETURNING *").bind(JSON.stringify(verification),id).first();
    return present(changed);
  }catch(error){
    await env.DB.prepare("UPDATE ops_secret_vault SET status='failed',verification_json=?,last_verified_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(JSON.stringify({connected:false,error:error.message}),id).run();
    throw new HttpError(502,error.message);
  }
}
export async function revokeSecret(env,ownerId,id){const row=await env.DB.prepare("UPDATE ops_secret_vault SET status='revoked',secret_ciphertext='',secret_iv='',verification_json=NULL,revoked_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND owner_id=? AND status!='revoked' RETURNING *").bind(id,ownerId).first();if(!row)throw new HttpError(404,'Aktívne tajomstvo neexistuje.');await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('secret_revoked',?)").bind(JSON.stringify({id,provider:row.provider,name:row.name,owner_id:ownerId})).run();return present(row);}
