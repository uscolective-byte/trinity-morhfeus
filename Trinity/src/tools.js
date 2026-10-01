import {z} from 'zod';
import {boundedText,getOllamaKey,serviceStatus,SERVICES} from './services.js';
import {ensureToolEnabled,pluginEnabled,listPlugins} from './plugins.js';
export const TOOL_SCHEMAS={
  search_memory:z.object({query:z.string().max(200).default('')}).strict(),
  project_snapshot:z.object({}).strict(),
  service_status:z.object({binding:z.enum(Object.keys(SERVICES)).optional()}).strict(),
  web_search:z.object({query:z.string().min(3).max(500)}).strict()
  ,calculate:z.object({operation:z.enum(['add','subtract','multiply','divide','percentage','mean']),values:z.array(z.number().finite()).min(1).max(100)}).strict()
  ,analyze_text:z.object({text:z.string().max(20000)}).strict()
  ,current_time:z.object({timezone:z.string().min(1).max(80).default('Europe/Bratislava')}).strict()
  ,list_capabilities:z.object({query:z.string().max(80).default('')}).strict()
};
export async function searchMemory(env,query='') {
  const pattern=`%${query.replace(/[!%_]/g,'!$&')}%`;
  const own=await env.DB.prepare("SELECT key,substr(value,1,2500) AS value,source FROM ops_memory WHERE key LIKE ? ESCAPE '!' OR value LIKE ? ESCAPE '!' ORDER BY updated_at DESC LIMIT 8").bind(pattern,pattern).all();
  const older=await env.DB.prepare("SELECT key,substr(value,1,2000) AS value,category AS source FROM memory_long WHERE key LIKE ? ESCAPE '!' OR value LIKE ? ESCAPE '!' ORDER BY importance DESC LIMIT 5").bind(pattern,pattern).all();
  return {records:[...own.results,...older.results],scope:'ops_memory + existujúca memory_long'};
}
export async function runTool(env, agent, name, input) {
  if(!agent.tools.includes(name)||!TOOL_SCHEMAS[name]) throw new Error('Tool not allowed');
  await ensureToolEnabled(env,name);
  const args=TOOL_SCHEMAS[name].parse(input);
  if(name==='calculate'){
    const v=args.values;let result;
    if(args.operation==='add')result=v.reduce((a,b)=>a+b,0);
    if(args.operation==='subtract')result=v.slice(1).reduce((a,b)=>a-b,v[0]);
    if(args.operation==='multiply')result=v.reduce((a,b)=>a*b,1);
    if(args.operation==='divide'){if(v.slice(1).includes(0))throw new Error('Delenie nulou nie je povolené.');result=v.slice(1).reduce((a,b)=>a/b,v[0]);}
    if(args.operation==='percentage'){if(v.length!==2)throw new Error('Percentá vyžadujú [percento,základ].');result=v[0]*v[1]/100;}
    if(args.operation==='mean')result=v.reduce((a,b)=>a+b,0)/v.length;
    if(!Number.isFinite(result))throw new Error('Výsledok je mimo číselného rozsahu.');return {operation:args.operation,result};
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
  service_status:'Overí služby: {binding?: názov služby}',web_search:'Vyhľadá webové zdroje: {query:string}',calculate:'Presný výpočet {operation:add|subtract|multiply|divide|percentage|mean,values:number[]}; percentage je [percento,základ]',analyze_text:'Počet slov a znakov: {text:string}',current_time:'Skutočný čas a dátum: {timezone?: IANA názov}',list_capabilities:'Zoznam nainštalovaných schopností Trinity: {query?: string}'};
