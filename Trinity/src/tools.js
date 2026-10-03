import {z} from 'zod';
import {boundedText,getOllamaKey,serviceStatus,SERVICES} from './services.js';
import {ensureToolEnabled,pluginEnabled,listPlugins,installPlugin} from './plugins.js';
import {SKILLS} from './registry.js';
import {createSystemAction,getSystemAction,actionEvidence} from './system-actions.js';
const INTERNAL_TOOLS=new Set(['request_system_action','system_action_status']);
export const TOOL_SCHEMAS={
  search_memory:z.object({query:z.string().max(200).default('')}).strict(),
  project_snapshot:z.object({}).strict(),
  service_status:z.object({binding:z.enum(Object.keys(SERVICES)).optional()}).strict(),
  web_search:z.object({query:z.string().min(3).max(500)}).strict()
  ,generate_image:z.object({prompt:z.string().min(3).max(2048),seed:z.number().int().min(1).max(9999999999).optional()}).strict()
  ,calculate:z.object({operation:z.enum(['add','subtract','multiply','divide','percentage','mean','power','sqrt','log10','sin','cos','tan']),values:z.array(z.number().finite()).min(1).max(100)}).strict()
  ,analyze_text:z.object({text:z.string().max(20000)}).strict()
  ,current_time:z.object({timezone:z.string().min(1).max(80).default('Europe/Bratislava')}).strict()
  ,list_capabilities:z.object({query:z.string().max(80).default('')}).strict()
  ,list_skills:z.object({query:z.string().max(80).default('')}).strict()
  ,list_connectors:z.object({}).strict()
  ,install_plugin:z.object({id:z.string().regex(/^[a-z-]{1,40}$/),reason:z.string().min(3).max(300)}).strict()
  ,request_system_action:z.object({action:z.enum(['read','write','edit','selfwrite','run','deploy','share','upload','upgrade']),payload:z.record(z.string(),z.unknown()).default({}),rationale:z.string().min(3).max(1000)}).strict()
  ,system_action_status:z.object({id:z.string().uuid()}).strict()
};
export async function searchMemory(env,query='') {
  const pattern=`%${query.replace(/[!%_]/g,'!$&')}%`;
  const own=await env.DB.prepare("SELECT key,substr(value,1,2500) AS value,source FROM ops_memory WHERE key LIKE ? ESCAPE '!' OR value LIKE ? ESCAPE '!' ORDER BY updated_at DESC LIMIT 8").bind(pattern,pattern).all();
  const older=await env.DB.prepare("SELECT key,substr(value,1,2000) AS value,category AS source FROM memory_long WHERE key LIKE ? ESCAPE '!' OR value LIKE ? ESCAPE '!' ORDER BY importance DESC LIMIT 5").bind(pattern,pattern).all();
  return {records:[...own.results,...older.results],scope:'ops_memory + existujúca memory_long'};
}
export async function runTool(env, agent, name, input) {
  if(!agent.tools.includes(name)||!TOOL_SCHEMAS[name]) throw new Error('Tool not allowed');
  if(!INTERNAL_TOOLS.has(name)&&name!=='install_plugin')await ensureToolEnabled(env,name);
  if(name==='request_system_action'&&input&&typeof input==='object')input={action:input.action,payload:input.payload||(typeof input.resource==='string'?{path:input.resource}:{}),rationale:input.rationale||input.reason};
  const args=TOOL_SCHEMAS[name].parse(input);
  if(name==='request_system_action'){
    const action=await createSystemAction(env,args,`agent:${agent.id||'trinity'}`);
    return {id:action.id,action:action.action,status:action.status,approval_required:action.status==='proposed',expires_at:action.expires_at,note:action.status==='proposed'?`Čaká na samostatné schválenie používateľa príkazom SCHVÁĽ ${action.id}.`:'Bezpečné čítanie čaká na lokálnu bránu.',_evidence:{effect:'proposal'}};
  }
  if(name==='system_action_status'){
    const action=await getSystemAction(env,args.id);if(!action)throw new Error('Systémová akcia neexistuje.');
    return {id:action.id,action:action.action,status:action.status,receipt:action.receipt,error:action.error,_evidence:action.status==='completed'?{effect:'mutation',actions:actionEvidence(action.action),receipt_id:action.id}:null};
  }
  if(name==='calculate'){
    const v=args.values;let result;
    if(args.operation==='add')result=v.reduce((a,b)=>a+b,0);
    if(args.operation==='subtract')result=v.slice(1).reduce((a,b)=>a-b,v[0]);
    if(args.operation==='multiply')result=v.reduce((a,b)=>a*b,1);
    if(args.operation==='divide'){if(v.slice(1).includes(0))throw new Error('Delenie nulou nie je povolené.');result=v.slice(1).reduce((a,b)=>a/b,v[0]);}
    if(args.operation==='percentage'){if(v.length!==2)throw new Error('Percentá vyžadujú [percento,základ].');result=v[0]*v[1]/100;}
    if(args.operation==='mean')result=v.reduce((a,b)=>a+b,0)/v.length;
    if(args.operation==='power'){if(v.length!==2)throw new Error('Mocnina vyžaduje [základ,exponent].');result=Math.pow(v[0],v[1]);}
    if(args.operation==='sqrt'){if(v.length!==1||v[0]<0)throw new Error('Odmocnina vyžaduje jedno nezáporné číslo.');result=Math.sqrt(v[0]);}
    if(args.operation==='log10'){if(v.length!==1||v[0]<=0)throw new Error('Logaritmus vyžaduje jedno kladné číslo.');result=Math.log10(v[0]);}
    if(args.operation==='sin')result=Math.sin(v[0]);
    if(args.operation==='cos')result=Math.cos(v[0]);
    if(args.operation==='tan')result=Math.tan(v[0]);
    if(!Number.isFinite(result))throw new Error('Výsledok je mimo číselného rozsahu.');return {operation:args.operation,result};
  }
  if(name==='generate_image'){
    if(!env.AI||!env.ARTIFACTS)throw new Error('Generovanie obrázkov nie je nakonfigurované.');
    const model=env.IMAGE_MODEL||'@cf/black-forest-labs/flux-1-schnell';
    const imageInput={prompt:args.prompt};if(args.seed!==undefined)imageInput.seed=args.seed;
    const generated=await env.AI.run(model,imageInput);
    let bytes;
    if(typeof generated?.image==='string')bytes=Uint8Array.from(Buffer.from(generated.image,'base64'));
    else if(generated instanceof Uint8Array)bytes=generated;
    else if(generated instanceof ArrayBuffer)bytes=new Uint8Array(generated);
    else throw new Error('Model obrázka vrátil neznámy formát.');
    if(!bytes.length||bytes.length>12_000_000)throw new Error('Obrázok má neplatnú veľkosť.');
    const id=crypto.randomUUID(),key=`media/images/${id}.jpg`;
    await env.ARTIFACTS.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'},customMetadata:{model,prompt:args.prompt.slice(0,500)}});
    return {id,type:'image',model,url:`/api/assistant/media/images/${id}`,prompt:args.prompt,_evidence:{effect:'create',actions:['generate_image'],receipt_id:id}};
  }
  if(name==='analyze_text'){const words=args.text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)||[];return {characters:[...args.text].length,words:words.length,sentences:args.text.trim()?args.text.split(/[.!?]+/).filter(x=>x.trim()).length:0,reading_minutes:Math.ceil(words.length/200)};}
  if(name==='current_time'){
    let localized;try{localized=new Intl.DateTimeFormat('sk-SK',{dateStyle:'full',timeStyle:'long',timeZone:args.timezone}).format(new Date());}catch{throw new Error('Neplatné časové pásmo. Použi názov napríklad Europe/Bratislava.');}
    return {timezone:args.timezone,localized,utc:new Date().toISOString()};
  }
  if(name==='list_capabilities'){
    const query=args.query.toLocaleLowerCase('sk');const plugins=await listPlugins(env);
    return {identity:'Trinity',plugins:plugins.filter(p=>!query||`${p.name} ${p.description} ${p.tools.join(' ')}`.toLocaleLowerCase('sk').includes(query)).map(({id,name,description,tools,version,installed,enabled})=>({id,name,description,tools,version,installed,enabled}))};
  }
  if(name==='list_skills'){
    const query=args.query.toLocaleLowerCase('sk');
    return {skills:SKILLS.filter(skill=>!query||`${skill.name} ${skill.description} ${skill.clusters.join(' ')}`.toLocaleLowerCase('sk').includes(query))};
  }
  if(name==='list_connectors'){
    return {connectors:await serviceStatus(env),note:'Stav bindingu neodhaľuje prihlasovacie údaje ani nepotvrdzuje vykonanie úlohy.'};
  }
  if(name==='install_plugin'){
    const plugin=await installPlugin(env,args.id);
    return {...plugin,reason:args.reason,note:'Nainštalovaný je iba dôveryhodný modul dodaný v jadre Trinity; externý kód sa nesťahuje ani nespúšťa.'};
  }
  if(name==='search_memory') return searchMemory(env,args.query);
  if(name==='service_status') return serviceStatus(env,args.binding);
  if(name==='project_snapshot') {
    const [projects,tasks]=await Promise.all([
      env.DB.prepare('SELECT id,name,description,status FROM projects ORDER BY updated_at DESC LIMIT 15').all(),
      env.DB.prepare('SELECT id,title,status,assigned_agent FROM tasks ORDER BY updated_at DESC LIMIT 20').all()
    ]);return {projects:projects.results,tasks:tasks.results};
  }
  if(name==='web_search') {
    const key=await getOllamaKey(env);
    const r=await fetch('https://ollama.com/api/web_search',{method:'POST',
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({query:args.query,max_results:3}),signal:AbortSignal.timeout(20000),redirect:'manual'});
    if(!r.ok)throw new Error(`Web search HTTP ${r.status}`);
    const data=JSON.parse(await boundedText(r,80000));
    return {results:(data.results||[]).map(r=>({title:r.title,url:r.url,content:(r.content||'').slice(0,3500)}))};
  }
}
export async function recallMemory(env,task){
  if(!await pluginEnabled(env,'memory'))return [];
  const words=[...new Set(task.match(/[\p{L}\p{N}_-]{5,}/gu)||[])].slice(0,4);
  const pinned=await env.DB.prepare("SELECT key,substr(value,1,1800) AS value,source FROM ops_memory WHERE key LIKE 'profil/%' ORDER BY updated_at DESC LIMIT 5").all();
  const records=new Map(pinned.results.map(r=>[r.key,r]));
  for(const word of words){for(const r of (await searchMemory(env,word)).records){if(records.size<8)records.set(r.key,r);}}
  return [...records.values()];
}
export const TOOL_HELP={search_memory:'Vyhľadá pamäť: {query:string}',project_snapshot:'Prečíta projekty a úlohy: {}',
  service_status:'Overí služby: {binding?: názov služby}',web_search:'Vyhľadá aktuálne webové zdroje: {query:string}',generate_image:'Skutočne vytvorí obrázok a uloží ho do súkromného archívu: {prompt:string,seed?:integer}',calculate:'Presný výpočet {operation:add|subtract|multiply|divide|percentage|mean|power|sqrt|log10|sin|cos|tan,values:number[]}; trigonometria používa radiány',analyze_text:'Počet slov a znakov: {text:string}',current_time:'Skutočný čas a dátum: {timezone?: IANA názov}',list_capabilities:'Zoznam nainštalovaných verejných modulov Trinity: {query?: string}',list_skills:'Zoznam zabudovaných pracovných zručností Trinity: {query?: string}',list_connectors:'Skutočný stav nakonfigurovaných konektorov; nikdy nevracia tajomstvá: {}',install_plugin:'Nainštaluje alebo obnoví iba plugin z dôveryhodného katalógu Trinity: {id,reason}',request_system_action:'Vytvorí iba návrh internej akcie; zmeny čakajú na výslovné schválenie. Desktop používa action run a payload {task:"desktop-control",operation:"list|launch|focus|type",app?:"notepad|calculator|paint|explorer",text?:string}: {action, payload, rationale}',system_action_status:'Overí stav a potvrdenie internej akcie: {id}'};
