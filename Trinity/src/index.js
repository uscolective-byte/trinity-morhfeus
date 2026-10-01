import {z} from 'zod';
import {TrinityAgent,ChatAgent,GuardianAgent} from './legacy.js';
import {TrinityOperations} from './workflow.js';
import {AGENTS,shouldDelegate} from './registry.js';
import {createJob,getJob} from './jobs.js';
import {authenticate,checkOrigin,hash,HttpError,rateLimit,readJSON,secure,validKey,issueSession,allowDevConnection} from './security.js';
import {callModel,serviceStatus} from './services.js';
import {searchMemory,runTool} from './tools.js';
import {PLUGINS,listPlugins,pluginEnabled} from './plugins.js';
import {handleMcp} from './mcp.js';
import {TRUTH_POLICY_VERSION} from './truth.js';
import html from '../public/index.html';
import appJS from '../public/app.js.txt';
import css from '../public/style.css';
import refreshCSS from '../public/refresh.css';
import assistantHTML from '../public/assistant/chat.html';
import assistantCSS from '../public/assistant/chat.css';
import assistantJS from '../public/assistant/chat.js.txt';
export {TrinityAgent,ChatAgent,GuardianAgent,TrinityOperations};
const json=(data,status=200)=>Response.json(data,{status});
const uuid=z.string().uuid();
async function route(request,env,ctx){
  const url=new URL(request.url),path=url.pathname;
  if(request.method==='GET'&&['/','/ops','/dashboard','/index.html'].includes(path))return new Response(path==='/ops'?html:assistantHTML,{headers:{'Content-Type':'text/html; charset=utf-8',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}});
  if(request.method==='GET'&&path==='/app.js')return new Response(appJS,{headers:{'Content-Type':'application/javascript; charset=utf-8'}});
  if(request.method==='GET'&&path==='/style.css')return new Response(css+'\n'+refreshCSS,{headers:{'Content-Type':'text/css; charset=utf-8'}});
  if(request.method==='GET'&&path==='/chat.js')return new Response(assistantJS,{headers:{'Content-Type':'application/javascript; charset=utf-8'}});
  if(request.method==='GET'&&path==='/chat.css')return new Response(assistantCSS,{headers:{'Content-Type':'text/css; charset=utf-8'}});
  if(request.method==='GET'&&path==='/theme.css')return new Response('',{headers:{'Content-Type':'text/css'}});
  if(path==='/health'||path==='/api/health')return json({service:'Trinity',version:'6.3.0',agents:40,status:'serving',truth_mode:'evidence-required'});
  checkOrigin(request);
  if(path==='/api/ops/dev-login'&&request.method==='POST'){
    if(!await allowDevConnection(request,env))throw new HttpError(401,'Automatický vývojový vstup pre toto pripojenie nie je dostupný.');
    await rateLimit(env,'dev-login',20,60);
    return issueSession(env,Date.parse(env.TRINITY_DEV_UNTIL));
  }
  if(path==='/api/ops/login'&&request.method==='POST'){
    await rateLimit(env,'login:'+(await hash(request.headers.get('CF-Connecting-IP')||'local')).slice(0,24),10,300);
    const {key}=z.object({key:z.string().max(2048)}).parse(await readJSON(request));
    if(!await validKey(key,env))throw new HttpError(401,'Nesprávny prístupový kľúč.');
    return issueSession(env);
  }
  if(path==='/api/ops/redeem'&&request.method==='POST'){
    await rateLimit(env,'redeem:'+(await hash(request.headers.get('CF-Connecting-IP')||'local')).slice(0,24),10,300);
    const {ticket}=z.object({ticket:z.string().regex(/^[a-f0-9]{64}$/)}).parse(await readJSON(request));
    const used=await env.DB.prepare('DELETE FROM ops_login_tickets WHERE token_hash=? RETURNING expires_at').bind(await hash(ticket)).first();
    if(!used||used.expires_at<Date.now())throw new HttpError(401,'Odkaz vypršal alebo už bol použitý. Otvor znovu OTVORIT-TRINITY.cmd.');
    return issueSession(env);
  }
  if(path==='/api/ops/logout'&&request.method==='POST'){
    const session=request.headers.get('Cookie')?.match(/(?:^|;\s*)trinity_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    if(session)await env.DB.prepare('DELETE FROM ops_sessions WHERE token_hash=?').bind(await hash(session)).run();
    const response=json({ok:true});response.headers.set('Set-Cookie','trinity_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');return response;
  }
  const user=await authenticate(request,env);
  if(path==='/api/assistant/status'&&request.method==='GET')return json({name:'Trinity',mode:'cloud',model:'Trinity',available:true,cloud:true,identity:'single',active_specializations:AGENTS.length,capability_registry:'extensible',personality:'persistent',consciousness:false,decision_pipeline:'context → plan → tools → evidence check → response',truth_mode:'evidence-required',truth_policy_version:TRUTH_POLICY_VERSION,memory_location:'Cloudflare D1 · trinity-v03 · ops_memory + memory_long',tools:(await listPlugins(env)).filter(p=>p.enabled).flatMap(p=>p.tools)});
  if(path==='/api/assistant/sessions'&&request.method==='GET')return json((await env.DB.prepare("SELECT session_id AS session,MIN(task) AS title,MAX(created_at) AS updated_at FROM ops_jobs WHERE task NOT LIKE 'Kontrolný test%' GROUP BY session_id ORDER BY updated_at DESC LIMIT 30").all()).results);
  if(path==='/api/assistant/history'&&request.method==='GET'){
    const id=uuid.parse(url.searchParams.get('session'));
    const rows=(await env.DB.prepare('SELECT task,result,error FROM ops_jobs WHERE session_id=? ORDER BY created_at,rowid LIMIT 50').bind(id).all()).results;
    return json(rows.flatMap(r=>[{role:'user',content:r.task},...(r.result?[{role:'assistant',content:r.result}]:r.error?[{role:'assistant',content:'Úloha zlyhala: '+r.error}]:[])]));
  }
  if(path==='/api/assistant/chat'&&request.method==='POST'){
    await rateLimit(env,`job:${user.id}`,12);
    const d=z.object({message:z.string().min(1).max(12000),session:z.string().uuid(),language:z.enum(['sk','en']).default('sk'),engine:z.string().optional(),remember:z.boolean().optional(),allow_files:z.boolean().optional()}).strict().parse(await readJSON(request));
    const wantsMemory=/^(zapamätaj si|zapamataj si|remember)\s*[:,-]?\s+/i.test(d.message);
    const delegated=shouldDelegate(d.message);
    return json(await createJob(env,{task:d.message,session_id:d.session,agent:delegated?'auto':'orchestrator',mode:delegated?'team':'single',provider:'ollama',language:d.language,remember:d.remember||wantsMemory,idempotency_key:crypto.randomUUID()}),202);
  }
  if(path==='/api/assistant/memory'){
    if(request.method==='GET')return json((await searchMemory(env,url.searchParams.get('q')||'')).records);
    if(request.method==='POST'){const d=z.object({key:z.string().min(1).max(120),value:z.string().min(1).max(10000)}).strict().parse(await readJSON(request));await env.DB.prepare("INSERT INTO ops_memory(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind(d.key,d.value).run();return json({stored:true});}
  }
  if(path==='/api/assistant/changes'&&request.method==='GET')return json([]);
  if(path==='/api/ops/login-ticket'&&request.method==='POST'){
    await rateLimit(env,`ticket:${user.id}`,6);
    const ticket=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
    await env.DB.prepare('INSERT INTO ops_login_tickets(token_hash,expires_at) VALUES(?,?)').bind(await hash(ticket),Date.now()+120000).run();
    await env.DB.prepare('DELETE FROM ops_login_tickets WHERE expires_at<?').bind(Date.now()).run();
    return json({ticket,expires_in:120});
  }
  if(path==='/mcp'){
    if(!await pluginEnabled(env,'mcp'))throw new HttpError(503,'MCP rozšírenie je vypnuté.');
    await rateLimit(env,`mcp:${user.id}`,60);
    if(request.method==='POST'){
      const body=await readJSON(request);
      if(body.method==='tools/call'&&body.params?.name==='dispatch_task')await rateLimit(env,`job:${user.id}`,12);
      request=new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(body)});
    }
    return handleMcp(request,env,ctx);
  }
  if(path==='/api/ops/status'&&request.method==='GET'){
    const counts=await env.DB.prepare('SELECT status,COUNT(*) AS count FROM ops_jobs GROUP BY status').all();
    return json({name:'Trinity',version:'6.3.0',agents:AGENTS.length,identity:'single',consciousness:false,truth_mode:'evidence-required',truth_policy_version:TRUTH_POLICY_VERSION,jobs:counts.results,
      development_access_until:env.TRINITY_DEV_UNTIL||null,
      providers:{'workers-ai':env.AI?'configured':'missing',ollama:env.OLLAMA_SECRET||env.OLLAMA_API_KEY?'configured':'missing'},
      memory:await env.DB.prepare('SELECT (SELECT COUNT(*) FROM ops_memory) AS notes,(SELECT COUNT(*) FROM memory_long) AS legacy,(SELECT COUNT(*) FROM ops_jobs) AS conversations').first(),
      storage:{database:!!env.DB,cache:!!env.Mastermind,artifacts:!!env.ARTIFACTS,workflow:!!env.OPS_WORKFLOW}});
  }
  if(path==='/api/ops/agents'&&request.method==='GET'){
    const stats=await env.DB.prepare("SELECT agent_id,COUNT(*) AS runs,SUM(status='completed') AS completed,MAX(updated_at) AS last_run FROM ops_steps GROUP BY agent_id").all();
    return json(AGENTS.map(a=>({...a,...stats.results.find(s=>s.agent_id===a.id)})));
  }
  if(path==='/api/ops/plugins'&&request.method==='GET')return json(await listPlugins(env));
  const pluginRoute=path.match(/^\/api\/ops\/plugins\/([a-z-]+)(?:\/(test))?$/);
  if(pluginRoute&&request.method==='POST'){
    const plugin=PLUGINS.find(p=>p.id===pluginRoute[1]);if(!plugin)throw new HttpError(404,'Neznáme rozšírenie.');
    if(!pluginRoute[2]){
      const {enabled}=z.object({enabled:z.boolean()}).strict().parse(await readJSON(request));
      if(plugin.required&&!enabled)throw new HttpError(400,`${plugin.name} je povinná súčasť jadra Trinity.`);
      await env.DB.prepare("UPDATE ops_plugins SET enabled=?,updated_at=datetime('now') WHERE id=? AND installed=1").bind(enabled?1:0,plugin.id).run();
      return json({id:plugin.id,enabled});
    }
    await rateLimit(env,`plugin-test:${user.id}`,12);
    if(!await pluginEnabled(env,plugin.id))throw new HttpError(400,'Najprv zapni rozšírenie.');
    const cases={memory:['search_memory',{query:'trinity'}],projects:['project_snapshot',{}],monitor:['service_status',{binding:'CORE'}],web:['web_search',{query:'Cloudflare Workers official documentation'}],calculator:['calculate',{operation:'multiply',values:[6,7]}],text:['analyze_text',{text:'Trinity má spoločnú pamäť.'}],clock:['current_time',{timezone:'Europe/Bratislava'}],capabilities:['list_capabilities',{}]};
    let summary;
    if(cases[plugin.id]){const [tool,args]=cases[plugin.id];const result=await runTool(env,{tools:plugin.tools},tool,args);summary=plugin.id==='memory'?`${result.records.length} nájdených záznamov`:plugin.id==='projects'?`${result.projects.length} projektov, ${result.tasks.length} úloh`:plugin.id==='web'?`${result.results.length} webových výsledkov`:JSON.stringify(result);}
    if(plugin.id==='artifacts'){const key='plugin-checks/archive.txt',value='Trinity archive verification';await env.ARTIFACTS.put(key,value);const object=await env.ARTIFACTS.get(key);if(!object||await object.text()!==value)throw new HttpError(502,'Overenie archívu zlyhalo.');summary='Zápis aj čítanie R2 prešli.';}
    if(plugin.id==='mcp'){
      const check=await handleMcp(new Request(url.origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'trinity-plugin-check',version:'1'}}})}),env,ctx);
      if(check.status!==200||!(await check.text()).includes('serverInfo'))throw new HttpError(502,'MCP handshake zlyhal.');summary='MCP initialize handshake prešiel.';
    }
    if(plugin.id==='truth')summary=`Truth policy ${TRUTH_POLICY_VERSION} je aktívna; tvrdenia o externých akciách vyžadujú potvrdenie nástroja.`;
    await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('plugin_verified',?)").bind(JSON.stringify({plugin:plugin.id,summary})).run();
    return json({status:'verified',plugin:plugin.id,summary});
  }
  if(path==='/api/ops/services'&&request.method==='GET')return json(await serviceStatus(env));
  if(path==='/api/ops/providers/test'&&request.method==='POST'){
    await rateLimit(env,`provider:${user.id}`,4);
    const {provider}=z.object({provider:z.enum(['workers-ai','ollama'])}).parse(await readJSON(request));
    try{const response=await callModel(env,provider,[{role:'user',content:'Odpovedz iba: TRINITY_OK'}],40);return json({status:'verified',provider,model:response.model,response:response.text});}
    catch(e){return json({status:'failed',provider,error:e.message},502);}
  }
  if(path==='/api/ops/jobs'){
    if(request.method==='POST'){await rateLimit(env,`job:${user.id}`,12);return json(await createJob(env,await readJSON(request)),202);}
    if(request.method==='GET')return json((await env.DB.prepare('SELECT id,session_id,task,team,status,error,created_at,updated_at FROM ops_jobs ORDER BY created_at DESC,rowid DESC LIMIT 50').all()).results);
  }
  const jobRoute=path.match(/^\/api\/ops\/jobs\/([^/]+)(?:\/(artifact|cancel))?$/);
  if(jobRoute){
    const id=uuid.parse(jobRoute[1]);
    if(jobRoute[2]==='cancel'&&request.method==='POST'){
      const job=await getJob(env,id);
      if(['completed','failed','cancelled'].includes(job.status))return json({status:job.status});
      await (await env.OPS_WORKFLOW.get(id)).terminate();
      await env.DB.prepare("UPDATE ops_jobs SET status='cancelled',updated_at=datetime('now') WHERE id=? AND status<>'completed'").bind(id).run();
      await env.DB.prepare("UPDATE ops_steps SET status='cancelled',updated_at=datetime('now') WHERE job_id=? AND status IN ('pending','running')").bind(id).run();
      return json({status:'cancelled'});
    }
    if(request.method==='GET'){
      const job=await getJob(env,id);
      if(jobRoute[2]==='artifact'){
        if(!job.artifact_key)throw new HttpError(404,'Výstup ešte nie je pripravený.');
        const object=await env.ARTIFACTS.get(job.artifact_key);if(!object)throw new HttpError(404,'Súbor chýba.');
        return new Response(object.body,{headers:{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="trinity-${id}.md"`}});
      }return json(job);
    }
  }
  if(path==='/api/ops/memory'){
    if(request.method==='GET')return json(await searchMemory(env,z.string().max(200).parse(url.searchParams.get('q')||'')));
    if(request.method==='POST'){
      const {key,value}=z.object({key:z.string().min(1).max(120),value:z.string().min(1).max(10000)}).strict().parse(await readJSON(request));
      await env.DB.prepare("INSERT INTO ops_memory(key,value,source) VALUES(?,?,'user') ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind(key,value).run();
      return json({stored:true,key});
    }
  }
  if(path==='/api/ops/events'&&request.method==='GET')return json((await env.DB.prepare('SELECT * FROM ops_events ORDER BY id DESC LIMIT 50').all()).results);
  // Keep existing read-only project views available behind the same authentication.
  const legacyReads={'/api/workspace/projects':'projects','/api/workspace/tasks':'tasks','/api/memory/notes':'notes'};
  if(request.method==='GET'&&legacyReads[path]){
    // Table names come exclusively from this hardcoded allowlist, never user input.
    return json({items:(await env.DB.prepare(`SELECT * FROM ${legacyReads[path]} LIMIT 100`).all()).results});
  }
  throw new HttpError(404,'Táto cesta neexistuje.');
}
export default {
  async fetch(request,env,ctx){
    try{return secure(await route(request,env,ctx));}
    catch(e){const status=e instanceof z.ZodError?400:e.status||500;
      if(status===500)console.error(JSON.stringify({event:'request_failed',path:new URL(request.url).pathname}));
      return secure(json({error:status===500?'Interná chyba. Pozri záznamy služby.':e instanceof z.ZodError?'Neplatné údaje požiadavky.':e.message},status));}
  }
};
