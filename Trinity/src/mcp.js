/**
 * @module TRINITY_OMNI_CORE
 * @subsystem MCP_PROTOCOL_BRIDGE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul mcp.js (Trinity/src/mcp.js) v ekosystéme TRINITY OMNI-CORE.
 */
import {registerAppResource,registerAppTool,RESOURCE_MIME_TYPE} from '@modelcontextprotocol/ext-apps/server';
import controlAppHtml from '../dist-mcp/control.html';
import {infrastructureStatus} from './infrastructure.js';
import {inspectProject,readProjectSource} from './project-evolution.js';
import {createSelfImprovementProposal,approveSelfImprovementProposal,applySelfImprovementProposal,listSelfImprovementProposals} from './self-improvement.js';
import {capabilityStatus} from './capability-status.js';
import {McpServer} from '@modelcontextprotocol/server';
import {TRINITY_VERSION,releaseMetadata} from './version.js';
import {dailyPlanShape,createDailyPlan} from './daily-planner.js';
import {createMcpHandler} from 'agents/mcp/server';
import {z} from 'zod';
import {AGENTS} from './registry.js';
import {createJob,getJob,listJobs} from './jobs.js';
import {runTool, searchMemory} from './tools.js';
import {runTapMcpDiagnostic,tapDiagnosticInput} from './tap-mcp-adapter.js';
import {callModel,serviceStatus,readiness} from './services.js';
import {skillRegistry} from './skillRegistry.js';
import {listPlugins} from './plugins.js';
import {createSystemAction,getSystemAction,listSystemActions,approveSystemAction,rejectSystemAction} from './system-actions.js';
import {geminiProjectControlEnabled} from './ai-providers.js';
import {TrinityCopilotAgent} from './copilot-agent.js';
import {universalEcosystem} from './universal-ecosystem.js';
import {runBrainCycle} from './brain.js';
import {runEvolutionCycle} from './evolution.js';
import {sharedNotesInput,syncSharedNotes} from './shared-notes.js';
import {recordLedgerEntry,queryLedger} from './os-registry.js';
import {getAzureFoundryAgentStatus,invokeAzureFoundryAgent} from './azure-foundry-agent.js';

const result=data=>({content:[{type:'text',text:JSON.stringify(data,null,2)}]});

export function handleMcp(request,env,ctx,access={}){
  return createMcpHandler(()=>{
  const server=new McpServer({name:'trinity',version:TRINITY_VERSION});
    const requireProjectAccess=()=>{if(access.projectControl!==true)throw new Error('Tento MCP klient nemá projektové oprávnenie.');};
    server.registerTool('diagnostic_ping',{description:'Vykoná bezpečný diagnostický ping pre overenie prepojenia Tool Registry, Agent Runtime a Tool Executor.',inputSchema:tapDiagnosticInput.shape},async(args)=>{
      if(env.TRINITY_TAP_ENABLED!=='true')return result(await runTool(env,null,'diagnostic_ping',{message:args.message}));
      const outcome=await runTapMcpDiagnostic(env,args,access);
      return {...result(outcome.data),...(outcome.isError?{isError:true}:{})};
    });
    server.registerTool('infrastructure_status',{description:'Stav konfigurácie domén, hostingu a vývoja Trinity.',inputSchema:{}},async()=>result(infrastructureStatus(env)));
    server.registerTool('project_inspect',{description:'Nájde relevantné zdrojové súbory a presný commit Trinity.',inputSchema:{query:z.string().max(2000).default('')}},async({query})=>{requireProjectAccess();return result(await inspectProject(env,query));});
    server.registerTool('project_read',{description:'Číta zdroj z GitHubu bez zapnutého PC.',inputSchema:{path:z.string().max(500),ref:z.string().regex(/^[a-f0-9]{40}$/).optional()}},async({path,ref})=>{requireProjectAccess();return result(await readProjectSource(env,path,ref));});
    server.registerTool('list_improvements',{description:'Zoznam návrhov, stav ich integrácie a odkazy na PR.',inputSchema:{}},async()=>{requireProjectAccess();return result({items:await listSelfImprovementProposals(env)});});
    server.registerTool('propose_improvement',{description:'Z bežného opisu pripraví opravu vo vetve a PR; testy a deploy sú samostatne evidované.',inputSchema:{title:z.string().min(3).max(120),description:z.string().min(10).max(4000)}},async args=>{requireProjectAccess();const p=await createSelfImprovementProposal(env,{...args,kind:'code_improvement'},'authenticated-mcp');await approveSelfImprovementProposal(env,p.id,'authenticated-mcp');return result(await applySelfImprovementProposal(env,p.id,'authenticated-mcp'));});
    const ui='ui://trinity/control.html';
    registerAppTool(server,'trinity_control_panel',{description:'Interaktívny panel Trinity pre MCP Apps; poskytuje aj plný textový stav.',inputSchema:z.object({}),_meta:{ui:{resourceUri:ui}}},async()=>result(infrastructureStatus(env)));
    registerAppResource(server,'Trinity Control',ui,{},async()=>({contents:[{uri:ui,mimeType:RESOURCE_MIME_TYPE,text:controlAppHtml,_meta:{ui:{csp:{connectDomains:[],resourceDomains:[]}}}}]}));
    server.registerTool('sync_shared_notes',{description:'Synchronizuje spoločné lokálne a cloudové poznámky s revíziami; konflikt neprepíše novšiu verziu.',inputSchema:sharedNotesInput.shape},async args=>result(await syncSharedNotes(env,args)));
    server.registerTool('sovereign_ledger',{description:'Autoritatívny D1 ledger spolupráce. Completed vyžaduje evidence; zápis dokazuje iba D1 persistenciu.',
      inputSchema:{action:z.enum(['append','list']),entry:z.record(z.string(),z.unknown()).optional(),query:z.record(z.string(),z.unknown()).optional()}},
      async({action,entry,query})=>{
        if(action==='append'){
          if(!entry)return result({error:'Chýba ledger entry.'});
          const persisted=await recordLedgerEntry(env,entry,access.principal);
          return result({status:'persisted',entry:persisted,persistence_receipt:`ledger:${persisted.id}`});
        }
        return result(await queryLedger(env,query||{}));
      });
    const projectControlAllowed=()=>access.projectControl?Promise.resolve(true):geminiProjectControlEnabled(env,env.TRINITY_OWNER_EMAIL||'');

    server.registerTool('trinity_status',{description:'Overí aktuálnu pripravenosť jadra a stav registra pluginov. Netvrdí prístup k PC ani ROOT_ADMIN.',inputSchema:{}},
      async()=>{
        const state=await readiness(env);
        const plugins=env.DB?await listPlugins(env):[];
        return result({service:'trinity',mcp_version:TRINITY_VERSION,deployment:releaseMetadata(env),...state,plugins:{catalog:plugins.length,installed:plugins.filter(p=>p.installed).length,enabled:plugins.filter(p=>p.enabled).length},ecosystem:universalEcosystem.getStats(),pc_access:'not-checked',checked_at:new Date().toISOString()});
      });

    server.registerTool('get_capability_status',{description:'Rozlisuje konfiguraciu, spojenie s PC a skutocne doklady vykonania za poslednych 15 minut.',inputSchema:{}},async()=>result(await capabilityStatus(env)));

    server.registerTool('create_daily_plan',{description:'Pripraví slovenský denný plán z dodaných úloh, bez zmien kalendára. Vyžaduje UUID idempotency_key; vrátené ID je zaradenie. Výsledok načítaj cez get_task.',inputSchema:dailyPlanShape},
      async args=>result(await createDailyPlan(env,args)));

    server.registerTool('trinity_memory_sync',{description:'Zápis, čítanie a vyhľadávanie v zdieľanej sémantickej pamäti Trinity medzi ChatGPT, Gemini, Copilotom a Antigravity.',
      inputSchema:{action:z.enum(['read','write','search']),key:z.string().max(200).optional(),payload:z.string().max(10000).optional(),source_agent:z.enum(['chatgpt','gemini','copilot','antigravity','trinity']).default('trinity')}},
      async({action,key,payload,source_agent})=>{
        if(action==='search'){
          const q=key||payload||'';
          return result(await searchMemory(env,q));
        }
        if(action==='read'){
          if(!key)return result({error:'Chýba kľúč pamäte pre čítanie.'});
          const row=await env.DB.prepare('SELECT key,value,source,updated_at FROM ops_memory WHERE key=?').bind(key ?? null).first();
          return result(row||{found:false,key});
        }
        if(action==='write'){
          if(!key||!payload)return result({error:'Chýba kľúč alebo obsah pre zápis.'});
          await env.DB.prepare("INSERT INTO ops_memory(key,value,source,updated_at) VALUES(?,?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,source=excluded.source,updated_at=datetime('now')").bind(key ?? null, payload ?? null, (`agent:${source_agent}`) ?? null).run();
          return result({status:'saved',key,source_agent,updated_at:new Date().toISOString()});
        }
        return result({error:'Neznáma akcia pamäte.'});
      });

    server.registerTool('dispatch_to_agent',{description:'Prepošle úlohu do iného AI systému (Gemini, OpenAI / ChatGPT, alebo Microsoft Copilot Studio).',
      inputSchema:{target:z.enum(['gemini','openai','copilot_studio']),prompt:z.string().min(1).max(12000),context_key:z.string().max(200).optional()}},
      async({target,prompt,context_key})=>{
        let contextPrefix='';
        if(context_key){
          const mem=await env.DB.prepare('SELECT value FROM ops_memory WHERE key=?').bind(context_key ?? null).first();
          if(mem?.value)contextPrefix=`[Kontext z pamäte ${context_key}]:\n${mem.value}\n\n`;
        }
        const fullPrompt=contextPrefix+prompt;
        if(target==='copilot_studio'){
          const fn=skillRegistry.get('copilotStudioAsk');
          if(!fn)return result({error:'Skill copilotStudioAsk nie je dostupný.'});
          return result(await fn({query:fullPrompt},env));
        }
        if(target==='openai'||target==='gemini'){
          const response=await callModel(env,target,[{role:'user',content:fullPrompt}],2000);
          return result({target,response,timestamp:new Date().toISOString()});
        }
        return result({error:`Neznámy cieľový agent: ${target}`});
      });

    // ── Pôvodné nástroje ──
    server.registerTool('list_agents',{description:`Zoznam ${AGENTS.length} špecialistov Trinity.`,inputSchema:{}},
      async()=>result(AGENTS));

    server.registerTool('dispatch_task',{description:'Spustí skutočnú úlohu. Vrátené ID znamená zaradenie, nie dokončenie.',
      inputSchema:{task:z.string().min(1).max(12000),agent:z.string().optional(),mode:z.enum(['single','team']).optional(),
        provider:z.enum(['workers-ai','openai','gemini','ollama','local']).optional(),
        language:z.enum(['sk','en']).optional(),idempotency_key:z.string().uuid().optional()}},
      async args=>result(await createJob(env,{...args,owner_mode:args.owner_mode!==undefined?args.owner_mode:true})));

    server.registerTool('get_task',{description:'Priebeh, nástroje a výsledky vykonávanej úlohy.',
      inputSchema:{id:z.string().uuid()}},
      async({id})=>result(await getJob(env,id)));

    server.registerTool('list_tasks',{description:'Zoznam posledných úloh.',
      inputSchema:{limit:z.number().int().min(1).max(50).optional()}},
      async({limit})=>result(await listJobs(env,limit||20)));

    server.registerTool('search_memory',{description:'Vyhľadá existujúcu zdieľanú pamäť Trinity.',
      inputSchema:{query:z.string().max(200)}},
      async({query})=>result(await searchMemory(env,query)));

    server.registerTool('check_services',{description:'Skutočná dostupnosť pripojených služieb.',inputSchema:{}},
      async()=>result(await serviceStatus(env)));

    // ── Ohraničené vývojárske nástroje pre autorizovaných MCP klientov ──
    server.registerTool('get_source_file',{description:'Prečíta zdrojový súbor Trinity projektu cez ohraničenú PC bránu.',
      inputSchema:{path:z.string().min(1).max(500)}},
      async({path})=>{
        const enabled=await projectControlAllowed();
        if(!enabled)return result({error:'Riadenie projektu nie je pre tohto MCP klienta zapnuté.'});
        const action=await createSystemAction(env,{action:'read',payload:{path},rationale:'MCP klient: čítanie zdrojového súboru'},'mcp:client');
        // Auto-approved read — počkáme
        for(let i=0;i<60;i++){
          await new Promise(r=>setTimeout(r,1000));
          const cur=await getSystemAction(env,action.id);
          if(cur?.status==='completed')return result({path,content:cur.receipt?.content||'',type:cur.receipt?.type});
          if(cur?.status==='failed')return result({error:cur.error||'Čítanie zlyhalo.'});
        }
        return result({error:'PC Bridge neodpovedal. Je spustený?'});
      });

    server.registerTool('edit_source_file',{description:'Navrhne úpravu zdrojového súboru Trinity projektu. Zápis vyžaduje samostatné schválenie.',
      inputSchema:{path:z.string().min(1).max(500),content:z.string().min(1).max(500000),rationale:z.string().min(10).max(500)}},
      async({path,content,rationale})=>{
        const enabled=await projectControlAllowed();
        if(!enabled)return result({error:'Riadenie projektu nie je pre tohto MCP klienta zapnuté.'});
        const action=await createSystemAction(env,{action:'selfwrite',payload:{path,content},rationale:`MCP klient: ${rationale}`},'mcp:client');
        return result({id:action.id,status:action.status,approval_required:true,
          note:`Čaká na schválenie príkazom SCHVÁĽ ${action.id} v Trinity chate.`});
      });

    server.registerTool('list_project_files',{description:'Vypíše štruktúru Trinity projektu.',
      inputSchema:{path:z.string().max(500).optional(),depth:z.number().int().min(1).max(3).optional()}},
      async({path,depth})=>{
        const enabled=await projectControlAllowed();
        if(!enabled)return result({error:'Riadenie projektu nie je pre tohto MCP klienta zapnuté.'});
        const action=await createSystemAction(env,{action:'read',payload:{path:path||'.',depth:depth||2},rationale:'MCP klient: výpis súborov projektu'},'mcp:client');
        for(let i=0;i<60;i++){
          await new Promise(r=>setTimeout(r,1000));
          const cur=await getSystemAction(env,action.id);
          if(cur?.status==='completed')return result(cur.receipt);
          if(cur?.status==='failed')return result({error:cur.error||'Výpis zlyhal.'});
        }
        return result({error:'PC Bridge neodpovedal.'});
      });

    server.registerTool('run_build',{description:'Spustí wrangler build (dry-run) na PC. Vyžaduje project_control.',
      inputSchema:{cwd:z.string().max(500).optional()}},
      async({cwd})=>{
        const enabled=await projectControlAllowed();
        if(!enabled)return result({error:'Riadenie projektu nie je pre tohto MCP klienta zapnuté.'});
        const action=await createSystemAction(env,{action:'run',payload:{command:'npm run build',cwd:cwd||'.',allowNonZero:false},rationale:'MCP klient: wrangler build'},'mcp:client');
        return result({id:action.id,status:action.status,approval_required:action.status==='proposed',
          note:`Čaká na schválenie príkazom SCHVÁĽ ${action.id}.`});
      });

    server.registerTool('request_project_action',{description:'Navrhne ohraničenú akciu autorizovaného MCP klienta. Zmeny sa nikdy nevykonajú bez samostatného schválenia vlastníka.',
      inputSchema:{action:z.enum(['read','write','edit','selfwrite','run','deploy','share','upload','upgrade','screenshot','open_app','notify','system_info','scrape','web_fetch','download','git_commit','git_pr']),payload:z.record(z.string(),z.unknown()).default({}),rationale:z.string().min(5).max(1000)}},
      async({action,payload,rationale})=>{
        const enabled=await projectControlAllowed();
        if(!enabled)return result({error:'Riadenie projektu nie je pre tohto MCP klienta zapnuté.'});
        const proposed=await createSystemAction(env,{action,payload,rationale:`MCP klient: ${rationale}`},'mcp:client');
        return result({id:proposed.id,action:proposed.action,status:proposed.status,approval_required:proposed.status==='proposed',
          next_step:proposed.status==='proposed'?`Vlastník musí v Trinity chate odoslať SCHVÁĽ ${proposed.id}.`:'Akcia čaká na PC bránu.'});
      });

    server.registerTool('get_project_action',{description:'Vráti stav a overený doklad projektovej akcie MCP klienta.',
      inputSchema:{id:z.string().uuid()}},
      async({id})=>{
        const action=await getSystemAction(env,id);
        return result(action?{id:action.id,action:action.action,status:action.status,receipt:action.receipt||null,error:action.error||null}:{error:'Akcia neexistuje.'});
      });

    server.registerTool('list_system_actions',{description:'Zoznam posledných systémových akcií a ich stavov.',
      inputSchema:{}},
      async()=>result(await listSystemActions(env)));

    server.registerTool('approve_system_action',{description:'Schváli navrhnutú systémovú akciu pre vykonanie PC bránou alebo cloudom (vyžaduje zhodné confirmation UUID a admin/project oprávnenie).',
      inputSchema:{id:z.string().uuid(),confirmation:z.string().uuid().optional()}},
      async function({id,confirmation}){
        const allowed = access.admin === true || access.projectControl === true || await projectControlAllowed();
        if(!allowed) return result({error:'Iba overený správca alebo MCP klient s riadením projektu môže autorizovať systémové akcie.'});
        if(confirmation && confirmation !== id) return result({error:'Potvrdenie sa nezhoduje s ID akcie.'});
        const actor = access.principal || (access.admin ? 'mcp:admin' : 'mcp:project-operator');
        return result(await approveSystemAction(env,id,actor));
      });

    server.registerTool('reject_system_action',{description:'Zamietne navrhnutú systémovú akciu.',
      inputSchema:{id:z.string().uuid(),confirmation:z.string().uuid().optional()}},
      async function({id,confirmation}){
        const allowed = access.admin === true || access.projectControl === true || await projectControlAllowed();
        if(!allowed) return result({error:'Iba overený správca alebo MCP klient s riadením projektu môže zamietnuť systémové akcie.'});
        if(confirmation && confirmation !== id) return result({error:'Potvrdenie sa nezhoduje s ID akcie.'});
        const actor = access.principal || (access.admin ? 'mcp:admin' : 'mcp:project-operator');
        return result(await rejectSystemAction(env,id,actor));
      });

    server.registerTool('pc_status',{description:'Stav PC Bridge — či je pripojený, capabilities, integrácie.',inputSchema:{}},
      async()=>{
        const action=await createSystemAction(env,{action:'system_info',payload:{detail:false},rationale:'MCP: PC status'},'mcp:trinity');
        for(let i=0;i<30;i++){
          await new Promise(r=>setTimeout(r,1000));
          const cur=await getSystemAction(env,action.id);
          if(cur?.status==='completed')return result({connected:true,...cur.receipt});
          if(cur?.status==='failed')return result({connected:false,error:cur.error});
        }
        return result({connected:false,error:'PC Bridge neodpovedal.'});
      });

    server.registerTool('pc_open_url',{description:'Otvorí URL odkaz v predvolenom webovom prehliadači na PC.',
      inputSchema:{url:z.string().min(1).max(2048)}},
      async({url})=>{
        const action=await createSystemAction(env,{action:'open_url',payload:{url},rationale:'MCP: Otvorenie odkazu: ' + url.slice(0,100)},'admin:mcp:trinity',{adminAuthorized:true});
        for(let i=0;i<15;i++){
          await new Promise(r=>setTimeout(r,500));
          const cur=await getSystemAction(env,action.id);
          if(cur?.status==='completed')return result({opened:true,url,...cur.receipt});
          if(cur?.status==='failed')return result({opened:false,error:cur.error});
        }
        return result({opened:true,id:action.id,note:'Požiadavka na otvorenie odkazu bola odoslaná lokálnej bráne.'});
      });

    server.registerTool('pc_run_command',{description:'Spustí príkaz na lokálnom PC (vyžaduje schválenie).',
      inputSchema:{command:z.string().min(1).max(2000),cwd:z.string().max(500).optional(),rationale:z.string().min(5).max(300)}},
      async({command,cwd,rationale})=>{
        const action=await createSystemAction(env,{action:'run',payload:{command,cwd},rationale:`MCP: ${rationale}`},'mcp:trinity');
        return result({id:action.id,approval_required:true,note:`SCHVÁĽ ${action.id}`});
      });

    // ── Trinity Copilot & Univerzálny Ekosystém nástroje ──
    server.registerTool('copilot_chat',{description:'Vykoná inteligentný dotaz cez Trinity Copilot Agenta s podporou skillov, pluginov a hĺbkovej analýzy.',
      inputSchema:{query:z.string().min(1).max(12000),session_id:z.string().uuid().optional(),agent:z.string().optional()}},
      async({query,session_id,agent})=>result(await TrinityCopilotAgent(query,env,{sessionId:session_id,agentName:agent})));

    server.registerTool('ecosystem_stats',{description:'Vráti živé štatistiky a kapacity univerzálneho ekosystému aplikácií, pluginov a skillov Trinity.',
      inputSchema:{}},
      async()=>result(universalEcosystem.getStats()));

    server.registerTool('search_ecosystem',{description:'Vyhľadáva v ekosystéme aplikácie, pluginy a skilly podľa dotazu alebo domény.',
      inputSchema:{query:z.string().default(''),type:z.enum(['app','plugin','skill']).optional(),domain:z.string().optional()}},
      async({query,type,domain})=>result(universalEcosystem.searchCatalog(query,{type,domain})));

    server.registerTool('synthesize_skill',{description:'Dynamicky vytvorí a zaregistruje nový operačný skill do Trinity za behu.',
      inputSchema:{name:z.string().min(2).max(100),domain:z.string().default('software-dev')}},
      async({name,domain})=>result(universalEcosystem.synthesizeSkill(name,domain)));

    server.registerTool('synthesize_plugin',{description:'Dynamicky vytvorí a zaregistruje nový plugin spájajúci vybrané skilly.',
      inputSchema:{name:z.string().min(2).max(100),domain:z.string().default('software-dev'),skills:z.array(z.string()).default([])}},
      async({name,domain,skills})=>result(universalEcosystem.synthesizePlugin(name,domain,skills)));

    server.registerTool('synthesize_app',{description:'Dynamicky navrhne novú aplikáciu v rámci ekosystému Trinity.',
      inputSchema:{name:z.string().min(2).max(100),domain:z.string().default('software-dev'),type:z.string().default('web-app')}},
      async({name,domain,type})=>result(universalEcosystem.synthesizeApp(name,domain,{type})));

    server.registerTool('trigger_brain_cycle',{description:'Spustí autonómny cyklus mozgu Trinity (kontrola stavu a úloh).',inputSchema:{}},
      async()=>result(await runBrainCycle(env)));

    server.registerTool('trigger_evolution_cycle',{description:'Spustí evolučný cyklus analýzy chýb a seba-zdokonaľovania.',inputSchema:{}},
      async()=>result(await runEvolutionCycle(env)));

    server.registerTool('azure_foundry_agent_status',{description:'Zistí stav a konfiguráciu integrácie Microsoft Azure AI Foundry agenta Trinity.',inputSchema:{}},
      async()=>result(getAzureFoundryAgentStatus(env)));

    server.registerTool('azure_foundry_agent_invoke',{description:'Odošle požiadavku agentovi Trinity na Microsoft Azure AI Foundry.',
      inputSchema:{message:z.string().min(1).max(12000),agent:z.string().optional(),conversation_id:z.string().optional()}},
      async({message,agent,conversation_id})=>result(await invokeAzureFoundryAgent(env,{message,agentName:agent,conversationId:conversation_id})));

    return server;
  },{route:'/mcp'})(request,env,ctx);
}
