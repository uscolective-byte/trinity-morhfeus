import {z} from 'zod';
import {HttpError} from './security.js';
import {boundedText} from './services.js';
import {getStudioProject} from './studio.js';
export const cloudflareToken=env=>env.CLOUDFLARE_API_TOKEN||env.CF_API_TOKEN||env.CLOUDFLARE_TOKEN;
export const cloudflareAccount=env=>env.CF_ACCOUNT_ID||env.CLOUDFLARE_ACCOUNT_ID;
export async function cloudflareRequest(env,path,method='GET',body){
  if(!cloudflareToken(env)||!cloudflareAccount(env))throw new HttpError(503,'Chýba Cloudflare API token alebo account ID vo Worker Secrets.');
  const multipart=body instanceof FormData;
  const r=await fetch('https://api.cloudflare.com/client/v4'+path,{method,headers:{Authorization:`Bearer ${cloudflareToken(env)}`,...(multipart?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:multipart?body:JSON.stringify(body),signal:AbortSignal.timeout(20000),redirect:'error'});
  let data;try{data=JSON.parse(await boundedText(r,1000000));}catch{throw new HttpError(502,'Cloudflare nevrátil platnú API odpoveď.');}
  if(!r.ok||!data.success)throw new HttpError(502,`Cloudflare API HTTP ${r.status}: ${data.errors?.[0]?.code||'request_failed'}`);
  return data;
}
export function infrastructureStatus(env){
  const cf=Boolean(cloudflareToken(env)&&cloudflareAccount(env));
  return {account_id:cloudflareAccount(env)||null,account_owner:'Cloudflare účet vlastníka Trinity; Trinity vykonáva delegované operácie.',registrar:{configured:cf,requires:['Registrar Write','platobný profil','kontakt registranta','súhlas s registračnými podmienkami'],purchase_policy:'konkrétna doména + potvrdený cenový limit'},hosting:{configured:cf,provider:'Cloudflare Workers',default_visibility:'private',requires:['Workers Scripts Write','R2 + Studio projekt']},evolution:{configured:Boolean(env.TRINITY_GITHUB_TOKEN||env.GITHUB_TOKEN),automatic_proposals:env.TRINITY_AUTO_IMPROVE==='true',flow:'zdroj → vetva → PR → testy → zlúčenie → CI deploy'},web:{cloud_fetch:true,pc_required:false,limits:'čas, veľkosť odpovede a kvóty poskytovateľa'},mcp:{endpoint:'/mcp',source_inspection:true}};
}
export const hostingInput=z.object({project_id:z.string().uuid(),publish:z.boolean().default(false)}).strict();
export async function hostStudioProject(env,input){
  const data=hostingInput.parse(input),project=await getStudioProject(env,'primary',data.project_id);
  // A fresh name avoids replacing any existing service. Private sites use bearer auth,
  // isolated from Trinity sessions; keys never appear in an URL or a receipt.
  const id=crypto.randomUUID(),name='trinity-site-'+id.slice(0,18);
  const key=data.publish?null:env.TRINITY_HOSTING_ACCESS_KEY;
  if(!data.publish&&(!key||key.length<32))throw new HttpError(503,'Pre súkromný hosting nastav Worker Secret TRINITY_HOSTING_ACCESS_KEY (aspoň 32 znakov).');
  const digest=key?Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))).toString('hex'):null;
  const source=`const html=${JSON.stringify(project.html)}; const digest=${JSON.stringify(digest)};
export default {async fetch(request){
if(digest){const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==digest)return new Response('Private Trinity site',{status:401,headers:{'WWW-Authenticate':'Bearer','Cache-Control':'no-store'}});}
return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'}});}};`;
  const multipart=new FormData();
  multipart.set('metadata',new Blob([JSON.stringify({main_module:'site.mjs',compatibility_date:'2026-10-11'})],{type:'application/json'}));
  multipart.set('site.mjs',new Blob([source],{type:'application/javascript+module'}),'site.mjs');
  const base=`/accounts/${cloudflareAccount(env)}/workers`;
  const upload=await cloudflareRequest(env,`${base}/scripts/${name}`,'PUT',multipart);
  await cloudflareRequest(env,`${base}/scripts/${name}/subdomain`,'POST',{enabled:true,previews_enabled:false});
  const subdomain=(await cloudflareRequest(env,`${base}/subdomain`)).result.subdomain;
  const receipt={id,worker:name,project_id:project.id,project_version:project.version,visibility:data.publish?'public':'private',url:`https://${name}.${subdomain}.workers.dev`,deployment_id:upload.result?.deployment_id||upload.result?.id||null,status:'uploaded',authentication:data.publish?'none':'Authorization: Bearer <TRINITY_HOSTING_ACCESS_KEY>',created_at:new Date().toISOString()};
  try {
  const probe=await fetch(receipt.url,{headers:key?{Authorization:`Bearer ${key}`}:{},signal:AbortSignal.timeout(15000),redirect:'error'});
  const page=await boundedText(probe,200000);
  receipt.status=probe.ok&&page===project.html?'verified':'verification_pending';
  if(key&&receipt.status==='verified'){
    const denied=await fetch(receipt.url,{signal:AbortSignal.timeout(10000),redirect:'error'});
    await denied.body?.cancel();
    if(denied.status!==401)throw new HttpError(502,'Súkromný hosting neprešiel kontrolou prístupu.');
  }
  } catch(error) {receipt.status='verification_pending';receipt.verification_error=error.message;}
  await env.DB.prepare("INSERT INTO ops_memory(key,value,source) VALUES(?,?,'hosting')").bind('hosting/'+id,JSON.stringify(receipt)).run();
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('hosting_deployed',?)").bind(JSON.stringify(receipt)).run();
  return receipt;
}
export async function listHostedSites(env){
  const rows=await env.DB.prepare("SELECT value FROM ops_memory WHERE source='hosting' AND key LIKE 'hosting/%' ORDER BY updated_at DESC LIMIT 50").all();
  return rows.results.map(row=>JSON.parse(row.value));
}
