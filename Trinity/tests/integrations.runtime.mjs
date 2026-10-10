import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
let mf,db;const key='test-only-not-a-real-secret-123456789';const gatewayKey='test-only-gateway-secret-123456789012345';
const url='https://trinity.test';
async function req(path,body,auth=true,extra={}){return mf.dispatchFetch(url+path,{method:body===undefined?'GET':'POST',headers:{...(auth?{Authorization:'Bearer '+key}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},body:body===undefined?undefined:JSON.stringify(body)});}
before(async()=>{
  const modules=readdirSync('dist-integrations').filter(x=>!x.endsWith('.map')&&!x.endsWith('.md')).map(name=>({type:name==='integrations-entry.js'?'ESModule':'Text',path:resolve('dist-integrations',name)}));
  modules.sort((a,b)=>a.type==='ESModule'?-1:b.type==='ESModule'?1:0);
  mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'trinity',modules,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],bindings:{TRINITY_OPS_KEY:key,TRINITY_GATEWAY_KEY:gatewayKey},d1Databases:{DB:'test-db'},r2Buckets:{ARTIFACTS:'test-r2'},
    serviceBindings:{INTEGRATIONS_SERVICE:'integrations',KNOWLEDGE_SERVICE:'knowledge',AI:{name:'mock',entrypoint:'MockAI'}},workflows:{OPS_WORKFLOW:{name:'test-workflow',className:'TrinityOperations'}}},
    {name:'integrations',compatibilityDate:'2026-10-01',modules:true,script:readFileSync('../Integrations-Worker/dist/index.js','utf8'),bindings:{FIREBASE_PROJECT_ID:'morfeus-ac7ed'}},
    {name:'knowledge',compatibilityDate:'2026-10-01',modules:true,script:readFileSync('../Knowledge-Worker/dist/index.js','utf8'),durableObjects:{KNOWLEDGE:{className:'KnowledgeStore',useSQLite:true}}},
    {name:'mock',modules:true,compatibilityDate:'2026-10-01',script:`import {WorkerEntrypoint} from 'cloudflare:workers'; export class MockAI extends WorkerEntrypoint{async run(model,args){if(model.includes('flux'))return {image:btoa('mock-jpeg')};const prompt=args.messages.at(-1).content;if(prompt==='FAIL_TEST')throw new Error('Simulated failure');if(prompt.includes('STUDIO_TEST')){const revised=prompt.includes('STUDIO_TEST_REVISION');return {response:'<!doctype html><html><head><title>Studio test</title></head><body><main><h1>'+(revised?'Revised':'Created')+'</h1></main></body></html>'};}return {response:'TEST_MODEL_RESULT'};}} export default {fetch(){return new Response('mock')}};`} ]}));
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


test('private integration worker reports configured project without false live success',async()=>{
 assert.equal((await req('/api/integrations/status',undefined,false)).status,401);
 const response=await req('/api/integrations/status');assert.equal(response.status,200,await response.clone().text());
 const status=await response.json();assert.equal(status.firebase.project,'morfeus-ac7ed');assert.equal(status.firebase.credentials_configured,false);assert.equal(status.firecrawl.live_verified,false);
 assert.equal((await (await mf.getWorker('integrations')).fetch('https://internal/')).status,404);
});
test('provider failures retain 503 through real service RPC',async()=>{
 assert.equal((await req('/api/integrations/firecrawl/scrape',{url:'https://firebase.google.com/docs/'})).status,503);
 assert.equal((await req('/api/integrations/firebase/publish',{})).status,503);
});
test('integration routes reject foreign origin and honor emergency stop',async()=>{
 assert.equal((await req('/api/integrations/firebase/publish',{},true,{Origin:'https://evil.test'})).status,403);
 await db.prepare('UPDATE ops_control SET emergency_stop=1 WHERE id=1').run();
 assert.equal((await req('/api/integrations/firebase/publish',{})).status,503);
 await db.prepare('UPDATE ops_control SET emergency_stop=0 WHERE id=1').run();
 assert.equal((await req('/health',undefined,false)).status,200);
});
