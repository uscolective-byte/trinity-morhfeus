import {z} from 'zod';
import {boundedText,getOllamaKey,serviceStatus,SERVICES} from './services.js';
import {ensureToolEnabled,pluginEnabled,listPlugins,installPlugin} from './plugins.js';
import {AGENTS,SKILLS,selectTeam} from './registry.js';
import {planTask} from './planner.js';
import {createSystemAction,getSystemAction,actionEvidence} from './system-actions.js';
import {getPortfolio} from './trading.js';
export const INTERNAL_TOOLS=new Set(['request_system_action','system_action_status']);
export const PC_TOOLS=new Set(['pc_screenshot','pc_run','pc_file_read','pc_file_write','pc_file_append','pc_file_edit','pc_directory_create','pc_open_app','pc_app_control','pc_notify','pc_system_info','pc_scrape','pc_web_fetch','pc_download','pc_git_commit','pc_git_pr']);
export const TOOL_SCHEMAS={
  search_memory:z.object({query:z.string().max(200).default('')}).strict(),
  project_snapshot:z.object({}).strict(),
  morpheus_core_plan:z.object({task:z.string().trim().min(1).max(12000),mode:z.enum(['single','team']).default('team')}).strict(),
  morpheus_core_status:z.object({}).strict(),
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
  ,request_system_action:z.object({action:z.enum(['read','write','edit','selfwrite','run','deploy','share','upload','upgrade','screenshot','open_app','notify','system_info','scrape','web_fetch','download','git_commit','git_pr']),payload:z.record(z.string(),z.unknown()).default({}),rationale:z.string().min(3).max(1000)}).strict()
  ,system_action_status:z.object({id:z.string().uuid()}).strict()
  ,portfolio_summary:z.object({portfolio_id:z.string().uuid().optional()}).strict()
  ,json_tool:z.object({operation:z.enum(['validate','format','minify','get']),json:z.string().max(20000),path:z.string().max(200).optional()}).strict()
  ,hash_text:z.object({text:z.string().max(100000),algorithm:z.literal('SHA-256').default('SHA-256')}).strict()
  ,convert_units:z.object({value:z.number().finite(),from:z.enum(['mm','cm','m','km','in','ft','yd','mi','mg','g','kg','oz','lb','c','f','k']),to:z.enum(['mm','cm','m','km','in','ft','yd','mi','mg','g','kg','oz','lb','c','f','k'])}).strict()
  ,extract_entities:z.object({text:z.string().max(50000)}).strict()
  ,format_text:z.object({text:z.string().max(20000),mode:z.enum(['lower','upper','title','slug','snake','kebab'])}).strict()
};
const UNIT_GROUPS={length:{mm:.001,cm:.01,m:1,km:1000,in:.0254,ft:.3048,yd:.9144,mi:1609.344},mass:{mg:.000001,g:.001,kg:1,oz:.028349523125,lb:.45359237}};
const unique=list=>[...new Set(list)].slice(0,50);
const formatToken=value=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export async function searchMemory(env,query='') {
  const pattern=`%${query.replace(/[!%_]/g,'!$&')}%`;
  const own=await env.DB.prepare("SELECT key,substr(value,1,2500) AS value,source FROM ops_memory WHERE key LIKE ? ESCAPE '!' OR value LIKE ? ESCAPE '!' ORDER BY updated_at DESC LIMIT 8").bind(pattern,pattern).all();
  const older=await env.DB.prepare("SELECT key,substr(value,1,2000) AS value,category AS source FROM memory_long WHERE key LIKE ? ESCAPE '!' OR value LIKE ? ESCAPE '!' ORDER BY importance DESC LIMIT 5").bind(pattern,pattern).all();
  return {records:[...own.results,...older.results],scope:'ops_memory + existujúca memory_long'};
}
export async function runTool(env, agent, name, input, executionContext={}) {
  if(!agent.tools.includes(name)||(!TOOL_SCHEMAS[name]&&!PC_TOOLS.has(name))) throw new Error('Tool not allowed');
  if(PC_TOOLS.has(name)&&executionContext.adminAuthorized!==true)throw new Error('PC nástroje sú dostupné iba v serverom overenom admin režime.');
  if(!INTERNAL_TOOLS.has(name)&&name!=='install_plugin')await ensureToolEnabled(env,name);
  if(name==='request_system_action'&&input&&typeof input==='object')input={action:input.action,payload:input.payload||(typeof input.resource==='string'?{path:input.resource}:{}),rationale:input.rationale||input.reason};
  const args=TOOL_SCHEMAS[name].parse(input);
  if(name==='json_tool'){
    let value;try{value=JSON.parse(args.json);}catch(error){return {valid:false,error:error.message.slice(0,300)};}
    if(args.operation==='validate')return {valid:true,type:Array.isArray(value)?'array':value===null?'null':typeof value};
    if(args.operation==='get'){
      if(!args.path)throw new Error('Operácia get vyžaduje cestu.');let current=value;
      for(const part of args.path.split('.')){if(['__proto__','prototype','constructor'].includes(part)||current===null||typeof current!=='object'||!Object.prototype.hasOwnProperty.call(current,part))throw new Error('JSON cesta neexistuje.');current=current[part];}
      return {valid:true,path:args.path,value:current};
    }
    const output=JSON.stringify(value,null,args.operation==='format'?2:0);if(output.length>50000)throw new Error('Výsledný JSON je príliš veľký.');return {valid:true,output};
  }
  if(name==='hash_text'){
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(args.text));
    return {algorithm:'SHA-256',hex:[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join(''),bytes:new TextEncoder().encode(args.text).byteLength};
  }
  if(name==='convert_units'){
    if(['c','f','k'].includes(args.from)||['c','f','k'].includes(args.to)){
      if(!['c','f','k'].includes(args.from)||!['c','f','k'].includes(args.to))throw new Error('Nemožno miešať teplotu s iným typom jednotky.');
      const c=args.from==='c'?args.value:args.from==='f'?(args.value-32)*5/9:args.value-273.15;
      const result=args.to==='c'?c:args.to==='f'?c*9/5+32:c+273.15;if(args.to==='k'&&result<0)throw new Error('Teplota nemôže byť nižšia než absolútna nula.');return {value:args.value,from:args.from,to:args.to,result};
    }
    const group=Object.values(UNIT_GROUPS).find(item=>item[args.from]!==undefined&&item[args.to]!==undefined);if(!group)throw new Error('Jednotky patria do rozdielnych kategórií.');return {value:args.value,from:args.from,to:args.to,result:args.value*group[args.from]/group[args.to]};
  }
  if(name==='extract_entities'){
    return {emails:unique(args.text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g)||[]),urls:unique(args.text.match(/https?:\/\/[^\s<>()]+/g)||[]).map(url=>url.replace(/[.,;!?]+$/,'')),dates:unique(args.text.match(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\s?\d{1,2}\.\s?\d{4})\b/g)||[])};
  }
  if(name==='format_text'){
    if(args.mode==='lower')return {mode:args.mode,text:args.text.toLocaleLowerCase('sk')};if(args.mode==='upper')return {mode:args.mode,text:args.text.toLocaleUpperCase('sk')};
    const clean=formatToken(args.text),words=clean.split(/\s+/).filter(Boolean);if(args.mode==='title')return {mode:args.mode,text:words.map(word=>word[0]?.toLocaleUpperCase('sk')+word.slice(1).toLocaleLowerCase('sk')).join(' ')};
    const separator=args.mode==='snake'?'_':'-';return {mode:args.mode,text:words.join(separator).toLocaleLowerCase('sk')};
  }
  if(name==='request_system_action'){
    const adminAuthorized=executionContext.adminAuthorized===true;
    const requester=adminAuthorized?`admin:agent:${agent.id||'trinity'}`:`agent:${agent.id||'trinity'}`;
    const action=await createSystemAction(env,args,requester,{adminAuthorized});
    return {id:action.id,action:action.action,status:action.status,approval_required:action.status==='proposed',expires_at:action.expires_at,note:action.status==='proposed'?`Čaká na samostatné schválenie používateľa príkazom SCHVÁĽ ${action.id}.`:'Admin príkaz bol autorizovaný a čaká na lokálnu bránu.',_evidence:{effect:'proposal'}};
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
  if(name==='morpheus_core_plan'){
    const plan=planTask(args.task);
    const team=selectTeam(args.task,args.mode,'auto');
    return {core:'Trinity Morpheus Core',mode:args.mode,team,plan,external_actions_executed:false,approval_policy:'Citlivé externé operácie a nasadenie vyžadujú samostatné schválenie; tento plán sám nič nevykonáva.'};
  }
  if(name==='morpheus_core_status'){
    const [plugins,services]=await Promise.all([listPlugins(env),serviceStatus(env)]);
    return {core:'Trinity Morpheus Core',status:'available',orchestrator:'orchestrator',agent_count:AGENTS.length,skill_count:SKILLS.length,plugin:plugins.find(p=>p.id==='morpheus-core')||null,services,external_actions_executed:false};
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
  if(name==='portfolio_summary'){
    const owner=(env.TRINITY_OWNER_EMAIL||'').trim().toLowerCase();
    if(!owner)throw new Error('Vlastník papierového portfólia nie je nakonfigurovaný.');
    let id=args.portfolio_id;
    if(!id){const row=await env.DB.prepare('SELECT id FROM trading_portfolios WHERE owner_id=? ORDER BY created_at LIMIT 1').bind(owner).first();id=row?.id;}
    if(!id)throw new Error('Papierové portfólio ešte neexistuje.');
    const result=await getPortfolio(env,owner,id);
    return {...result,_evidence:{effect:'read',receipt_id:`portfolio:${id}`}};
  }
  // ── PC Bridge nástroje ──
  if(['pc_screenshot','pc_run','pc_file_read','pc_file_write','pc_file_append','pc_file_edit','pc_directory_create','pc_open_app','pc_app_control','pc_notify','pc_system_info','pc_scrape','pc_web_fetch','pc_download','pc_git_commit','pc_git_pr'].includes(name)){
    const pcActionMap={
      pc_screenshot:'screenshot', pc_run:'run', pc_file_read:'read', pc_file_write:'write',
      pc_file_append:'write',pc_file_edit:'edit',pc_directory_create:'write',
      pc_open_app:'open_app',pc_app_control:'open_app', pc_notify:'notify', pc_system_info:'system_info',
      pc_scrape:'scrape',pc_web_fetch:'web_fetch',pc_download:'download', pc_git_commit:'git_commit', pc_git_pr:'git_pr',
    };
    const pcAction=pcActionMap[name];
    const pcSchema={
      pc_screenshot:z.object({}).strict(),
      pc_run:z.object({command:z.string().min(1).max(4000),cwd:z.string().optional(),timeout:z.number().int().min(1000).max(120000).optional(),allowNonZero:z.boolean().optional()}).strict(),
      pc_file_read:z.object({path:z.string().min(1).max(2000),depth:z.number().int().min(1).max(3).optional()}).strict(),
      pc_file_write:z.object({path:z.string().min(1).max(2000),content:z.string().max(500000)}).strict(),
      pc_file_append:z.object({path:z.string().min(1).max(2000),content:z.string().max(500000)}).strict(),
      pc_file_edit:z.object({path:z.string().min(1).max(2000),find:z.string().min(1).max(200000),replace:z.string().max(200000)}).strict(),
      pc_directory_create:z.object({path:z.string().min(1).max(2000)}).strict(),
      pc_open_app:z.object({target:z.enum(['notepad','calculator','paint','explorer','chrome','edge'])}).strict(),
      pc_app_control:z.object({operation:z.enum(['list','launch','type']),app:z.enum(['notepad','calculator','paint','explorer','chrome','edge']).optional(),text:z.string().min(1).max(500).optional()}).strict(),
      pc_notify:z.object({message:z.string().min(1).max(256),title:z.string().max(80).optional(),duration:z.number().int().min(1).max(30).optional()}).strict(),
      pc_system_info:z.object({detail:z.boolean().optional()}).strict(),
      pc_scrape:z.object({url:z.string().url(),formats:z.array(z.string()).optional(),onlyMainContent:z.boolean().optional()}).strict(),
      pc_web_fetch:z.object({url:z.string().url()}).strict(),
      pc_download:z.object({url:z.string().url(),path:z.string().min(1).max(2000)}).strict(),
      pc_git_commit:z.object({message:z.string().min(3).max(200),cwd:z.string().optional(),files:z.array(z.string()).optional(),push:z.boolean().optional()}).strict(),
      pc_git_pr:z.object({title:z.string().min(3).max(200),head:z.string().min(1),body:z.string().max(4000).optional(),base:z.string().optional()}).strict(),
    };
    const parsedArgs=pcSchema[name].parse(input);
    let payload=parsedArgs;
    if(name==='pc_file_read')payload={path:parsedArgs.path,depth:parsedArgs.depth};
    if(name==='pc_file_write')payload={path:parsedArgs.path,content:parsedArgs.content};
    if(name==='pc_file_append')payload={path:parsedArgs.path,content:parsedArgs.content,operation:'append'};
    if(name==='pc_directory_create')payload={path:parsedArgs.path,operation:'mkdir'};
    const rationale=`Trinity tool: ${name}`;
    const adminAuthorized=executionContext.adminAuthorized===true;
    const requester=adminAuthorized?'admin:agent:trinity':'agent:trinity';
    const action=await createSystemAction(env,{action:pcAction,payload,rationale},requester,{adminAuthorized});
    if(action.status==='approved'){
      // Autorizovaný admin príkaz aj bezpečné čítanie čakajú na reálny receipt.
      for(let i=0;i<120;i++){
        await new Promise(r=>setTimeout(r,1500));
        const current=await getSystemAction(env,action.id);
        if(current?.status==='completed')return{...current.receipt,_evidence:{effect:'read',receipt_id:action.id}};
        if(current?.status==='failed')throw new Error(current.error || "PC Bridge: zlyhal.");
        if(current?.status==='proposed')break;
      }
    }
    return {id:action.id,action:pcAction,status:action.status,approval_required:action.status==='proposed',
      note:action.status==='proposed'?`Čaká na schválenie príkazom SCHVÁĽ ${action.id}.`:'Admin príkaz vykonáva PC Bridge.',
      _evidence:{effect:'proposal'}};
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
export const TOOL_HELP={
  // ── PC Bridge nástroje ──
  pc_screenshot:'Spraví screenshot obrazovky a vráti base64 PNG + rozlíšenie: {}',
  pc_run:'Spustí adminom autorizovaný PowerShell príkaz v povolenom workspace a vráti stdout/stderr: {command:string,cwd?:string,timeout?:ms,allowNonZero?:bool}',
  pc_file_read:'Prečíta súbor alebo vypíše adresár z PC: {path:string,depth?:1-3}',
  pc_file_write:'Zapíše súbor na PC (vyžaduje schválenie): {path:string,content:string}',
  pc_file_append:'Pridá obsah na koniec súboru v povolenom pracovnom priečinku (vyžaduje schválenie): {path:string,content:string}',
  pc_file_edit:'Nahradí text v súbore v povolenom pracovnom priečinku (vyžaduje schválenie): {path:string,find:string,replace:string}',
  pc_directory_create:'Vytvorí adresár v povolenom pracovnom priečinku (vyžaduje schválenie): {path:string}',
  pc_open_app:'Otvorí povolenú aplikáciu na PC (vyžaduje schválenie): {target:notepad|calculator|paint|explorer|chrome|edge}',
  pc_app_control:'Vypíše okná alebo po schválení otvorí aplikáciu či napíše text do aktívneho okna: {operation:list|launch|type,app?:alias,text?:string}',
  pc_notify:'Zobrazí Windows toast notifikáciu: {title?:string,message:string,duration?:sek}',
  pc_system_info:'Vráti CPU/RAM/disk/procesy z PC: {detail?:bool}',
  pc_scrape:'Hĺbkový scraping URL cez Firecrawl z PC: {url:string,formats?:[]}',
  pc_web_fetch:'Bezpečne načíta verejnú HTTP/HTTPS URL cez PC; blokuje lokálne siete a limity veľkosti: {url:string}',
  pc_download:'Stiahne verejnú URL do povoleného pracovného priečinka (vyžaduje schválenie): {url:string,path:string}',
  pc_git_commit:'Auto-commit + push na GitHub z PC (vyžaduje schválenie): {message:string,cwd?:string,files?:[],push?:bool}',
  pc_git_pr:'Vytvorí Pull Request na GitHub (vyžaduje schválenie): {title:string,head:string,body?:string,base?:string}',
  // ── Existujúce nástroje ──
  search_memory:'Vyhľadá pamäť: {query:string}',project_snapshot:'Prečíta projekty a úlohy: {}',
  service_status:'Overí služby: {binding?: názov služby}',web_search:'Vyhľadá aktuálne webové zdroje: {query:string}',generate_image:'Skutočne vytvorí obrázok a uloží ho do súkromného archívu: {prompt:string,seed?:integer}',portfolio_summary:'Prečíta simulované portfólio, pozície a zisk alebo stratu bez vykonania reálneho obchodu: {portfolio_id?:uuid}',calculate:'Presný výpočet {operation:add|subtract|multiply|divide|percentage|mean|power|sqrt|log10|sin|cos|tan,values:number[]}; trigonometria používa radiány',analyze_text:'Počet slov a znakov: {text:string}',current_time:'Skutočný čas a dátum: {timezone?: IANA názov}',json_tool:'Overí, formátuje, minifikuje alebo číta JSON: {operation, json, path?}',hash_text:'Vytvorí SHA-256 odtlačok textu: {text,algorithm?:"SHA-256"}',convert_units:'Prevádza jednotky dĺžky, hmotnosti a teploty: {value,from,to}',extract_entities:'Vyberie z textu e-maily, URL a dátumy: {text}',format_text:'Formátuje text: {text,mode:lower|upper|title|slug|snake|kebab}',list_capabilities:'Zoznam nainštalovaných verejných modulov Trinity: {query?: string}',list_skills:'Zoznam zabudovaných pracovných zručností Trinity: {query?: string}',list_connectors:'Skutočný stav nakonfigurovaných konektorov; nikdy nevracia tajomstvá: {}',install_plugin:'Nainštaluje alebo obnoví iba plugin z dôveryhodného katalógu Trinity: {id,reason}',request_system_action:'Vytvorí auditovanú internú akciu; v overenej admin relácii sa konkrétny príkaz autorizuje priamo, inak zostane návrhom: {action, payload, rationale}',system_action_status:'Overí stav a potvrdenie internej akcie: {id}'};
