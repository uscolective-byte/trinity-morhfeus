import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
let mf,db;const key='test-only-not-a-real-secret-123456789';
const url='https://trinity.test';
async function req(path,body,auth=true,extra={}){return mf.dispatchFetch(url+path,{method:body===undefined?'GET':'POST',headers:{...(auth?{Authorization:'Bearer '+key}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},body:body===undefined?undefined:JSON.stringify(body)});}
before(async()=>{
  const modules=readdirSync('dist').filter(x=>!x.endsWith('.map')&&!x.endsWith('.md')).map(name=>({type:name==='index.js'?'ESModule':'Text',path:resolve('dist',name)}));
  modules.sort((a,b)=>a.type==='ESModule'?-1:b.type==='ESModule'?1:0);
  mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'trinity',modules,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],bindings:{TRINITY_OPS_KEY:key},d1Databases:{DB:'test-db'},r2Buckets:{ARTIFACTS:'test-r2'},
    serviceBindings:{AI:{name:'mock',entrypoint:'MockAI'}},workflows:{OPS_WORKFLOW:{name:'test-workflow',className:'TrinityOperations'}}},
    {name:'mock',modules:true,compatibilityDate:'2026-10-01',script:`import {WorkerEntrypoint} from 'cloudflare:workers'; export class MockAI extends WorkerEntrypoint{async run(model,args){if(args.messages.at(-1).content==='FAIL_TEST')throw new Error('Simulated failure');return {response:'TEST_MODEL_RESULT'};}} export default {fetch(){return new Response('mock')}};`} ]}));
  db=await mf.getD1Database('DB','trinity');
  await db.batch([
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
test('public UI and health, private APIs',async()=>{assert.equal((await req('/',undefined,false)).status,200);assert.equal((await (await req('/health',undefined,false)).json()).agents,40);assert.equal((await req('/api/ops/agents',undefined,false)).status,401);assert.equal((await req('/mcp',{},false)).status,401);});
test('login sets protected cookie and logout revokes it',async()=>{const r=await req('/api/ops/login',{key},false);assert.equal(r.status,200);const c=r.headers.get('set-cookie');assert.match(c,/HttpOnly/);assert.match(c,/Secure/);assert.match(c,/SameSite=Strict/);assert.equal((await req('/api/ops/status',undefined,false,{Cookie:c.split(';')[0]})).status,200);await req('/api/ops/logout',{},false,{Cookie:c.split(';')[0]});assert.equal((await req('/api/ops/status',undefined,false,{Cookie:c.split(';')[0]})).status,401);});
test('origin validation and unknown agent',async()=>{assert.equal((await req('/api/ops/jobs',{task:'hi'},true,{Origin:'https://evil.test'})).status,403);assert.equal((await req('/api/ops/jobs',{task:'hi',agent:'not-real'})).status,400);});
test('memory persists and parameterized queries resist SQL injection',async()=>{assert.equal((await req('/api/ops/memory',{key:'unit-memory',value:'unique-verified-value'})).status,200);const r=await(await req('/api/ops/memory?q=unique-verified-value')).json();assert.equal(r.records[0].value,'unique-verified-value');assert.equal((await req('/api/ops/memory?q='+encodeURIComponent("';DROP TABLE ops_jobs;--"))).status,200);assert.equal((await req('/api/ops/jobs')).status,200);});
test('legacy memories migrate without credential-like records',async()=>{const safe=await(await req('/api/ops/memory?q='+encodeURIComponent('stručné odpovede'))).json();assert.ok(safe.records.some(r=>r.source==='legacy:memory'));const unsafe=await(await req('/api/ops/memory?q='+encodeURIComponent('must not migrate'))).json();assert.equal(unsafe.records.length,0);const identity=await(await req('/api/ops/memory?q='+encodeURIComponent('jednu osobnú asistentku'))).json();assert.ok(identity.records.some(r=>r.key==='profil/trinity-identita'));});
test('persistent personality and truth profile are available',async()=>{const personality=await(await req('/api/ops/memory?q='+encodeURIComponent('nepredstiera biologické emócie'))).json();assert.ok(personality.records.some(r=>r.key==='profil/trinity-osobnost'));const status=await(await req('/api/assistant/status')).json();assert.equal(status.consciousness,false);assert.equal(status.truth_mode,'evidence-required');assert.equal(status.personality,'persistent');});
test('required plugins are actually installed and enabled',async()=>{const plugins=await(await req('/api/ops/plugins')).json();assert.equal(plugins.length,11);assert.ok(plugins.every(p=>p.installed&&p.enabled));assert.ok(plugins.some(p=>p.id==='truth'&&p.required));assert.ok(plugins.some(p=>p.id==='clock'&&p.tools.includes('current_time')));});
test('durable job completes, stores artifact, and deduplicates',async()=>{const data={task:'Runtime verification',team:['planner','writer','qa'],idempotency_key:crypto.randomUUID()};const r=await req('/api/ops/jobs',data);assert.equal(r.status,202);const job=await r.json();const duplicate=await(await req('/api/ops/jobs',data)).json();assert.equal(duplicate.id,job.id);assert.equal(duplicate.reused,true);let done;for(let i=0;i<100;i++){done=await(await req('/api/ops/jobs/'+job.id)).json();if(['completed','failed'].includes(done.status))break;await new Promise(r=>setTimeout(r,200));}assert.equal(done.status,'completed',JSON.stringify(done));assert.equal(done.steps.length,3);assert.equal(done.result,'TEST_MODEL_RESULT');const artifact=await req('/api/ops/jobs/'+job.id+'/artifact');assert.equal(artifact.status,200);assert.match(await artifact.text(),/TEST_MODEL_RESULT/);});
test('MCP initializes and exposes five working tools',async()=>{const headers={Accept:'application/json, text/event-stream'};const r=await req('/mcp',{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}}},true,headers);assert.equal(r.status,200,await r.clone().text());const list=await req('/mcp',{jsonrpc:'2.0',id:2,method:'tools/list',params:{}},true,headers);const text=await list.text();assert.equal(list.status,200,text);assert.match(text,/dispatch_task/);assert.match(text,/search_memory/);const call=await req('/mcp',{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'list_agents',arguments:{}}},true,headers);assert.equal(call.status,200);assert.match(await call.text(),/orchestrator/);});

