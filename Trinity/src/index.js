import {z} from 'zod';
import {TrinityAgent,ChatAgent,GuardianAgent} from './legacy.js';
import {TrinityOperations} from './workflow.js';
import {AGENTS,shouldDelegate} from './registry.js';
import {createJob,getJob} from './jobs.js';
import {authenticate,checkOrigin,hash,HttpError,rateLimit,readJSON,secure,validKey,issueSession,allowDevConnection} from './security.js';
import {callModel,serviceStatus,runScheduledHealth,readiness} from './services.js';
import {searchMemory,runTool} from './tools.js';
import {PLUGINS,listPlugins,pluginEnabled,installPlugin} from './plugins.js';
import {handleMcp} from './mcp.js';
import {TRUTH_POLICY_VERSION} from './truth.js';
import {SYSTEM_CAPABILITIES,createSystemAction,listSystemActions,getSystemAction,approveSystemAction,rejectSystemAction,claimSystemAction,finishSystemAction,authenticateGateway,getPCBridgeStatus} from './system-actions.js';
import {listStudioProjects,getStudioProject,createStudioProject,reviseStudioProject} from './studio.js';
import {beginGoogleLogin,finishGoogleLogin,googleAuthRequired,googleOAuthConfigured} from './google-auth.js';
import {normalizeLanguage} from './cognition.js';
import {mediaStatus} from './media.js';
import {readControl,assertRunning} from './control.js';
import {listApis,createApi,invokeApi,invokeApiBySlug} from './api-builder.js';
import {listApiKeys,createApiKey,revokeApiKey,authenticateApiKey} from './api-keys.js';
import {listSecrets,storeSecret,verifySecret,revokeSecret,promoteCustomSecretToGemini} from './secret-vault.js';
import {listAIProviders,configureAIProvider,recordAIProviderCheck} from './ai-providers.js';
import {createPortfolio,listPortfolios,getPortfolio,recordTrade,setQuote} from './trading.js';
import {getWallet,transactWallet} from './wallet.js';
import {handleInboundEmail} from './email.js';
import html from '../public/index.html';
import appJS from '../public/app.js.txt';
import css from '../public/style.css';
import refreshCSS from '../public/refresh.css';
import assistantHTML from '../public/assistant/chat.html';
import assistantCSS from '../public/assistant/chat.css';
import builderCSS from '../public/assistant/builder.css';
import assistantJS from '../public/assistant/chat.js.txt';
export {TrinityAgent,ChatAgent,GuardianAgent,TrinityOperations};
const TRINITY_VERSION='9.1.0';
const json=(data,status=200)=>Response.json(data,{status});
const uuid=z.string().uuid();
function requireAdmin(user){if(!['admin','owner'].includes(user.role))throw new HttpError(403,'Táto operácia je dostupná iba správcovi Trinity.');}
function requireOwner(user){if(user.role!=='owner')throw new HttpError(403,'Táto operácia je dostupná iba vlastníkovi Trinity.');}
async function route(request,env,ctx){
  const url=new URL(request.url),path=url.pathname;
  if(request.method==='GET'&&['/','/ops','/dashboard','/index.html'].includes(path))return new Response(path==='/ops'?html:assistantHTML,{headers:{'Content-Type':'text/html; charset=utf-8',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}});
  if(request.method==='GET'&&path==='/app.js')return new Response(appJS,{headers:{'Content-Type':'application/javascript; charset=utf-8'}});
  if(request.method==='GET'&&path==='/style.css')return new Response(css+'\n'+refreshCSS,{headers:{'Content-Type':'text/css; charset=utf-8'}});
  if(request.method==='GET'&&path==='/chat.js')return new Response(assistantJS,{headers:{'Content-Type':'application/javascript; charset=utf-8'}});
  if(request.method==='GET'&&path==='/chat.css')return new Response(assistantCSS,{headers:{'Content-Type':'text/css; charset=utf-8'}});
  if(request.method==='GET'&&path==='/builder.css')return new Response(builderCSS,{headers:{'Content-Type':'text/css; charset=utf-8'}});
  if(request.method==='GET'&&path==='/theme.css')return new Response('',{headers:{'Content-Type':'text/css'}});
  if(path==='/health'||path==='/api/health'){
    const response=json({service:'Trinity',version:TRINITY_VERSION,agents:AGENTS.length,status:'serving',truth_mode:'evidence-required'});const origin=request.headers.get('Origin');
    if(['https://trinity-morhfeus-20261001.web.app','https://trinity-morhfeus-20261001.firebaseapp.com'].includes(origin)){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin');}
    return response;
  }
  if(path==='/ready'&&request.method==='GET'){
    const state=await readiness(env);
    return json({service:'Trinity',version:TRINITY_VERSION,...state},state.ready?200:503);
  }
  if(path==='/api/auth/config'&&request.method==='GET')return json({google_enabled:googleAuthRequired(env)&&googleOAuthConfigured(env),google_required:googleAuthRequired(env)});
  const generatedApi=path.match(/^\/api\/v1\/generated\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if(generatedApi&&(request.method==='GET'||request.method==='POST')){const client=await authenticateApiKey(request,env);return json(await invokeApiBySlug(env,client.owner_id,generatedApi[1],request.method));}
  if(path==='/api/auth/google/start'&&request.method==='GET'){
    if(!googleAuthRequired(env))throw new HttpError(404,'Google prihlasovanie zatiaľ nie je aktivované.');
    await rateLimit(env,`google-start:${(await hash(request.headers.get('CF-Connecting-IP')||'unknown')).slice(0,24)}`,10,300);
    return beginGoogleLogin(env);
  }
  if(path==='/api/auth/google/callback'&&request.method==='GET'){
    if(!googleAuthRequired(env))throw new HttpError(404,'Google prihlasovanie zatiaľ nie je aktivované.');
    await rateLimit(env,`google-callback:${(await hash(request.headers.get('CF-Connecting-IP')||'unknown')).slice(0,24)}`,10,300);
    return finishGoogleLogin(request,env);
  }
  checkOrigin(request);
  if(path==='/api/ops/dev-login'&&request.method==='POST'){
    if(googleAuthRequired(env))throw new HttpError(403,'Použi prihlásenie cez Google.');
    if(!await allowDevConnection(request,env))throw new HttpError(401,'Automatický vývojový vstup pre toto pripojenie nie je dostupný.');
    await rateLimit(env,'dev-login',20,60);
    return issueSession(env,Date.parse(env.TRINITY_DEV_UNTIL));
  }
  if(path==='/api/ops/login'&&request.method==='POST'){
    if(googleAuthRequired(env))throw new HttpError(403,'Prihlásenie prístupovým kľúčom je vypnuté. Použi Google.');
    await rateLimit(env,'login:'+(await hash(request.headers.get('CF-Connecting-IP')||'local')).slice(0,24),10,300);
    const {key}=z.object({key:z.string().max(2048)}).parse(await readJSON(request));
    if(!await validKey(key,env))throw new HttpError(401,'Nesprávny prístupový kľúč.');
    return issueSession(env,undefined,env.TRINITY_OWNER_EMAIL||null);
  }
  if(path==='/api/ops/redeem'&&request.method==='POST'){
    if(googleAuthRequired(env))throw new HttpError(403,'Jednorazové kľúče sú vypnuté. Použi Google.');
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
  if(path==='/api/system/actions/claim'&&request.method==='POST'){
    const gateway=await authenticateGateway(request,env);await rateLimit(env,`gateway-claim:${gateway}`,120);
    return json({action:await claimSystemAction(env,gateway)});
  }
  if(path==='/api/system/pc-bridge/v1/heartbeat'&&request.method==='POST'){
    const gateway=await authenticateGateway(request,env);await rateLimit(env,`gateway-heartbeat:${gateway}`,120);
    if(!env.PC_BRIDGE_V2?.fetch)throw new HttpError(503,'PC Bridge nie je nakonfigurovaný.');
    const response=await env.PC_BRIDGE_V2.fetch(new Request('https://pc-bridge.internal/v1/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(await readJSON(request,32000))}));
    if(!response.ok)throw new HttpError(502,`PC Bridge heartbeat zlyhal (HTTP ${response.status}).`);
    return json(await response.json());
  }
  const gatewayReceipt=path.match(/^\/api\/system\/actions\/([0-9a-f-]+)\/receipt$/i);
  if(gatewayReceipt&&request.method==='POST'){
    const gateway=await authenticateGateway(request,env);await rateLimit(env,`gateway-receipt:${gateway}`,120);
    return json({action:await finishSystemAction(env,uuid.parse(gatewayReceipt[1]),gateway,await readJSON(request,180000))});
  }
  const user=await authenticate(request,env);
  const ownerId=(user.email||user.id).trim().toLowerCase();
  if(path==='/api/assistant/media/status'&&request.method==='GET')return json(mediaStatus(env));
  if(path==='/api/ops/control'){
    requireAdmin(user);
    if(request.method==='GET')return json(await readControl(env));
    if(request.method==='POST'){
      const d=z.object({emergency_stop:z.boolean(),reason:z.string().trim().max(500).default('')}).strict().parse(await readJSON(request));
      await env.DB.prepare("UPDATE ops_control SET emergency_stop=?,reason=?,updated_by=?,updated_at=datetime('now') WHERE id=1").bind(d.emergency_stop?1:0,d.reason||null,user.email||'owner').run();
      await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES(?,?)").bind(d.emergency_stop?'emergency_stop_enabled':'emergency_stop_disabled',JSON.stringify({by:user.email||'owner',reason:d.reason||null})).run();
      return json(await readControl(env));
    }
  }
  const control=await readControl(env);
  if(control.emergency_stop&&!['/api/ops/status','/api/ops/control','/api/ops/logout'].includes(path))assertRunning(control);
  if(path==='/api/ops/users/pending'&&request.method==='GET'){
    requireAdmin(user);
    const rows=await env.DB.prepare("SELECT email,display_name,created_at FROM ops_users WHERE status='pending' AND role='user' ORDER BY created_at").all();
    return json({items:rows.results});
  }
  if(path==='/api/ops/users'&&request.method==='GET'){
    requireOwner(user);
    const rows=await env.DB.prepare('SELECT email,display_name,role,status,created_at,updated_at FROM ops_users ORDER BY created_at DESC LIMIT 200').all();
    return json({items:rows.results,owner_email:env.TRINITY_OWNER_EMAIL||null});
  }
  const userRoleRoute=path.match(/^\/api\/ops\/users\/([^/]+)\/role$/);
  if(userRoleRoute&&request.method==='POST'){
    requireOwner(user);let email;try{email=decodeURIComponent(userRoleRoute[1]).trim().toLowerCase();}catch{throw new HttpError(400,'Neplatný e-mail.');}
    if(env.TRINITY_OWNER_EMAIL&&email===env.TRINITY_OWNER_EMAIL.toLowerCase())throw new HttpError(409,'Rolu vlastníka nemožno zmeniť.');
    const {role,status}=z.object({role:z.enum(['user','admin']),status:z.enum(['active','blocked'])}).strict().parse(await readJSON(request));
    const changed=await env.DB.prepare("UPDATE ops_users SET role=?,status=?,updated_at=datetime('now') WHERE email=? RETURNING email,display_name,role,status,updated_at").bind(role,status,email).first();
    if(!changed)throw new HttpError(404,'Používateľ neexistuje.');
    await env.DB.prepare("DELETE FROM ops_sessions WHERE lower(email)=lower(?)").bind(email).run();
    return json(changed);
  }
  const reviewUser=path.match(/^\/api\/ops\/users\/([^/]+)\/(approve|reject)$/);
  if(reviewUser&&request.method==='POST'){
    requireAdmin(user);z.object({}).strict().parse(await readJSON(request));
    let email;try{email=decodeURIComponent(reviewUser[1]).trim().toLowerCase();}catch{throw new HttpError(400,'Neplatný e-mail.');}
    z.string().email().parse(email);
    const status=reviewUser[2]==='approve'?'active':'rejected';
    const changed=await env.DB.prepare("UPDATE ops_users SET status=?,approved_by=?,approved_at=datetime('now'),updated_at=datetime('now') WHERE email=? AND role='user' AND status='pending' RETURNING email,status").bind(status,user.email,email).first();
    if(!changed)throw new HttpError(404,'Čakajúci profil neexistuje.');
    await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('user_access_reviewed',?)").bind(JSON.stringify({email,status,admin:user.email})).run();
    return json(changed);
  }
  if(path==='/api/assistant/studio/projects'){
    if(request.method==='GET')return json({items:await listStudioProjects(env,'primary')});
    if(request.method==='POST'){await rateLimit(env,`studio-generate:${user.id}`,5,300);return json({project:await createStudioProject(env,'primary',await readJSON(request,20000))},201);}
  }
  const studioRoute=path.match(/^\/api\/assistant\/studio\/projects\/([0-9a-f-]+)(?:\/(revise|export))?$/i);
  if(studioRoute){const id=uuid.parse(studioRoute[1]);
    if(request.method==='GET'&&!studioRoute[2])return json({project:await getStudioProject(env,'primary',id)});
    if(request.method==='POST'&&studioRoute[2]==='revise'){await rateLimit(env,`studio-revise:${user.id}`,8,300);return json({project:await reviseStudioProject(env,'primary',id,await readJSON(request,20000))});}
    if(request.method==='GET'&&studioRoute[2]==='export'){const project=await getStudioProject(env,'primary',id);return new Response(project.html,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="${project.name.replace(/[^a-z0-9_-]+/gi,'-').slice(0,50)||'trinity-web'}.html"`}});}
  }
  if(path==='/api/assistant/settings'&&request.method==='GET'){
    const [plugins,memory,apis,keys,portfolios,pcBridge,secrets]=await Promise.all([
      listPlugins(env),env.DB.prepare('SELECT (SELECT COUNT(*) FROM ops_memory)+(SELECT COUNT(*) FROM memory_long) AS count').first(),
      env.DB.prepare('SELECT COUNT(*) AS count FROM ops_api_definitions WHERE owner_id=?').bind(ownerId).first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM ops_api_access_keys WHERE owner_id=? AND status='active'").bind(ownerId).first(),
      env.DB.prepare('SELECT COUNT(*) AS count FROM trading_portfolios WHERE owner_id=?').bind(ownerId).first(),getPCBridgeStatus(env),listSecrets(env,ownerId)
    ]);
    const secretStatus=provider=>secrets.find(item=>item.provider===provider)?.status||'not-configured';
    return json({plugins,truth_policy_version:TRUTH_POLICY_VERSION,version:TRINITY_VERSION,model:env.AI_MODEL||'@cf/openai/gpt-oss-120b',image_model:env.IMAGE_MODEL||'@cf/black-forest-labs/flux-1-schnell',permissions:{manage_api_keys:['admin','owner'].includes(user.role),manage_secrets:['admin','owner'].includes(user.role),manage_users:user.role==='owner',manage_trading:['admin','owner'].includes(user.role),use_local_ai:['admin','owner'].includes(user.role)},storage:{database:'Cloudflare D1',cache:'Workers KV · Mastermind',artifacts:'Cloudflare R2 · trinity-artifacts',strategy:'indexed-relational + cache + object archive',scalable:true,memory_records:memory.count||0},counts:{api_projects:apis.count||0,active_api_keys:keys.count||0,paper_portfolios:portfolios.count||0},internet:{web_search:plugins.some(p=>p.id==='web'&&p.enabled),mode:'outbound-only',always_on_gateway:pcBridge.connected===true},pc_bridge:pcBridge,integrations:[{id:'mcp',name:'MCP most',status:plugins.some(p=>p.id==='mcp'&&p.enabled)?'ready':'disabled'},{id:'api',name:'Trinity API',status:'ready'},{id:'web',name:'Webový výskum',status:plugins.some(p=>p.id==='web'&&p.enabled)?'ready':'disabled'},{id:'cloudflare',name:'Cloudflare',status:secretStatus('cloudflare')==='verified'?'verified':'platform-connected'},{id:'openai',name:'OpenAI / ChatGPT API',status:env.OPENAI_API_KEY?'configured':'not-configured'},{id:'gemini',name:'Google Gemini',status:env.GEMINI_API_KEY?'configured':secretStatus('gemini')},{id:'google',name:'Google OAuth',status:googleOAuthConfigured(env)?'configured':'not-configured'},{id:'github',name:'GitHub',status:secretStatus('github')}]});
  }
  const settingPlugin=path.match(/^\/api\/assistant\/settings\/plugins\/([a-z-]+)$/);
  if(settingPlugin&&request.method==='POST'){
    requireAdmin(user);
    const plugin=PLUGINS.find(item=>item.id===settingPlugin[1]);if(!plugin)throw new HttpError(404,'Neznámy modul.');const {enabled}=z.object({enabled:z.boolean()}).strict().parse(await readJSON(request));
    if(plugin.required&&!enabled)throw new HttpError(400,'Tento bezpečnostný modul musí zostať zapnutý.');await env.DB.prepare("UPDATE ops_plugins SET enabled=?,updated_at=datetime('now') WHERE id=? AND installed=1").bind(enabled?1:0,plugin.id).run();return json({id:plugin.id,enabled});
  }
  if(path==='/api/assistant/api-keys'){
    requireAdmin(user);
    if(request.method==='GET')return json({items:await listApiKeys(env,ownerId)});
    if(request.method==='POST'){await rateLimit(env,`api-key-create:${user.id}`,5,3600);return json({key:await createApiKey(env,ownerId,await readJSON(request,8000))},201);}
  }
  const revokeKey=path.match(/^\/api\/assistant\/api-keys\/([0-9a-f-]+)\/revoke$/i);
  if(revokeKey&&request.method==='POST'){requireAdmin(user);return json({key:await revokeApiKey(env,ownerId,uuid.parse(revokeKey[1]))});}
  if(path==='/api/assistant/secrets'){
    requireAdmin(user);
    if(request.method==='GET')return json({items:await listSecrets(env,ownerId)});
    if(request.method==='POST'){await rateLimit(env,`secret-store:${user.id}`,10,3600);return json({item:await storeSecret(env,ownerId,await readJSON(request,10000))},201);}
  }
  const secretRoute=path.match(/^\/api\/assistant\/secrets\/([0-9a-f-]+)\/(verify|revoke)$/i);
  if(secretRoute&&request.method==='POST'){requireAdmin(user);const id=uuid.parse(secretRoute[1]);return json({item:secretRoute[2]==='verify'?await verifySecret(env,ownerId,id):await revokeSecret(env,ownerId,id)});}
  const promoteGemini=path.match(/^\/api\/assistant\/secrets\/([0-9a-f-]+)\/promote-gemini$/i);
  if(promoteGemini&&request.method==='POST'){requireAdmin(user);await rateLimit(env,`secret-promote:${user.id}`,5,3600);return json({item:await promoteCustomSecretToGemini(env,ownerId,uuid.parse(promoteGemini[1]))});}
  if(path==='/api/assistant/ai-providers'&&request.method==='GET'){requireAdmin(user);return json(await listAIProviders(env,ownerId));}
  const aiProviderRoute=path.match(/^\/api\/assistant\/ai-providers\/(gemini)$/);
  if(aiProviderRoute&&request.method==='POST'){requireAdmin(user);return json({item:await configureAIProvider(env,ownerId,aiProviderRoute[1],await readJSON(request,8000))});}
  if(path==='/api/assistant/wallet'){
    requireAdmin(user);
    if(request.method==='GET')return json(await getWallet(env,ownerId));
    if(request.method==='POST'){await rateLimit(env,`wallet-sandbox:${user.id}`,30,300);return json(await transactWallet(env,ownerId,await readJSON(request,8000)));}
  }
  if(path==='/api/assistant/dashboard'&&request.method==='GET'){
    const isAdmin=['admin','owner'].includes(user.role);
    const [today,memory,projects,recent,activeJobs,failedToday,pendingUsers,pcBridge]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM ops_jobs WHERE status='completed' AND date(updated_at)=date('now')").first(),
      env.DB.prepare('SELECT (SELECT COUNT(*) FROM ops_memory)+(SELECT COUNT(*) FROM memory_long) AS count').first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM projects WHERE status IS NULL OR status NOT IN ('archived','deleted')").first(),
      env.DB.prepare("SELECT id,session_id,substr(task,1,120) AS task,status,updated_at FROM ops_jobs WHERE task NOT LIKE 'Kontrolný test%' ORDER BY updated_at DESC LIMIT 6").all(),
      isAdmin?env.DB.prepare("SELECT COUNT(*) AS count FROM ops_jobs WHERE status IN ('queued','running')").first():Promise.resolve({count:0}),
      isAdmin?env.DB.prepare("SELECT COUNT(*) AS count FROM ops_jobs WHERE status='failed' AND date(updated_at)=date('now')").first():Promise.resolve({count:0}),
      isAdmin?env.DB.prepare("SELECT COUNT(*) AS count FROM ops_users WHERE status='pending' AND role='user'").first():Promise.resolve({count:0}),
      getPCBridgeStatus(env)
    ]);
    const services=[env.AI,env.OPENAI_API_KEY,env.DB,env.ARTIFACTS,env.Mastermind,env.OPS_WORKFLOW,env.PC_BRIDGE_SERVICE,env.OLLAMA_SECRET||env.OLLAMA_API_KEY];
    return json({dashboard_mode:isAdmin?'admin':'user',today_completed:today.count||0,memory_count:memory.count||0,project_count:projects.count||0,available_services:services.filter(Boolean).length,total_services:services.length,pc_bridge:pcBridge,recent_jobs:recent.results,
      admin:isAdmin?{active_jobs:activeJobs.count||0,failed_today:failedToday.count||0,pending_users:pendingUsers.count||0,emergency_stop:control.emergency_stop===true}:null});
  }
  if(path==='/api/assistant/projects'&&request.method==='GET'){
    const [projects,tasks]=await Promise.all([env.DB.prepare('SELECT id,name,description,status FROM projects ORDER BY updated_at DESC LIMIT 30').all(),env.DB.prepare('SELECT id,title,status,assigned_agent FROM tasks ORDER BY updated_at DESC LIMIT 50').all()]);
    return json({projects:projects.results,tasks:tasks.results});
  }
  if(path==='/api/assistant/apis'){
    if(request.method==='GET')return json({items:await listApis(env,ownerId)});
    if(request.method==='POST'){requireAdmin(user);await rateLimit(env,`api-create:${user.id}`,20,300);return json({api:await createApi(env,ownerId,await readJSON(request,20000))},201);}
  }
  const apiInvoke=path.match(/^\/api\/assistant\/apis\/([0-9a-f-]+)\/invoke$/i);
  if(apiInvoke&&(request.method==='GET'||request.method==='POST'))return json(await invokeApi(env,ownerId,uuid.parse(apiInvoke[1]),request.method));
  if(path==='/api/assistant/trading/portfolios'){
    if(request.method==='GET')return json({items:await listPortfolios(env,ownerId),paper_only:true});
    if(request.method==='POST'){requireAdmin(user);await rateLimit(env,`portfolio-create:${user.id}`,10,300);return json(await createPortfolio(env,ownerId,await readJSON(request,16000)),201);}
  }
  const portfolioRoute=path.match(/^\/api\/assistant\/trading\/portfolios\/([0-9a-f-]+)(?:\/(trades))?$/i);
  if(portfolioRoute){const id=uuid.parse(portfolioRoute[1]);
    if(request.method==='GET'&&!portfolioRoute[2])return json(await getPortfolio(env,ownerId,id));
    if(request.method==='POST'&&portfolioRoute[2]==='trades'){requireAdmin(user);await rateLimit(env,`paper-trade:${user.id}`,30,300);return json(await recordTrade(env,ownerId,id,await readJSON(request,16000)),201);}
  }
  if(path==='/api/assistant/trading/quotes'&&request.method==='POST'){requireAdmin(user);await rateLimit(env,`paper-quote:${user.id}`,60,300);return json(await setQuote(env,ownerId,await readJSON(request,8000)));}
  if(path==='/api/system/capabilities'&&request.method==='GET'){requireAdmin(user);return json({internal:true,publicly_advertised:false,capabilities:SYSTEM_CAPABILITIES});}
  if(path==='/api/system/actions'){
    requireAdmin(user);
    if(request.method==='GET')return json({items:await listSystemActions(env)});
    if(request.method==='POST'){await rateLimit(env,`system-propose:${user.id}`,20);return json({action:await createSystemAction(env,await readJSON(request,60000),`admin:user:${user.id}`,{adminAuthorized:true})},201);}
  }
  const systemActionRoute=path.match(/^\/api\/system\/actions\/([0-9a-f-]+)(?:\/(approve|reject))?$/i);
  if(systemActionRoute){
    requireAdmin(user);
    const id=uuid.parse(systemActionRoute[1]);
    if(request.method==='GET'&&!systemActionRoute[2]){const action=await getSystemAction(env,id);if(!action)throw new HttpError(404,'Akcia neexistuje.');return json({action});}
    if(request.method==='POST'&&systemActionRoute[2]){
      const input=z.object({confirmation:z.string().uuid()}).strict().parse(await readJSON(request));if(input.confirmation!==id)throw new HttpError(400,'Potvrdenie sa nezhoduje s ID akcie.');
      return json({action:systemActionRoute[2]==='approve'?await approveSystemAction(env,id,`user:${user.id}`):await rejectSystemAction(env,id,`user:${user.id}`)});
    }
  }
  if(path==='/api/assistant/status'&&request.method==='GET')return json({name:'Trinity',version:TRINITY_VERSION,mode:'cloud',model:env.AI_MODEL||'@cf/openai/gpt-oss-120b',available:true,cloud:true,local_available:!!env.TRINITY_GATEWAY_KEY&&['admin','owner'].includes(user.role),local_model:'qwen3:4b-instruct',pc_bridge:await getPCBridgeStatus(env),identity:'single',active_specializations:AGENTS.length,capability_registry:'extensible',personality:'persistent',consciousness:false,languages:'multilingual-auto',planning:{version:'1.1',intents:['conversation','research','build','creative','action','analysis'],approval_for_high_risk:!['admin','owner'].includes(user.role),admin_direct_execution:['admin','owner'].includes(user.role)},decision_pipeline:'understand → authenticate → classify → plan → tools → receipt → response',truth_mode:'evidence-required',truth_policy_version:TRUTH_POLICY_VERSION,memory_location:'Cloudflare D1 · trinity-v03 · ops_memory + memory_long',media:mediaStatus(env),account:{email:user.email||null,role:user.role||null},tools:(await listPlugins(env)).filter(p=>p.enabled).flatMap(p=>p.tools)});
  if(path==='/api/assistant/sessions'&&request.method==='GET')return json((await env.DB.prepare("SELECT session_id AS session,MIN(task) AS title,MAX(created_at) AS updated_at FROM ops_jobs WHERE task NOT LIKE 'Kontrolný test%' GROUP BY session_id ORDER BY updated_at DESC LIMIT 30").all()).results);
  if(path==='/api/assistant/history'&&request.method==='GET'){
    const id=uuid.parse(url.searchParams.get('session'));
    const rows=(await env.DB.prepare('SELECT task,result,error FROM ops_jobs WHERE session_id=? ORDER BY created_at,rowid LIMIT 50').bind(id).all()).results;
    return json(rows.flatMap(r=>[{role:'user',content:r.task},...(r.result?[{role:'assistant',content:r.result}]:r.error?[{role:'assistant',content:'Úloha zlyhala: '+r.error}]:[])]));
  }
  if(path==='/api/assistant/chat'&&request.method==='POST'){
    await rateLimit(env,`job:${user.id}`,12);
    const d=z.object({message:z.string().min(1).max(12000),session:z.string().uuid(),language:z.string().max(35).default('auto').transform(normalizeLanguage),engine:z.enum(['cloud','openai','gemini','ollama','local']).default('cloud'),remember:z.boolean().optional(),allow_files:z.boolean().optional()}).strict().parse(await readJSON(request));
    if(d.engine==='local')requireAdmin(user);
    const wantsMemory=/^(zapamätaj si|zapamataj si|remember)\s*[:,-]?\s+/i.test(d.message);
    const delegated=shouldDelegate(d.message);
    const provider=d.engine==='local'?'local':d.engine==='ollama'?'ollama':d.engine==='gemini'?'gemini':d.engine==='openai'?'openai':'workers-ai';
    const ownerMode=['admin','owner'].includes(user.role);
    return json(await createJob(env,{task:d.message,session_id:d.session,agent:delegated?'auto':'orchestrator',mode:delegated?'team':'single',provider,language:d.language,remember:d.remember||wantsMemory,owner_mode:ownerMode,idempotency_key:crypto.randomUUID()}),202);
  }
  const mediaRoute=path.match(/^\/api\/assistant\/media\/images\/([0-9a-f-]+)$/i);
  if(mediaRoute&&request.method==='GET'){
    const id=uuid.parse(mediaRoute[1]);const object=await env.ARTIFACTS.get(`media/images/${id}.jpg`);
    if(!object)throw new HttpError(404,'Obrázok neexistuje.');
    const headers=new Headers();object.writeHttpMetadata(headers);headers.set('Cache-Control','private, max-age=86400');headers.set('Content-Disposition',`inline; filename="trinity-${id}.jpg"`);
    return new Response(object.body,{headers});
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
    return json({name:'Trinity',version:TRINITY_VERSION,agents:AGENTS.length,identity:'single',account:{email:user.email||null,role:user.role||null},control,consciousness:false,truth_mode:'evidence-required',truth_policy_version:TRUTH_POLICY_VERSION,jobs:counts.results,
      development_access_until:env.TRINITY_DEV_UNTIL||null,
      providers:{'workers-ai':env.AI?'configured':'missing',openai:env.OPENAI_API_KEY?'configured':'missing',gemini:(await listAIProviders(env,ownerId)).items.find(item=>item.id==='gemini')?.enabled?'configured':'missing',ollama:env.OLLAMA_SECRET||env.OLLAMA_API_KEY?'configured':'missing'},
      memory:await env.DB.prepare('SELECT (SELECT COUNT(*) FROM ops_memory) AS notes,(SELECT COUNT(*) FROM memory_long) AS legacy,(SELECT COUNT(*) FROM ops_jobs) AS conversations').first(),
      storage:{database:!!env.DB,cache:!!env.Mastermind,artifacts:!!env.ARTIFACTS,workflow:!!env.OPS_WORKFLOW}});
  }
  if(path==='/api/ops/agents'&&request.method==='GET'){
    const stats=await env.DB.prepare("SELECT agent_id,COUNT(*) AS runs,SUM(status='completed') AS completed,MAX(updated_at) AS last_run FROM ops_steps GROUP BY agent_id").all();
    return json(AGENTS.map(a=>({...a,...stats.results.find(s=>s.agent_id===a.id)})));
  }
  if(path==='/api/ops/plugins'&&request.method==='GET')return json(await listPlugins(env));
  const pluginRoute=path.match(/^\/api\/ops\/plugins\/([a-z-]+)(?:\/(test|install))?$/);
  if(pluginRoute&&request.method==='POST'){
    const plugin=PLUGINS.find(p=>p.id===pluginRoute[1]);if(!plugin)throw new HttpError(404,'Neznáme rozšírenie.');
    if(pluginRoute[2]==='install')return json(await installPlugin(env,plugin.id),201);
    if(!pluginRoute[2]){
      const {enabled}=z.object({enabled:z.boolean()}).strict().parse(await readJSON(request));
      if(plugin.required&&!enabled)throw new HttpError(400,`${plugin.name} je povinná súčasť jadra Trinity.`);
      await env.DB.prepare("UPDATE ops_plugins SET enabled=?,updated_at=datetime('now') WHERE id=? AND installed=1").bind(enabled?1:0,plugin.id).run();
      return json({id:plugin.id,enabled});
    }
    await rateLimit(env,`plugin-test:${user.id}`,12);
    if(!await pluginEnabled(env,plugin.id))throw new HttpError(400,'Najprv zapni rozšírenie.');
    const cases={memory:['search_memory',{query:'trinity'}],projects:['project_snapshot',{}],monitor:['service_status',{binding:'CORE'}],web:['web_search',{query:'Cloudflare Workers official documentation'}],calculator:['calculate',{operation:'multiply',values:[6,7]}],text:['analyze_text',{text:'Trinity má spoločnú pamäť.'}],clock:['current_time',{timezone:'Europe/Bratislava'}],capabilities:['list_capabilities',{}]};
    let summary,details;
    if(cases[plugin.id]){const [tool,args]=cases[plugin.id];const result=await runTool(env,{tools:plugin.tools},tool,args);summary=plugin.id==='memory'?`${result.records.length} nájdených záznamov`:plugin.id==='projects'?`${result.projects.length} projektov, ${result.tasks.length} úloh`:plugin.id==='web'?`${result.results.length} webových výsledkov`:JSON.stringify(result);}
    if(plugin.id==='images'){const result=await runTool(env,{id:'plugin-check',tools:plugin.tools},'generate_image',{prompt:'Minimalistická žiarivá hviezda Trinity na tmavomodrom pozadí, bez textu'});details={id:result.id,url:result.url,model:result.model};summary=`Obrázok ${result.id} bol skutočne vytvorený a uložený.`;}
    if(plugin.id==='artifacts'){const key='plugin-checks/archive.txt',value='Trinity archive verification';await env.ARTIFACTS.put(key,value);const object=await env.ARTIFACTS.get(key);if(!object||await object.text()!==value)throw new HttpError(502,'Overenie archívu zlyhalo.');summary='Zápis aj čítanie R2 prešli.';}
    if(plugin.id==='mcp'){
      const check=await handleMcp(new Request(url.origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'trinity-plugin-check',version:'1'}}})}),env,ctx);
      if(check.status!==200||!(await check.text()).includes('serverInfo'))throw new HttpError(502,'MCP handshake zlyhal.');summary='MCP initialize handshake prešiel.';
    }
    if(plugin.id==='truth')summary=`Truth policy ${TRUTH_POLICY_VERSION} je aktívna; tvrdenia o externých akciách vyžadujú potvrdenie nástroja.`;
    await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('plugin_verified',?)").bind(JSON.stringify({plugin:plugin.id,summary})).run();
    return json({status:'verified',plugin:plugin.id,summary,details});
  }
  if(path==='/api/ops/services'&&request.method==='GET')return json(await serviceStatus(env));
  if(path==='/api/ops/providers/test'&&request.method==='POST'){
    await rateLimit(env,`provider:${user.id}`,4);
    const {provider}=z.object({provider:z.enum(['workers-ai','openai','gemini','ollama','local'])}).parse(await readJSON(request));
    const started=Date.now();
    try{const response=await callModel(env,provider,[{role:'user',content:'Odpovedz iba: TRINITY_OK'}],256);const check=await recordAIProviderCheck(env,ownerId,{status:'verified',provider,model:response.model,latency_ms:Date.now()-started});return json({...check,response:response.text});}
    catch(e){const check=await recordAIProviderCheck(env,ownerId,{status:'failed',provider,error:e.message,latency_ms:Date.now()-started});return json(check,502);}
  }
  if(path==='/api/ops/jobs'){
    if(request.method==='POST'){await rateLimit(env,`job:${user.id}`,12);return json(await createJob(env,{...await readJSON(request),owner_mode:['admin','owner'].includes(user.role)}),202);}
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
  },
  async scheduled(controller,env,ctx){ctx.waitUntil(runScheduledHealth(env,controller.cron));},
  async email(message,env){await handleInboundEmail(message,env);}
};
