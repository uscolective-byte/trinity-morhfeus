import {McpServer} from '@modelcontextprotocol/server';
import {createMcpHandler} from 'agents/mcp/server';
import {z} from 'zod';
import {AGENTS} from './registry.js';
import {createJob,getJob,listJobs} from './jobs.js';
import {searchMemory} from './tools.js';
import {serviceStatus,readiness} from './services.js';
import {listPlugins} from './plugins.js';
import {createSystemAction,getSystemAction,listSystemActions,approveSystemAction} from './system-actions.js';
import {geminiProjectControlEnabled} from './ai-providers.js';

const result=data=>({content:[{type:'text',text:JSON.stringify(data,null,2)}]});

export function handleMcp(request,env,ctx,access={}){
  return createMcpHandler(()=>{
  const server=new McpServer({name:'trinity',version:'9.4.3'});
    const projectControlAllowed=()=>access.projectControl?Promise.resolve(true):geminiProjectControlEnabled(env,env.TRINITY_OWNER_EMAIL||'');

    server.registerTool('trinity_status',{description:'Overí aktuálnu pripravenosť jadra a stav registra pluginov. Netvrdí prístup k PC ani ROOT_ADMIN.',inputSchema:{}},
      async()=>{
        const state=await readiness(env);
        const plugins=env.DB?await listPlugins(env):[];
        return result({service:'trinity',mcp_version:'9.4.3',...state,plugins:{catalog:plugins.length,installed:plugins.filter(p=>p.installed).length,enabled:plugins.filter(p=>p.enabled).length},pc_access:'not-checked',checked_at:new Date().toISOString()});
      });

    // ── Pôvodné nástroje ──
    server.registerTool('list_agents',{description:'Zoznam 40 špecialistov Trinity.',inputSchema:{}},
      async()=>result(AGENTS));

    server.registerTool('dispatch_task',{description:'Spustí skutočnú úlohu. Vrátené ID znamená zaradenie, nie dokončenie.',
      inputSchema:{task:z.string().min(1).max(12000),agent:z.string().optional(),mode:z.enum(['single','team']).optional(),
        provider:z.enum(['workers-ai','openai','gemini','ollama','local']).optional(),
        language:z.enum(['sk','en']).optional(),idempotency_key:z.string().uuid().optional()}},
      async args=>result(await createJob(env,args)));

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
          note:`Akcia čaká na rozhodnutie správcu v Trinity; ID: ${action.id}.`});
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
          note:`Akcia čaká na rozhodnutie správcu v Trinity; ID: ${action.id}.`});
      });

    server.registerTool('request_project_action',{description:'Navrhne ohraničenú akciu autorizovaného MCP klienta. Zmeny sa nikdy nevykonajú bez samostatného schválenia vlastníka.',
      inputSchema:{action:z.enum(['read','write','edit','selfwrite','run','deploy','share','upload','upgrade','screenshot','open_app','notify','system_info','scrape','web_fetch','download','git_commit','git_pr']),payload:z.record(z.string(),z.unknown()).default({}),rationale:z.string().min(5).max(1000)}},
      async({action,payload,rationale})=>{
        const enabled=await projectControlAllowed();
        if(!enabled)return result({error:'Riadenie projektu nie je pre tohto MCP klienta zapnuté.'});
        const proposed=await createSystemAction(env,{action,payload,rationale:`MCP klient: ${rationale}`},'mcp:client');
        return result({id:proposed.id,action:proposed.action,status:proposed.status,approval_required:proposed.status==='proposed',
          next_step:proposed.status==='proposed'?`Vlastník musí akciu skontrolovať v Trinity; ID: ${proposed.id}.`:'Akcia čaká na PC bránu.'});
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

    server.registerTool('pc_run_command',{description:'Spustí príkaz na lokálnom PC (vyžaduje schválenie).',
      inputSchema:{command:z.string().min(1).max(2000),cwd:z.string().max(500).optional(),rationale:z.string().min(5).max(300)}},
      async({command,cwd,rationale})=>{
        const action=await createSystemAction(env,{action:'run',payload:{command,cwd},rationale:`MCP: ${rationale}`},'mcp:trinity');
        return result({id:action.id,approval_required:true,note:`Akcia čaká na rozhodnutie správcu v Trinity; ID: ${action.id}`});
      });

    return server;
  },{route:'/mcp'})(request,env,ctx);
}
