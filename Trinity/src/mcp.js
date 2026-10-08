import {McpServer} from '@modelcontextprotocol/server';
import {createMcpHandler} from 'agents/mcp/server';
import {z} from 'zod';
import {AGENTS} from './registry.js';
import {createJob,getJob,listJobs} from './jobs.js';
import {searchMemory} from './tools.js';
import {serviceStatus} from './services.js';
import {createSystemAction,getSystemAction,listSystemActions,approveSystemAction} from './system-actions.js';
import {geminiProjectControlEnabled} from './ai-providers.js';

const result=data=>({content:[{type:'text',text:JSON.stringify(data,null,2)}]});

export function handleMcp(request,env,ctx){
  return createMcpHandler(()=>{
const server=new McpServer({name:'trinity',version:'8.6.0'});

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

    // ── Dev nástroje pre Antigravity / Gemini prístup k projektu ──
    server.registerTool('get_source_file',{description:'Prečíta zdrojový súbor Trinity projektu. Vyžaduje gemini project_control.',
      inputSchema:{path:z.string().min(1).max(500)}},
      async({path})=>{
        const enabled=await geminiProjectControlEnabled(env,env.TRINITY_OWNER_EMAIL||'');
        if(!enabled)return result({error:'Gemini project_control nie je zapnutý. Zapni ho v OPS → AI poskytovatelia.'});
        const action=await createSystemAction(env,{action:'read',payload:{path},rationale:'Gemini MCP: čítanie zdrojového súboru'},'mcp:gemini');
        // Auto-approved read — počkáme
        for(let i=0;i<60;i++){
          await new Promise(r=>setTimeout(r,1000));
          const cur=await getSystemAction(env,action.id);
          if(cur?.status==='completed')return result({path,content:cur.receipt?.content||'',type:cur.receipt?.type});
          if(cur?.status==='failed')return result({error:cur.error||'Čítanie zlyhalo.'});
        }
        return result({error:'PC Bridge neodpovedal. Je spustený?'});
      });

    server.registerTool('edit_source_file',{description:'Upraví zdrojový súbor Trinity projektu (selfwrite). Vyžaduje gemini project_control + schválenie.',
      inputSchema:{path:z.string().min(1).max(500),content:z.string().min(1).max(500000),rationale:z.string().min(10).max(500)}},
      async({path,content,rationale})=>{
        const enabled=await geminiProjectControlEnabled(env,env.TRINITY_OWNER_EMAIL||'');
        if(!enabled)return result({error:'Gemini project_control nie je zapnutý.'});
        const action=await createSystemAction(env,{action:'selfwrite',payload:{path,content},rationale:`Gemini MCP: ${rationale}`},'mcp:gemini');
        return result({id:action.id,status:action.status,approval_required:true,
          note:`Čaká na schválenie príkazom SCHVÁĽ ${action.id} v Trinity chate.`});
      });

    server.registerTool('list_project_files',{description:'Vypíše štruktúru Trinity projektu.',
      inputSchema:{path:z.string().max(500).optional(),depth:z.number().int().min(1).max(3).optional()}},
      async({path,depth})=>{
        const enabled=await geminiProjectControlEnabled(env,env.TRINITY_OWNER_EMAIL||'');
        if(!enabled)return result({error:'Gemini project_control nie je zapnutý.'});
        const action=await createSystemAction(env,{action:'read',payload:{path:path||'.',depth:depth||2},rationale:'Gemini MCP: výpis súborov projektu'},'mcp:gemini');
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
        const enabled=await geminiProjectControlEnabled(env,env.TRINITY_OWNER_EMAIL||'');
        if(!enabled)return result({error:'Gemini project_control nie je zapnutý.'});
        const action=await createSystemAction(env,{action:'run',payload:{command:'npm run build',cwd:cwd||'.',allowNonZero:false},rationale:'Gemini MCP: wrangler build'},'mcp:gemini');
        return result({id:action.id,status:action.status,approval_required:action.status==='proposed',
          note:`Čaká na schválenie príkazom SCHVÁĽ ${action.id}.`});
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
        return result({id:action.id,approval_required:true,note:`SCHVÁĽ ${action.id}`});
      });

    return server;
  },{route:'/mcp'})(request,env,ctx);
}
