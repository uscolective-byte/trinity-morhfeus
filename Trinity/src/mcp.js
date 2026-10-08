import {McpServer} from '@modelcontextprotocol/server';
import {createMcpHandler} from 'agents/mcp/server';
import {z} from 'zod';
import {AGENTS} from './registry.js';
import {createJob,getJob} from './jobs.js';
import {searchMemory} from './tools.js';
import {serviceStatus} from './services.js';
const result=data=>({content:[{type:'text',text:JSON.stringify(data)}]});
export function handleMcp(request,env,ctx){
  return createMcpHandler(()=>{
 const server=new McpServer({name:'trinity',version:'8.5.0'});
    server.registerTool('list_agents',{description:'Zoznam 40 špecialistov Trinity.',inputSchema:{}},async()=>result(AGENTS));
    server.registerTool('dispatch_task',{description:'Spustí skutočnú úlohu. Vrátené ID znamená zaradenie, nie dokončenie.',
      inputSchema:{task:z.string().min(1).max(12000),agent:z.string().optional(),mode:z.enum(['single','team']).optional(),provider:z.enum(['workers-ai','openai','gemini','ollama','local']).optional(),language:z.enum(['sk','en']).optional(),idempotency_key:z.string().uuid().optional()}},
      async args=>result(await createJob(env,args)));
    server.registerTool('get_task',{description:'Priebeh, nástroje a výsledky vykonávanej úlohy.',inputSchema:{id:z.string().uuid()}},async({id})=>result(await getJob(env,id)));
    server.registerTool('search_memory',{description:'Vyhľadá existujúcu zdieľanú pamäť Trinity.',inputSchema:{query:z.string().max(200)}},async({query})=>result(await searchMemory(env,query)));
    server.registerTool('check_services',{description:'Skutočná dostupnosť pripojených služieb; netestuje AI generovanie.',inputSchema:{}},async()=>result(await serviceStatus(env)));
    return server;
  },{route:'/mcp'})(request,env,ctx);
}
