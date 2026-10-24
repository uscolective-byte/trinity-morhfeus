import {issueSession,hash} from '../src/security.js';
import {PLUGINS} from '../src/plugins.js';
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {createSystemAction} from '../src/system-actions.js';
import {createApiKey} from '../src/api-keys.js';
let mf,db;const key='test-only-not-a-real-secret-123456789';const gatewayKey='test-only-gateway-secret-123456789012345';
const url='https://trinity.test';
async function req(path,body,auth=true,extra={}){return mf.dispatchFetch(url+path,{method:body===undefined?'GET':'POST',headers:{...(auth?{Authorization:'Bearer '+key}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},body:body===undefined?undefined:JSON.stringify(body)});}
test('capability status requires authentication and does not mistake configured gateway for execution',async()=>{
  assert.equal((await req('/api/assistant/capabilities',undefined,false)).status,401);
  const response=await req('/api/assistant/capabilities');
  assert.equal(response.status,200);
  const report=await response.json();
  assert.equal(report.pc_connected,false);
  assert.equal(report.groups.find(group=>group.id==='files').status,'offline');
  assert.equal(JSON.stringify(report).includes(gatewayKey),false);
});
before(async()=>{
  const modules=readdirSync('dist').filter(x=>!x.endsWith('.map')&&!x.endsWith('.md')).map(name=>({type:name==='index.js'?'ESModule':name.endsWith('.png')?'Data':'Text',path:resolve('dist',name)}));
  modules.sort((a,b)=>a.type==='ESModule'?-1:b.type==='ESModule'?1:0);
  mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'trinity',modules,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],bindings:{CF_VERSION_METADATA:{id:'test-deployment',tag:'test-commit',timestamp:'2026-10-17T00:00:00.000Z'},TRINITY_OPS_KEY:key,TRINITY_GATEWAY_KEY:gatewayKey,TRINITY_VAULT_KEY:Buffer.alloc(32,7).toString('base64url'),OLLAMA_API_KEY:'test-only-ollama-key',OLLAMA_MODEL:'gemma4:31b'},kvNamespaces:{Mastermind:'test-kv'},d1Databases:{DB:'test-db'},r2Buckets:{ARTIFACTS:'test-r2'},
    serviceBindings:{AI:{name:'mock',entrypoint:'MockAI'}},workflows:{OPS_WORKFLOW:{name:'test-workflow',className:'TrinityOperations'}}},
    {name:'mock',modules:true,compatibilityDate:'2026-10-01',script:`import {WorkerEntrypoint} from 'cloudflare:workers'; export class MockAI extends WorkerEntrypoint{async run(model,args){if(model.includes('flux'))return {image:btoa('mock-jpeg')};if(model.includes('whisper'))return {text:'test voice transcript'};if(model.includes('melotts'))return new Uint8Array([73,68,51]);const prompt=args.messages.at(-1).content;if(prompt==='FAIL_TEST'||(prompt==='FAIL_PLANNER'&&args.messages[0].content.includes('Rozlož zadanie na vykonateľné kroky')))throw new Error('Simulated failure');if(prompt.includes('STUDIO_TEST')){const revised=prompt.includes('STUDIO_TEST_REVISION');return {response:'<!doctype html><html><head><title>Studio test</title></head><body><main><h1>'+(revised?'Revised':'Created')+'</h1></main></body></html>'};}return {response:'TEST_MODEL_RESULT'};}} export default {fetch(){return new Response('mock')}};`} ]}));
  db=await mf.getD1Database('DB','trinity');
  await db.batch([
    db.prepare('CREATE TABLE audit_log(id INTEGER PRIMARY KEY,module TEXT NOT NULL,action TEXT NOT NULL,details TEXT)'),
    db.prepare("INSERT INTO audit_log(module,action,details) VALUES('legacy','preserve','existing history')"),
    db.prepare('CREATE TABLE memory(id TEXT PRIMARY KEY,content TEXT)'),
    db.prepare('CREATE TABLE knowledge(id INTEGER PRIMARY KEY,topic TEXT,content TEXT)'),
    db.prepare('CREATE TABLE personality(id INTEGER PRIMARY KEY,trait TEXT,value TEXT)'),
    db.prepare('CREATE TABLE notes(id TEXT PRIMARY KEY,title TEXT,content TEXT)'),
    db.prepare('CREATE TABLE memory_long(key TEXT,value TEXT,category TEXT,importance INTEGER)'),
    db.prepare('CREATE TABLE projects(id TEXT,name TEXT,description TEXT,status TEXT,updated_at TEXT)'),
    db.prepare('CREATE TABLE tasks(id TEXT,title TEXT,status TEXT,assigned_agent TEXT,updated_at TEXT)'),
    db.prepare("INSERT INTO memory(id,content) VALUES('old-1','Používateľ má rád stručné odpovede.'),('unsafe-1','api key secret must not migrate')"),
    db.prepare("INSERT INTO personality(id,trait,value) VALUES(1,'tone','srdečný')")
  ]);
  for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort()){
    const sql=readFileSync('migrations/'+file,'utf8');await db.batch(sql.split(/;\s*(?:\r?\n|$)/).map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
  }
});
after(async()=>{await mf?.dispose();});
test('chat maintainer APIs are private and read-only MCP keys can discover tool schemas',async()=>{
  assert.equal((await req('/api/assistant/chat/health',undefined,false)).status,401);
  const health=await req('/api/assistant/chat/health');
  assert.equal(health.status,200);
  assert.equal((await health.json()).connected,false);
  assert.equal((await req('/api/assistant/chat/maintenance',{})).status,503);
  const created=await createApiKey({DB:db},'chat-test',{name:'Chat read-only',scopes:['mcp:read']});
  const response=await mf.dispatchFetch(url+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+created.secret,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:999,method:'tools/call',params:{name:'tool_catalog',arguments:{query:'calculate'}}})});
  assert.equal(response.status,200);
  const content=await response.text();
  assert.match(content,/calculate/);
  assert.match(content,/operation/);
});
test('CI audit migrations preserve a pre-existing legacy audit table',async()=>{
  const legacy=await db.prepare("SELECT details FROM audit_log WHERE module='legacy'").first();
  assert.equal(legacy.details,'existing history');
  const columns=await db.prepare("PRAGMA table_info('ops_ci_audit_log')").all();
  assert.ok(columns.results.some(column=>column.name==='repo'));
  assert.ok(columns.results.some(column=>column.name==='idempotency_key'));
});
test('public UI, liveness and readiness; private APIs',async()=>{assert.equal((await req('/',undefined,false)).status,200);const health=await(await req('/health',undefined,false)).json();assert.equal(health.agents,45);assert.equal(health.version,'11.0.0');assert.equal(health.deployment.id,'test-deployment');assert.equal(health.deployment.tag,'test-commit');const ready=await req('/ready',undefined,false);assert.equal(ready.status,200,await ready.clone().text());assert.equal((await ready.json()).checks.schema,true);assert.equal((await req('/api/ops/agents',undefined,false)).status,401);assert.equal((await req('/mcp',{},false)).status,401);});
test('Concept 3 is self-contained, and its stylesheet and Trinity core artwork are served as typed assets',async()=>{const page=await(await req('/',undefined,false)).text();assert.match(page,/concept3\.css/);assert.doesNotMatch(page,/material-symbols-rounded/);assert.doesNotMatch(page,/chat_bubble|account_balance_wallet/);const css=await req('/concept3.css',undefined,false);assert.equal(css.status,200);assert.match(await css.text(),/\.sidebar-status-card/);const image=await req('/trinity-core.png',undefined,false);assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/image\/png/);assert.deepEqual([...new Uint8Array(await image.arrayBuffer()).slice(0,4)],[137,80,78,71]);});
test('new chat loads its publicly served stylesheet after inherited themes',async()=>{
  const page=await(await req('/',undefined,false)).text();
  assert.ok(page.indexOf('/street-chat.css')>page.indexOf('/theme.css'));
  const response=await req('/street-chat.css',undefined,false);
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/text\/css/);
  assert.match(response.headers.get('cache-control'),/no-store|no-cache/);
  assert.ok((await response.text()).length>0);
});
test('login sets protected cookie and logout revokes it',async()=>{const r=await req('/api/ops/login',{key},false);assert.equal(r.status,200);const c=r.headers.get('set-cookie');assert.match(c,/HttpOnly/);assert.match(c,/Secure/);assert.match(c,/SameSite=Strict/);assert.equal((await req('/api/ops/status',undefined,false,{Cookie:c.split(';')[0]})).status,200);await req('/api/ops/logout',{},false,{Cookie:c.split(';')[0]});assert.equal((await req('/api/ops/status',undefined,false,{Cookie:c.split(';')[0]})).status,401);});

test('redeem preserves the authenticated ticket issuer and rejects reuse and expiry',async()=>{
 const email='ticket-owner@example.test';
 const session=await issueSession({DB:db},undefined,email,new Request(url));
 const created=await req('/api/ops/login-ticket',{email:'untrusted@example.test'},false,{Cookie:session.headers.get('set-cookie').split(';')[0]});
 assert.equal(created.status,200);const {ticket}=await created.json();
 const redeemed=await req('/api/ops/redeem',{ticket},false);
 assert.equal(redeemed.status,200);
 const cookie=redeemed.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
 const token=cookie.match(/trinity_session=([^;]+)/)[1];
 const stored=await db.prepare('SELECT email FROM ops_sessions WHERE token_hash=?').bind(await hash(token)).first();
 assert.equal(stored.email,email);
 assert.equal((await req('/api/ops/redeem',{ticket},false)).status,401);
 const expired='b'.repeat(64);
 await db.prepare('INSERT INTO ops_login_tickets(token_hash,expires_at,email) VALUES(?,?,?)').bind(await hash(expired),Date.now()-1000,email).run();
 assert.equal((await req('/api/ops/redeem',{ticket:expired},false)).status,401);
 assert.equal((await req('/api/ops/redeem',{ticket:'invalid'},false)).status,400);
 assert.equal((await req('/api/ops/login-ticket',{},false)).status,401);
});

test('legacy identity-free tickets do not acquire owner identity',async()=>{
 const ticket='c'.repeat(64);
 await db.prepare('INSERT INTO ops_login_tickets(token_hash,expires_at) VALUES(?,?)').bind(await hash(ticket),Date.now()+60000).run();
 const response=await req('/api/ops/redeem',{ticket},false);assert.equal(response.status,200);
 const token=response.headers.get('set-cookie').match(/trinity_session=([^;]+)/)[1];
 const stored=await db.prepare('SELECT email FROM ops_sessions WHERE token_hash=?').bind(await hash(token)).first();
 assert.equal(stored.email,null);
});

test('both public interfaces load the same checked authentication bootstrap first',async()=>{
 const helper=await req('/auth-bootstrap.js',undefined,false);
 assert.equal(helper.status,200);assert.match(helper.headers.get('content-type'),/javascript/);
 assert.match(await helper.text(),/TrinityAuth/);
 for(const [path,script] of [['/','/chat.js'],['/ops','/app.js']]){
  const response=await req(path,undefined,false);assert.equal(response.status,200);
  const html=await response.text();const authIndex=html.indexOf('src="/auth-bootstrap.js"');
  assert.ok(authIndex>=0&&authIndex<html.indexOf(`src="${script}`));
 }
});
test('Google auth stays dormant and the authenticated owner is recognized',async()=>{const config=await(await req('/api/auth/config',undefined,false)).json();assert.deepEqual(config,{google_enabled:false,google_required:false});assert.equal((await req('/api/auth/google/start',undefined,false)).status,404);const pending=await req('/api/ops/users/pending');assert.equal(pending.status,200);assert.equal((await req('/api/ops/users/example%40gmail.com/approve',{})).status,404);});
test('owner emergency stop pauses work and can resume it',async()=>{const before=await(await req('/api/ops/control')).json();assert.equal(before.emergency_stop,false);const stopped=await(await req('/api/ops/control',{emergency_stop:true,reason:'runtime test'})).json();assert.equal(stopped.emergency_stop,true);assert.equal((await req('/api/ops/jobs',{task:'blocked while stopped'})).status,503);const status=await(await req('/api/ops/status')).json();assert.equal(status.control.emergency_stop,true);const resumed=await(await req('/api/ops/control',{emergency_stop:false,reason:'runtime test complete'})).json();assert.equal(resumed.emergency_stop,false);});
test('origin validation and unknown agent',async()=>{assert.equal((await req('/api/ops/jobs',{task:'hi'},true,{Origin:'https://evil.test'})).status,403);assert.equal((await req('/api/ops/jobs',{task:'hi',agent:'not-real'})).status,400);});
test('authenticated admin job is server-authorized without a second approval phrase',async()=>{const created=await req('/api/ops/jobs',{task:'Zapíš bezpečnú zmenu',provider:'gemini'});assert.equal(created.status,202,await created.clone().text());const job=await created.json();const row=await db.prepare('SELECT owner_mode FROM ops_jobs WHERE id=?').bind(job.id).first();assert.equal(row.owner_mode,1);});
test('memory persists and parameterized queries resist SQL injection',async()=>{assert.equal((await req('/api/ops/memory',{key:'unit-memory',value:'unique-verified-value'})).status,200);const r=await(await req('/api/ops/memory?q=unique-verified-value')).json();assert.equal(r.records[0].value,'unique-verified-value');assert.equal((await req('/api/ops/memory?q='+encodeURIComponent("';DROP TABLE ops_jobs;--"))).status,200);assert.equal((await req('/api/ops/jobs')).status,200);});
test('legacy memories migrate without credential-like records',async()=>{const safe=await(await req('/api/ops/memory?q='+encodeURIComponent('stručné odpovede'))).json();assert.ok(safe.records.some(r=>r.source==='legacy:memory'));const unsafe=await(await req('/api/ops/memory?q='+encodeURIComponent('must not migrate'))).json();assert.equal(unsafe.records.length,0);const identity=await(await req('/api/ops/memory?q='+encodeURIComponent('jednu osobnú asistentku'))).json();assert.ok(identity.records.some(r=>r.key==='profil/trinity-identita'));});
test('persistent personality and truth profile are available',async()=>{const personality=await(await req('/api/ops/memory?q='+encodeURIComponent('nepredstiera biologické emócie'))).json();assert.ok(personality.records.some(r=>r.key==='profil/trinity-osobnost'));const status=await(await req('/api/assistant/status')).json();assert.equal(status.consciousness,false);assert.equal(status.truth_mode,'evidence-required');assert.equal(status.personality,'persistent');});
test('main dashboard separates admin and user workspaces without exposing hidden system tools',async()=>{const dashboard=await(await req('/api/assistant/dashboard')).json();assert.equal(dashboard.dashboard_mode,'admin');assert.equal(typeof dashboard.today_completed,'number');assert.equal(typeof dashboard.memory_count,'number');assert.equal(typeof dashboard.admin.active_jobs,'number');assert.equal(typeof dashboard.admin.failed_today,'number');assert.equal(typeof dashboard.admin.pending_users,'number');assert.ok(Array.isArray(dashboard.recent_jobs));const html=await(await req('/',undefined,false)).text();assert.match(html,/id="user-dashboard"/);assert.match(html,/id="admin-dashboard"/);assert.match(html,/id="control-eyebrow"/);assert.match(html,/id="owner-growth-panel"/);assert.match(html,/OWNER · OBCHOD A RAST/);assert.match(html,/data-owner-prompt="prospects"/);assert.match(html,/AI Studio/);assert.match(html,/studio-preview/);assert.match(html,/studio-tab-code/);assert.match(html,/studio-tab-quality/);assert.match(html,/studio-provider/);assert.match(html,/studio-quality-mode/);assert.match(html,/settings-studio-provider/);assert.match(html,/settings-studio-quality-alert/);assert.match(html,/settings-start-view/);assert.match(html,/settings-open-details/);assert.match(html,/settings-search/);assert.match(html,/settings-default-engine/);assert.match(html,/account-state/);assert.match(html,/settings-account-status/);assert.match(html,/settings-view/);assert.match(html,/settings-integrations/);assert.match(html,/api-key-form/);assert.match(html,/secret-form/);assert.match(html,/settings-wallet-panel/);assert.match(html,/settings-users-panel/);assert.match(html,/gemini-operator-status/);assert.match(html,/ollama-provider-test/);assert.match(html,/gemini-use-chat/);assert.match(html,/environment-badge/);assert.match(html,/attach-image/);assert.match(html,/record-voice/);assert.match(html,/read-answer/);assert.match(html,/workflow-canvas/);assert.match(html,/settings-rbac-panel/);assert.match(html,/settings-monitor-panel/);assert.doesNotMatch(html,/request_system_action|selfwrite/);});
test('AI Studio creates, previews, revises, lists, and exports a versioned website',async()=>{
  const createdResponse=await req('/api/assistant/studio/projects',{prompt:'STUDIO_TEST create a modern website',provider:'workers-ai',quality:'fast'});const createdText=await createdResponse.text();assert.equal(createdResponse.status,201,createdText);const created=JSON.parse(createdText).project;
  assert.equal(created.version,1);assert.match(created.html,/Content-Security-Policy/i);assert.match(created.html,/>Created</);assert.equal(created.versions.length,1);
  const listed=await(await req('/api/assistant/studio/projects')).json();assert.ok(listed.items.some(item=>item.id===created.id));
  const revised=await(await req('/api/assistant/studio/projects/'+created.id+'/revise',{prompt:'STUDIO_TEST_REVISION make the hero clearer',provider:'workers-ai',quality:'high'})).json();assert.equal(revised.project.version,2);assert.match(revised.project.html,/>Revised</);assert.equal(revised.project.versions.length,2);
  const exported=await req('/api/assistant/studio/projects/'+created.id+'/export');assert.equal(exported.status,200);assert.match(exported.headers.get('content-disposition'),/attachment/);assert.match(await exported.text(),/Content-Security-Policy/i);
});
test('required plugins are actually installed and enabled',async()=>{const plugins=await(await req('/api/ops/plugins')).json();assert.equal(plugins.length,PLUGINS.length);assert.ok(plugins.every(p=>p.installed&&p.enabled));assert.ok(plugins.some(p=>p.id==='truth'&&p.required));assert.ok(plugins.some(p=>p.id==='clock'&&p.tools.includes('current_time')));assert.ok(plugins.some(p=>p.id==='skills'&&p.tools.includes('list_skills')));assert.ok(plugins.some(p=>p.id==='connectors'&&p.tools.includes('list_connectors')));assert.ok(plugins.some(p=>p.id==='images'&&p.tools.includes('generate_image')));assert.ok(plugins.some(p=>p.id==='trading'&&p.tools.includes('portfolio_summary')));assert.ok(plugins.some(p=>p.id==='statistics'&&p.tools.includes('statistics')));assert.ok(plugins.some(p=>p.id==='data-redactor'&&p.tools.includes('redact_sensitive')));assert.ok(plugins.some(p=>p.id==='computer-control'&&p.required&&p.tools.includes('pc_app_control')));assert.ok(plugins.some(p=>p.id==='workspace-files'&&p.required&&p.tools.includes('pc_file_write')));assert.ok(plugins.some(p=>p.id==='internet-operator'&&p.required&&p.tools.includes('pc_web_fetch')));assert.ok(plugins.some(p=>p.id==='developer-operator'&&p.required&&p.tools.includes('pc_run')));});
test('trusted plugin install restores a built-in module and rejects unknown code',async()=>{await req('/api/ops/plugins/skills',{enabled:false});const installed=await req('/api/ops/plugins/skills/install',{});assert.equal(installed.status,201);assert.equal((await installed.json()).enabled,true);assert.equal((await req('/api/ops/plugins/untrusted/install',{})).status,404);});
test('settings can toggle optional modules but protect required security modules',async()=>{const settings=await(await req('/api/assistant/settings')).json();assert.equal(settings.version,'11.0.0');assert.equal(settings.plugins.length,PLUGINS.length);assert.equal(settings.permissions.manage_api_keys,true);assert.equal(settings.permissions.manage_secrets,true);assert.equal(settings.permissions.manage_trading,true);assert.equal((await req('/api/assistant/settings/plugins/truth',{enabled:false})).status,400);assert.equal((await req('/api/assistant/settings/plugins/computer-control',{enabled:false})).status,400);let changed=await(await req('/api/assistant/settings/plugins/clock',{enabled:false})).json();assert.equal(changed.enabled,false);changed=await(await req('/api/assistant/settings/plugins/clock',{enabled:true})).json();assert.equal(changed.enabled,true);});
test('declarative API builder creates and invokes an authenticated JSON API',async()=>{const createdResponse=await req('/api/assistant/apis',{name:'Test status',slug:'test-status',method:'GET',response:{ok:true,service:'Trinity'},status:'active'});assert.equal(createdResponse.status,201,await createdResponse.clone().text());const created=(await createdResponse.json()).api;const invoked=await req('/api/assistant/apis/'+created.id+'/invoke');assert.equal(invoked.status,200);assert.deepEqual(await invoked.json(),{ok:true,service:'Trinity'});});
test('Trinity API keys expose the secret once, invoke scoped APIs, and revoke cleanly',async()=>{const createdResponse=await req('/api/assistant/api-keys',{name:'Runtime client',scopes:['api:invoke'],rate_limit_per_minute:30,expires_at:null});assert.equal(createdResponse.status,201,await createdResponse.clone().text());const created=(await createdResponse.json()).key;assert.match(created.secret,/^trn_live_[A-Za-z0-9_-]{43}$/);assert.equal(created.secret_visible_once,true);const listed=await(await req('/api/assistant/api-keys')).json();const item=listed.items.find(row=>row.id===created.id);assert.ok(item);assert.equal(item.secret,undefined);assert.equal(item.key_hash,undefined);const invoked=await mf.dispatchFetch(url+'/api/v1/generated/test-status',{headers:{Authorization:'Bearer '+created.secret}});assert.equal(invoked.status,200,await invoked.clone().text());assert.deepEqual(await invoked.json(),{ok:true,service:'Trinity'});const rejected=await mf.dispatchFetch(url+'/api/v1/generated/test-status',{headers:{Authorization:'Bearer trn_live_'+'x'.repeat(43)}});assert.equal(rejected.status,401);const revoked=await req('/api/assistant/api-keys/'+created.id+'/revoke',{});assert.equal(revoked.status,200,await revoked.clone().text());const after=await mf.dispatchFetch(url+'/api/v1/generated/test-status',{headers:{Authorization:'Bearer '+created.secret}});assert.equal(after.status,401);});
test('scoped MCP keys separate read access from project-changing tools',async()=>{const headers={Accept:'application/json, text/event-stream','Content-Type':'application/json'};const readKey=(await(await req('/api/assistant/api-keys',{name:'Gemini MCP read',scopes:['mcp:read'],rate_limit_per_minute:30,expires_at:null})).json()).key;let response=await mf.dispatchFetch(url+'/mcp',{method:'POST',headers:{...headers,Authorization:'Bearer '+readKey.secret},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'gemini-test',version:'1'}}})});assert.equal(response.status,200,await response.clone().text());response=await mf.dispatchFetch(url+'/mcp',{method:'POST',headers:{...headers,Authorization:'Bearer '+readKey.secret},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'pc_run_command',arguments:{command:'npm test',rationale:'runtime permission test'}}})});assert.equal(response.status,403,await response.clone().text());const writeKey=(await(await req('/api/assistant/api-keys',{name:'Gemini MCP write',scopes:['mcp:read','mcp:write'],rate_limit_per_minute:30,expires_at:null})).json()).key;response=await mf.dispatchFetch(url+'/mcp',{method:'POST',headers:{...headers,Authorization:'Bearer '+writeKey.secret},body:JSON.stringify({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'request_project_action',arguments:{action:'open_app',payload:{app:'notepad'},rationale:'runtime project access test'}}})});assert.equal(response.status,200,await response.clone().text());assert.match(await response.text(),/approval_required/);});
test('encrypted vault never returns a stored secret',async()=>{const storedResponse=await req('/api/assistant/secrets',{provider:'custom',name:'Runtime secret',secret:'super-secret-runtime-value'});assert.equal(storedResponse.status,201,await storedResponse.clone().text());const stored=(await storedResponse.json()).item;assert.equal(stored.secret,undefined);assert.match(stored.secret_hint,/••••alue/);const listed=await(await req('/api/assistant/secrets')).json();assert.equal(JSON.stringify(listed).includes('super-secret-runtime-value'),false);assert.equal((await req('/api/assistant/secrets/'+stored.id+'/verify',{})).status,400);assert.equal((await req('/api/assistant/secrets/'+stored.id+'/revoke',{})).status,200);});
test('Gemini provider requires an encrypted and verified credential before activation',async()=>{const providers=await(await req('/api/assistant/ai-providers')).json();const ollama=providers.items.find(item=>item.id==='ollama');assert.equal(ollama.configured,true);assert.equal(ollama.model,'gemma4:31b');assert.equal(providers.items.find(item=>item.id==='gemini').configured,false);const stored=await(await req('/api/assistant/secrets',{provider:'gemini',name:'Runtime Gemini',secret:'runtime-gemini-api-key'})).json();const configured=await req('/api/assistant/ai-providers/gemini',{secret_id:stored.item.id,model:'models/gemini-test',enabled:true});assert.equal(configured.status,409);assert.equal(JSON.stringify(await(await req('/api/assistant/secrets')).json()).includes('runtime-gemini-api-key'),false);});
test('Gemini project control trusts the authenticated admin request without duplicate approval',async()=>{const stored=await(await req('/api/assistant/secrets',{provider:'gemini',name:'Runtime Gemini Control',secret:'runtime-gemini-control-key'})).json();await db.prepare("UPDATE ops_secret_vault SET status='verified',verification_json=? WHERE id=?").bind(JSON.stringify({models:['models/gemini-test']}),stored.item.id).run();const response=await req('/api/assistant/ai-providers/gemini',{secret_id:stored.item.id,model:'models/gemini-test',enabled:true,project_control:true});assert.equal(response.status,200,await response.clone().text());const configured=(await response.json()).item;assert.equal(configured.project_control,true);assert.equal(configured.approval_policy,'authenticated-admin-request');const listed=await(await req('/api/assistant/ai-providers')).json();const gemini=listed.items.find(item=>item.id==='gemini');assert.equal(gemini.project_control,true);assert.equal(gemini.approval_policy,'authenticated-admin-request');assert.equal(gemini.operator_policy.mode,'authenticated-admin-direct');assert.equal(gemini.operator_policy.direct_pc_execution,true);assert.deepEqual(gemini.operator_policy.workflow,['authenticated-request','bounded-action','pc-gateway','verified-receipt']);assert.deepEqual(gemini.allowed_actions,['read','write','edit','selfwrite','run','deploy','share','upload','upgrade','screenshot','open_app','notify','system_info','scrape','web_fetch','download','git_commit','git_pr']);});
test('provider diagnostics persist a safe last-check receipt for Settings',async()=>{const tested=await req('/api/ops/providers/test',{provider:'workers-ai'});assert.equal(tested.status,200,await tested.clone().text());const receipt=await tested.json();assert.equal(receipt.status,'verified');assert.equal(receipt.provider,'workers-ai');assert.ok(receipt.latency_ms>=0);const providers=await(await req('/api/assistant/ai-providers')).json();const workers=providers.items.find(item=>item.id==='workers-ai');assert.equal(workers.last_check.status,'verified');assert.equal(workers.last_check.error,null);assert.equal(JSON.stringify(workers).includes(key),false);});
test('admin wallet simulates deposits and payments without real money',async()=>{let wallet=await(await req('/api/assistant/wallet',{type:'deposit',amount:20,note:'runtime'})).json();assert.equal(wallet.balance,20);assert.equal(wallet.real_money,false);wallet=await(await req('/api/assistant/wallet',{type:'send',amount:5,recipient:'Test recipient'})).json();assert.equal(wallet.balance,15);assert.equal(wallet.transactions[0].status,'simulated');assert.equal((await req('/api/assistant/wallet',{type:'withdrawal',amount:100})).status,409);});
test('paper portfolio records simulated trades and rejects overselling',async()=>{const createdResponse=await req('/api/assistant/trading/portfolios',{name:'Runtime paper',base_currency:'EUR',starting_cash:10000,max_position_pct:20,max_drawdown_pct:15});assert.equal(createdResponse.status,201,await createdResponse.clone().text());const portfolio=await createdResponse.json();const bought=await req(`/api/assistant/trading/portfolios/${portfolio.id}/trades`,{symbol:'TEST',asset_type:'stock',side:'buy',quantity:10,price:100,fee:5,executed_at:'2026-10-06T10:00:00Z',thesis:'runtime',source:'test'});assert.equal(bought.status,201,await bought.clone().text());assert.equal((await bought.json()).summary.equity,9995);const quote=await req('/api/assistant/trading/quotes',{symbol:'TEST',currency:'EUR',price:110,as_of:'2026-10-06T11:00:00Z',source:'test'});assert.equal(quote.status,200);const read=await(await req('/api/assistant/trading/portfolios/'+portfolio.id)).json();assert.equal(read.summary.equity,10095);assert.equal(read.summary.paper_only,true);const oversell=await req(`/api/assistant/trading/portfolios/${portfolio.id}/trades`,{symbol:'TEST',asset_type:'stock',side:'sell',quantity:11,price:110,fee:0,executed_at:'2026-10-06T12:00:00Z',thesis:'runtime',source:'test'});assert.equal(oversell.status,409);});
test('image plugin creates and serves a private image artifact',async()=>{const result=await(await req('/api/ops/plugins/images/test',{})).json();assert.equal(result.status,'verified');assert.match(result.details.url,/\/api\/assistant\/media\/images\//);const image=await req(result.details.url);assert.equal(image.status,200);assert.match(image.headers.get('content-type'),/image\/jpeg/);});
test('Trinity 2 multimodal and voice APIs return verified results',async()=>{
  const vision=await req('/api/assistant/media/analyze-image',{image:'data:image/png;base64,aGVsbG8=',prompt:'Čo je na obrázku?'});assert.equal(vision.status,200,await vision.clone().text());assert.equal((await vision.json()).text,'TEST_MODEL_RESULT');
  const transcript=await req('/api/assistant/media/transcribe',{audio:'data:audio/webm;base64,aGVsbG8=',language:'sk'});assert.equal(transcript.status,200,await transcript.clone().text());assert.equal((await transcript.json()).text,'test voice transcript');
  const speech=await req('/api/assistant/media/speech',{text:'Ahoj Trinity',language:'sk'});assert.equal(speech.status,200,await speech.clone().text());const speechData=await speech.json();assert.match(speechData.url,/\/api\/assistant\/media\/audio\//);const audio=await req(speechData.url);assert.equal(audio.status,200);assert.match(audio.headers.get('content-type'),/audio\/mpeg/);
});
test('Trinity 2 granular RBAC, workflows, incidents and audit export are persistent',async()=>{
  let rbac=await(await req('/api/assistant/rbac')).json();assert.ok(rbac.items.find(item=>item.role==='user').permissions.find(item=>item.capability==='execute_pc').allowed===false);
  rbac=await(await req('/api/assistant/rbac',{role:'user',capability:'analyze_image',allowed:false})).json();assert.equal(rbac.permissions.find(item=>item.capability==='analyze_image').allowed,false);
  const workflow=await req('/api/assistant/workflows',{name:'Test workflow',status:'active',definition:{nodes:[{id:'input-1',type:'input',label:'Vstup',x:10,y:10},{id:'output-1',type:'output',label:'Výstup',x:200,y:10}],edges:[{from:'input-1',to:'output-1'}]}});assert.equal(workflow.status,201,await workflow.clone().text());const listed=await(await req('/api/assistant/workflows')).json();assert.ok(listed.items.some(item=>item.name==='Test workflow'));
  await db.prepare("INSERT INTO ops_incidents(id,fingerprint,severity,title,details_json) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),'runtime:test','warning','Runtime incident','{}').run();const incidents=await(await req('/api/assistant/incidents')).json();assert.ok(incidents.items.some(item=>item.title==='Runtime incident'));
  const audit=await req('/api/assistant/audit/export?format=csv');assert.equal(audit.status,200);assert.match(audit.headers.get('content-type'),/text\/csv/);assert.match(await audit.text(),/role_permission_changed/);
});
test('authenticated admin commands execute directly while agent proposals still require approval',async()=>{
  assert.equal((await req('/api/system/capabilities',undefined,false)).status,401);
  const untrusted=await createSystemAction({DB:db},{action:'write',payload:{path:'Trinity/untrusted.txt',content:'no'},rationale:'agent proposal test'},'agent:trinity',{adminAuthorized:true});
  assert.equal(untrusted.status,'proposed');
  const createResponse=await req('/api/system/actions',{action:'write',payload:{path:'Trinity/example.txt',expected_sha256:'absent',content:'hello'},rationale:'runtime test'});const createText=await createResponse.text();assert.equal(createResponse.status,201,createText);const created=JSON.parse(createText);
  assert.equal(created.action.status,'approved');assert.match(created.action.approved_by,/^admin:user:/);const id=created.action.id;
  let claim=await(await req('/api/system/actions/claim',{},false,{Authorization:'Bearer '+gatewayKey})).json();assert.equal(claim.action.id,id);assert.equal(claim.action.status,'claimed');
  const receipt={action:'write',path:'Trinity/example.txt',after_sha256:'abc'};
  const finished=await(await req(`/api/system/actions/${id}/receipt`,{status:'completed',receipt},false,{Authorization:'Bearer '+gatewayKey})).json();assert.equal(finished.action.status,'completed');assert.deepEqual(finished.action.receipt,receipt);
});
test('expired claimed actions are closed as failed instead of remaining stuck',async()=>{const created=await(await req('/api/system/actions',{action:'read',payload:{path:'Trinity/package.json'},rationale:'expiry recovery test'})).json();await db.prepare("UPDATE ops_system_actions SET status='claimed',claimed_by='old-gateway',lease_until=0,expires_at=0 WHERE id=?").bind(created.action.id).run();const claim=await(await req('/api/system/actions/claim',{},false,{Authorization:'Bearer '+gatewayKey})).json();assert.equal(claim.action,null);const recovered=await(await req('/api/system/actions/'+created.action.id)).json();assert.equal(recovered.action.status,'failed');assert.match(recovered.action.error,/vypršala/);});
test('durable job completes, stores artifact, and deduplicates',async()=>{const data={task:'Runtime verification',team:['planner','writer','qa'],idempotency_key:crypto.randomUUID()};const r=await req('/api/ops/jobs',data);assert.equal(r.status,202);const job=await r.json();const duplicate=await(await req('/api/ops/jobs',data)).json();assert.equal(duplicate.id,job.id);assert.equal(duplicate.reused,true);let done;for(let i=0;i<100;i++){done=await(await req('/api/ops/jobs/'+job.id)).json();if(['completed','failed'].includes(done.status))break;await new Promise(r=>setTimeout(r,200));}assert.equal(done.status,'completed',JSON.stringify(done));assert.equal(done.steps.length,3);assert.equal(done.result,'TEST_MODEL_RESULT');const artifact=await req('/api/ops/jobs/'+job.id+'/artifact');assert.equal(artifact.status,200);assert.match(await artifact.text(),/TEST_MODEL_RESULT/);});
test('workflow records and skips one failed specialist while later steps continue',async()=>{const r=await req('/api/ops/jobs',{task:'FAIL_PLANNER',team:['planner','writer','qa'],idempotency_key:crypto.randomUUID()});assert.equal(r.status,202);const job=await r.json();let done;for(let i=0;i<120;i++){done=await(await req('/api/ops/jobs/'+job.id)).json();if(['completed','failed'].includes(done.status))break;await new Promise(resolve=>setTimeout(resolve,200));}assert.equal(done.status,'completed',JSON.stringify(done));assert.equal(done.steps.find(step=>step.agent_id==='planner').status,'failed');assert.equal(done.steps.find(step=>step.agent_id==='writer').status,'completed');assert.equal(done.result,'TEST_MODEL_RESULT');});
test('MCP initializes and exposes five working tools',async()=>{const headers={Accept:'application/json, text/event-stream'};const r=await req('/mcp',{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}}},true,headers);assert.equal(r.status,200,await r.clone().text());const list=await req('/mcp',{jsonrpc:'2.0',id:2,method:'tools/list',params:{}},true,headers);const text=await list.text();assert.equal(list.status,200,text);assert.match(text,/dispatch_task/);assert.match(text,/search_memory/);const call=await req('/mcp',{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'list_agents',arguments:{}}},true,headers);assert.equal(call.status,200);assert.match(await call.text(),/orchestrator/);});



test('MCP status checks real readiness without claiming PC access or admin identity',async()=>{
  const response=await req('/mcp',{jsonrpc:'2.0',id:99,method:'tools/call',params:{name:'trinity_status',arguments:{}}},true,{Accept:'application/json, text/event-stream'});
  assert.equal(response.status,200);
  const text=await response.text();
  const message=text.trim().startsWith('{')?JSON.parse(text):text.split('\n').filter(s=>s.startsWith('data:')).map(s=>JSON.parse(s.slice(5).trim())).find(s=>s.result?.content);
  const status=JSON.parse(message.result.content.find(s=>s.type==='text').text);
  assert.equal(status.ready,true);assert.equal(status.service,'trinity');
  assert.equal(status.pc_access,'not-checked');assert.ok(status.plugins.enabled>0);
  assert.equal('admin' in status,false);assert.ok(status.checked_at);
  assert.equal((await req('/mcp',{jsonrpc:'2.0',id:100,method:'tools/call',params:{name:'trinity_status',arguments:{}}},false)).status,401);
});

test('memory search masks credential-like text without deleting the stored note',async()=>{
  const value='Documentation example: Bearer abcdefghijklmnopqrstuvwxyz and api_key=private-test-value';
  const created=await req('/api/ops/memory',{key:'unit-memory-redaction',value});assert.equal(created.status,200);
  const answer=await(await req('/api/ops/memory?q=unit-memory-redaction')).json();
  const record=answer.records.find(r=>r.key==='unit-memory-redaction');assert.ok(record);
  assert.ok(record.value.includes('[redacted]'));assert.ok(!record.value.includes('private-test-value'));assert.ok(!record.value.includes('abcdefghijklmnopqrstuvwxyz'));
  assert.equal((await db.prepare("SELECT value FROM ops_memory WHERE key='unit-memory-redaction'").first()).value,value);
});

test('read-only MCP token can inspect readiness but cannot access private admin API',async()=>{
  const created=(await(await req('/api/assistant/api-keys',{name:'Read-only MCP status test',scopes:['mcp:read'],rate_limit_per_minute:30,expires_at:null})).json()).key;
  const response=await mf.dispatchFetch(url+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+created.secret,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:101,method:'tools/call',params:{name:'trinity_status',arguments:{}}})});
  assert.equal(response.status,200);assert.ok((await response.text()).includes('not-checked'));
  assert.equal((await mf.dispatchFetch(url+'/api/ops/status',{headers:{Authorization:'Bearer '+created.secret}})).status,401);
});

test('Trinity OS: /api/os/status a /api/os/processes vracia stav jadra a zoznam procesov',async()=>{
  const statusRes=await req('/api/os/status');
  assert.equal(statusRes.status,200);
  const statusData=await statusRes.json();
  assert.equal(statusData.os_name,'Trinity Cognitive Cloud OS');
  assert.equal(statusData.kernel_version,'11.0.0-cloud-kernel');
  assert.ok(statusData.telemetry);
  assert.ok(statusData.storage);
  assert.ok(statusData.processes);

  const procRes=await req('/api/os/processes');
  assert.equal(procRes.status,200);
  const procData=await procRes.json();
  assert.ok(Array.isArray(procData.tasks));
  assert.ok(Array.isArray(procData.jobs));
});


test('MCP App exposes a bundled view and useful text fallback',async()=>{
 const headers={Accept:'application/json, text/event-stream'};
 const tools=await req('/mcp',{jsonrpc:'2.0',id:201,method:'tools/list',params:{}},true,headers);assert.match(await tools.text(),/trinity_control_panel/);
 const resource=await req('/mcp',{jsonrpc:'2.0',id:202,method:'resources/read',params:{uri:'ui://trinity/control.html'}},true,headers);
 assert.equal(resource.status,200);const text=await resource.text();assert.match(text,/text\/html;profile=mcp-app/);assert.match(text,/Trinity Control/);assert.match(text,/infrastructure_status/);
 const result=await req('/mcp',{jsonrpc:'2.0',id:203,method:'tools/call',params:{name:'trinity_control_panel',arguments:{}}},true,headers);assert.equal(result.status,200);assert.match(await result.text(),/configured/);
});
test('infrastructure APIs require auth and reject unconfirmed purchases',async()=>{
 assert.equal((await req('/api/assistant/infrastructure',undefined,false)).status,401);
 const status=await(await req('/api/assistant/infrastructure')).json();assert.equal(status.evolution.configured,false);assert.equal(status.web.pc_required,false);
 const purchase=await req('/api/assistant/domains/register',{domain_name:'unconfirmed.test',live_register:true});assert.equal(purchase.status,400);assert.match(await purchase.text(),/max_price/);
 const inventory=await req('/api/assistant/hosting');assert.equal(inventory.status,200);assert.deepEqual((await inventory.json()).items,[]);
});


test('daily planner MCP workflow authenticates, deduplicates, finishes and stores its artifact',async()=>{
  const headers={Accept:'application/json, text/event-stream'};
  const args={date:'2026-10-22',tasks:[{title:'Rozpočet',minutes:60,priority:'high'},{title:'Nákup',minutes:30}],available_minutes:75,idempotency_key:crypto.randomUUID()};
  const body={jsonrpc:'2.0',id:11,method:'tools/call',params:{name:'create_daily_plan',arguments:args}};
  assert.equal((await req('/mcp',body,false,headers)).status,401);
  async function rpc(message){
    const response=await req('/mcp',message,true,headers);const text=await response.text();
    assert.equal(response.status,200,text);
    const payload=response.headers.get('content-type')?.includes('text/event-stream')?JSON.parse(text.split('\n').find(line=>line.startsWith('data:')).slice(5)):JSON.parse(text);
    assert.equal(payload.error,undefined,JSON.stringify(payload));
    assert.ok(!payload.result.isError,JSON.stringify(payload));
    return JSON.parse(payload.result.content[0].text);
  }
  const job=await rpc(body);assert.equal(job.status,'queued');
  const duplicate=await rpc({...body,id:12});assert.equal(duplicate.id,job.id);assert.equal(duplicate.reused,true);
  let done;
  for(let i=0;i<100;i++){
    done=await rpc({jsonrpc:'2.0',id:13,method:'tools/call',params:{name:'get_task',arguments:{id:job.id}}});
    if(['completed','failed'].includes(done.status))break;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert.equal(done.status,'completed',JSON.stringify(done));assert.equal(done.provider,'workers-ai');
  assert.deepEqual(done.team,['planner']);assert.equal(done.result,'TEST_MODEL_RESULT');
  const artifact=await req('/api/ops/jobs/'+job.id+'/artifact');assert.equal(artifact.status,200);
  assert.match(await artifact.text(),/TEST_MODEL_RESULT/);
});




test('Revolut Pro owner config publishes a live-link route without giving ordinary users privileges',async()=>{
  const config={products:[{id:'service',name:'Service',amount_cents:2500,currency:'EUR',payment_url:'https://pay.revolut.com/example'}]};
  assert.equal((await req('/api/assistant/revolut/status',undefined,false)).status,401);
  const session=await issueSession({DB:db},Date.now()+60000,'ordinary-user@example.test');
  const cookie=session.headers.get('set-cookie').split(';')[0];
  assert.equal((await req('/api/assistant/revolut/pro/products',config,false,{Cookie:cookie})).status,403);
  assert.equal((await req('/api/assistant/revolut/status',undefined,false,{Cookie:cookie})).status,403);
  const saved=await req('/api/assistant/revolut/pro/products',config);assert.equal(saved.status,200,await saved.clone().text());
  assert.equal((await saved.json()).configured,true);
  const list=await req('/api/payments/revolut-pro',undefined,false);assert.equal(list.status,200);
  const result=await list.json();assert.equal(result.products[0].amount_cents,2500);assert.equal(result.payment_status,'not_checked');
  const redirect=await mf.dispatchFetch(url+'/pay/revolut-pro/service',{redirect:'manual'});assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),config.products[0].payment_url);
  const status=await(await req('/api/assistant/revolut/status')).json();assert.equal(status.mode,'live-payment-links');assert.equal(status.bank_account_connected,false);assert.equal(status.automatic_payment_verification,false);
});

test('Unified Commerce & PayPal owner routes configure accounts, offers, and public catalog safely',async()=>{
  assert.equal((await req('/api/assistant/commerce/status',undefined,false)).status,401);
  const accSaved=await req('/api/assistant/commerce/accounts',{
    business_name:'Trinity Studio SK',
    revolut_url:'https://revolut.me/trinitysk',
    paypal_url:'https://paypal.me/trinitysk',
    default_currency:'EUR',
    note:'Platba na základe dohody'
  });
  assert.equal(accSaved.status,200,await accSaved.clone().text());
  const prodSaved=await req('/api/assistant/commerce/products',{
    provider:'paypal',
    product:{
      id:'web-balicek',
      name:'Tvorba webu na kľúč',
      description:'Kompletný web z AI Studia',
      amount_cents:49000,
      currency:'EUR',
      payment_url:'https://www.paypal.com/paypalme/trinitysk/490',
      active:true,
      expires_at:null
    }
  });
  assert.equal(prodSaved.status,200,await prodSaved.clone().text());
  const catalog=await(await req('/api/payments/catalog',undefined,false)).json();
  assert.equal(catalog.business_name,'Trinity Studio SK');
  assert.equal(catalog.bank_account_connected,false);
  assert.equal(catalog.automatic_payment_verification,false);
  assert.ok(catalog.products.some(p=>p.id==='web-balicek'&&p.provider==='paypal'));
  const ppRedirect=await mf.dispatchFetch(url+'/pay/paypal/web-balicek',{redirect:'manual'});
  assert.equal(ppRedirect.status,302);
  assert.equal(ppRedirect.headers.get('location'),'https://www.paypal.com/paypalme/trinitysk/490');

  const personalSaved=await req('/api/assistant/commerce/accounts',{
    business_name:'Ivan Sabo',
    account_type:'personal',
    paypal_identifier:'saboivan2008@gmail.com',
    paypal_url:'saboivan2008@gmail.com',
    revolut_url:'',
    default_currency:'EUR',
    note:'Osobný PayPal účet (fyzická osoba)',
    auto_generate_offers:true
  });
  assert.equal(personalSaved.status,200,await personalSaved.clone().text());
  const personalBody=await personalSaved.json();
  assert.ok(personalBody.products.some(p=>p.id==='web-na-kluc'&&p.provider==='paypal'));

  const checkoutPage=await req('/pay/checkout/web-na-kluc',undefined,false);
  assert.equal(checkoutPage.status,200);
  const checkoutHtml=await checkoutPage.text();
  assert.match(checkoutHtml,/Zaplatiť 490\.00 € cez PayPal/);
  assert.match(checkoutHtml,/Osobný účet/);

  const html=await(await req('/',undefined,false)).text();
  assert.match(html,/id="settings-commerce-panel"/);
  assert.match(html,/id="domain-marketplace-panel"/);
  assert.match(html,/id="settings-ui-evolution-panel"/);
  assert.match(html,/id="domain-environments-panel"/);
  assert.match(html,/id="documents-view"/);
});

test('Live UI Evolution modifies theme.css dynamically, supports rollback, and creates Trinity Documents',async()=>{
  const evoRes=await req('/api/assistant/ui-evolution',{
    preset:'cyber-gold',
    brand_title:'Trinity 10.3 Gold',
    welcome_heading:'Vitaj v zlatej edícii Trinity',
    add_widget:{title:'Denný cieľ',content:'3 nové domény v produkcii',badge:'LIVE'},
    custom_css:'.hero-card { border-width: 2px; }'
  });
  assert.equal(evoRes.status,200,await evoRes.clone().text());
  const evoBody=await evoRes.json();
  assert.equal(evoBody.ok,true);
  assert.equal(evoBody.state.preset,'cyber-gold');
  assert.ok(evoBody.change?.id);

  const themeRes=await req('/theme.css',undefined,false);
  assert.equal(themeRes.status,200);
  const cssText=await themeRes.text();
  assert.match(cssText,/TRINITY SELF-EVOLVING UI LAYER/);
  assert.match(cssText,/#f59e0b/);

  const changesRes=await req('/api/assistant/changes');
  assert.equal(changesRes.status,200);
  const changes=await changesRes.json();
  assert.ok(changes.length>=1);

  const rbRes=await req(`/api/assistant/changes/${changes[0].id}/rollback`,{confirm:true});
  assert.equal(rbRes.status,200,await rbRes.clone().text());
});

test('Cloudflare-style Domain Environments provision domains, deploy live sites, and generate Trinity Documents',async()=>{
  const provRes=await req('/api/assistant/domains/environments/provision',{
    domain_name:'trinity-cloud-demo.sk',
    template:'ai_saas',
    title:'Trinity Cloud Demo',
    subtitle:'Automatizovaná produkcia v štýle Cloudflare',
    ssl_mode:'strict'
  });
  assert.equal(provRes.status,201,await provRes.clone().text());
  const prov=await provRes.json();
  assert.equal(prov.ok,true);
  assert.equal(prov.control_plane.domain_name,'trinity-cloud-demo.sk');
  assert.equal(prov.control_plane.environments.production.status,'deployed');

  const liveSite=await req('/sites/trinity-cloud-demo.sk/production',undefined,false);
  assert.equal(liveSite.status,200);
  const siteHtml=await liveSite.text();
  assert.match(siteHtml,/Trinity Cloud Demo/);
  assert.match(siteHtml,/PRODUCTION/);

  const deployStaging=await req('/api/assistant/domains/environments/deploy',{
    domain_name:'trinity-cloud-demo.sk',
    environment:'staging',
    template:'ecommerce_checkout',
    title:'Trinity Staging Store'
  });
  assert.equal(deployStaging.status,200,await deployStaging.clone().text());
  const stagingSite=await req('/sites/trinity-cloud-demo.sk/staging',undefined,false);
  assert.equal(stagingSite.status,200);
  assert.match(await stagingSite.text(),/Trinity Staging Store/);

  const docsRes=await req('/api/assistant/documents');
  assert.equal(docsRes.status,200);
  const docs=await docsRes.json();
  assert.ok(docs.items.length>=2);
  const firstId=docs.items[0].id;
  const mdExport=await req(`/api/assistant/documents/${firstId}/export?format=md`);
  assert.equal(mdExport.status,200);
  assert.match(await mdExport.text(),/Trinity/);
  const pdfExport=await req(`/api/assistant/documents/${firstId}/export?format=pdf`);
  assert.equal(pdfExport.status,200);
  assert.equal(pdfExport.headers.get('content-type'),'application/pdf');
});

test('Autonomous Commodity Desk analyzes all 22 commodities, connects real banks/brokers (SEPA EPC QR & Vault), executes buy/sell trades, and runs autonomous investment cycles',async()=>{
  const bankCreate=await req('/api/assistant/commodities/banks',{
    provider:'slsp_george',
    account_name:'Trinity Capital s.r.o.',
    iban:'SK8975000000000012345671',
    bic:'GIBASKBX',
    is_default:true,
    auto_execute:false
  });
  assert.equal(bankCreate.status,201,await bankCreate.clone().text());
  const bankBody=await bankCreate.json();
  assert.equal(bankBody.ok,true);
  assert.equal(bankBody.connection.provider,'slsp_george');

  const overviewRes=await req('/api/assistant/commodities/overview');
  assert.equal(overviewRes.status,200,await overviewRes.clone().text());
  const overview=await overviewRes.json();
  assert.equal(overview.ok,true);
  assert.equal(overview.market.total_commodities,22);
  assert.ok(overview.market.top_buys.length>=1);
  assert.ok(overview.bank_connections.length>=1);

  const buyRes=await req('/api/assistant/commodities/trade',{
    symbol:'XAU-EUR',
    side:'buy',
    amount_eur:2000,
    thesis:'Nákup zlata na zaistenie portfólia'
  });
  assert.equal(buyRes.status,201,await buyRes.clone().text());
  const buyBody=await buyRes.json();
  assert.equal(buyBody.ok,true);
  assert.equal(buyBody.trade.symbol,'XAU-EUR');
  assert.ok(buyBody.document_id);
  assert.equal(buyBody.execution_mode,'bank_sepa_settlement');
  assert.match(buyBody.bank_settlement.sepa_epc_qr_payload,/^BCD\n002/);

  const sellRes=await req('/api/assistant/commodities/trade',{
    symbol:'XAU-EUR',
    side:'sell',
    sell_all:true,
    price:2710,
    thesis:'Realizácia zisku na zlate'
  });
  assert.equal(sellRes.status,201,await sellRes.clone().text());
  const sellBody=await sellRes.json();
  assert.equal(sellBody.ok,true);
  assert.ok(sellBody.portfolio_summary.realized_pnl>0);

  const autoRes=await req('/api/assistant/commodities/auto-invest',{
    strategy:'growth',
    budget_eur:2500,
    max_trades:3
  });
  assert.equal(autoRes.status,200,await autoRes.clone().text());
  const autoBody=await autoRes.json();
  assert.equal(autoBody.ok,true);
  assert.ok(autoBody.trades_executed.length>=1);
  assert.ok(autoBody.document_id);
});
