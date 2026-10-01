import {z} from 'zod';
import {callModel} from './services.js';
import {HttpError} from './security.js';

const createSchema=z.object({name:z.string().trim().min(1).max(80).optional(),prompt:z.string().trim().min(8).max(8000)}).strict();
const reviseSchema=z.object({prompt:z.string().trim().min(3).max(8000)}).strict();
const CSP='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: https:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; font-src data:; media-src data:; connect-src \'none\'; form-action \'none\'; base-uri \'none\'">';
function extractHtml(text){
  let html=String(text||'').trim().replace(/^\`\`\`(?:html)?\s*/i,'').replace(/\s*\`\`\`$/,'');
  const start=html.search(/<!doctype html>|<html[\s>]/i),end=html.toLowerCase().lastIndexOf('</html>');
  if(start<0||end<0)throw new Error('Generátor nevrátil úplnú HTML stránku.');html=html.slice(start,end+7);
  if(Buffer.byteLength(html)>180000)throw new Error('Vygenerovaná stránka je príliš veľká.');
  if(!/content-security-policy/i.test(html))html=html.replace(/<head([^>]*)>/i,'<head$1>'+CSP);
  return html;
}
function nameFromPrompt(prompt){return prompt.replace(/^(vytvor|sprav|create|build)\s+(mi\s+)?/i,'').split(/[.!?\n]/)[0].trim().slice(0,60)||'Nový web';}
async function generate(env,prompt,current=''){
  const system='Si Trinity Web Studio. Vráť iba jeden kompletný dokument <!doctype html>...</html>, bez markdownu a bez vysvetlenia. Vytvor profesionálny responzívny web so slovenským textom, prístupnou typografiou a výrazným vizuálnym smerom. CSS a voliteľný JavaScript musia byť inline. Nepoužívaj externé knižnice, iframe, formuláre odosielajúce dáta, fetch, externé skripty ani tajomstvá.';
  const user=current?('Uprav tento existujúci web podľa pokynu. Zachovaj funkčné časti.\nPOKYN: '+prompt+'\nAKTUÁLNY HTML:\n'+current.slice(0,90000)):prompt;
  const messages=[{role:'system',content:system},{role:'user',content:user}],providers=env.OLLAMA_SECRET?['ollama','workers-ai']:['workers-ai'];
  let lastError;
  for(const provider of providers){
    if(provider==='workers-ai'&&!env.AI)continue;
    try{const response=await callModel(env,provider,messages,6000);return {html:extractHtml(response.text),model:response.model};}
    catch(error){lastError=error;}
  }
  throw new HttpError(502,'Trinity nedokázala vytvoriť platný náhľad. Skús pokyn spresniť.');
}
const rowOut=row=>({...row,version:Number(row.version)});
export async function listStudioProjects(env,owner){return (await env.DB.prepare('SELECT id,name,status,version,substr(prompt,1,300) AS prompt,created_at,updated_at FROM ops_studio_projects WHERE owner_id=? ORDER BY updated_at DESC LIMIT 40').bind(owner).all()).results.map(rowOut);}
export async function getStudioProject(env,owner,id){
  const row=await env.DB.prepare('SELECT * FROM ops_studio_projects WHERE id=? AND owner_id=?').bind(id,owner).first();if(!row)throw new HttpError(404,'Studio projekt neexistuje.');
  const object=await env.ARTIFACTS.get(row.html_key);if(!object)throw new HttpError(404,'Náhľad projektu chýba.');
  const versions=(await env.DB.prepare('SELECT version,prompt,model,created_at FROM ops_studio_versions WHERE project_id=? ORDER BY version DESC LIMIT 20').bind(id).all()).results;
  return {...rowOut(row),html:await object.text(),versions};
}
export async function createStudioProject(env,owner,input){
  const data=createSchema.parse(input),id=crypto.randomUUID(),built=await generate(env,data.prompt),name=data.name||nameFromPrompt(data.prompt),key='studio/'+id+'/v1.html';
  await env.ARTIFACTS.put(key,built.html,{httpMetadata:{contentType:'text/html; charset=utf-8'}});
  await env.DB.batch([
    env.DB.prepare("INSERT INTO ops_studio_projects(id,owner_id,name,prompt,status,version,html_key) VALUES(?,?,?,?, 'ready',1,?)").bind(id,owner,name,data.prompt,key),
    env.DB.prepare('INSERT INTO ops_studio_versions(project_id,version,prompt,html_key,model) VALUES(?,?,?,?,?)').bind(id,1,data.prompt,key,built.model),
    env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('studio_created',?)").bind(JSON.stringify({id,name,model:built.model}))
  ]);
  return getStudioProject(env,owner,id);
}
export async function reviseStudioProject(env,owner,id,input){
  const data=reviseSchema.parse(input),current=await getStudioProject(env,owner,id),built=await generate(env,data.prompt,current.html),version=current.version+1,key='studio/'+id+'/v'+version+'.html';
  await env.ARTIFACTS.put(key,built.html,{httpMetadata:{contentType:'text/html; charset=utf-8'}});
  await env.DB.batch([
    env.DB.prepare("UPDATE ops_studio_projects SET prompt=?,version=?,html_key=?,status='ready',updated_at=datetime('now') WHERE id=? AND owner_id=?").bind(data.prompt,version,key,id,owner),
    env.DB.prepare('INSERT INTO ops_studio_versions(project_id,version,prompt,html_key,model) VALUES(?,?,?,?,?)').bind(id,version,data.prompt,key,built.model),
    env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('studio_revised',?)").bind(JSON.stringify({id,version,model:built.model}))
  ]);
  return getStudioProject(env,owner,id);
}
