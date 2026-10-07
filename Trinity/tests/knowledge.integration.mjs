import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
let mf,db;const key='test-only-not-a-real-secret-123456789';const gatewayKey='test-only-gateway-secret-123456789012345';
const url='https://trinity.test';
async function req(path,body,auth=true,extra={}){return mf.dispatchFetch(url+path,{method:body===undefined?'GET':'POST',headers:{...(auth?{Authorization:'Bearer '+key}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},body:body===undefined?undefined:JSON.stringify(body)});}
before(async()=>{
  const modules=readdirSync('dist-knowledge').filter(x=>!x.endsWith('.map')&&!x.endsWith('.md')).map(name=>({type:name==='knowledge-entry.js'?'ESModule':'Text',path:resolve('dist-knowledge',name)}));
  modules.sort((a,b)=>a.type==='ESModule'?-1:b.type==='ESModule'?1:0);
  mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:'trinity',modules,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],bindings:{TRINITY_OPS_KEY:key,TRINITY_GATEWAY_KEY:gatewayKey},d1Databases:{DB:'test-db'},r2Buckets:{ARTIFACTS:'test-r2'},
    serviceBindings:{KNOWLEDGE_SERVICE:'knowledge',AI:{name:'mock',entrypoint:'MockAI'}},workflows:{OPS_WORKFLOW:{name:'test-workflow',className:'TrinityOperations'}}},
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

test('authenticated knowledge imports reach existing memory and respect emergency stop',async()=>{
 assert.equal((await req('/api/knowledge/catalog',undefined,false)).status,401);
 const input={source_id:'project',title:'Project',text:'Integration milestone on Friday'};
 assert.equal((await req('/api/knowledge/import',input,true,{Origin:'https://evil.test'})).status,403);
 const imported=await req('/api/knowledge/import',input);assert.equal(imported.status,200,await imported.clone().text());
 assert.equal((await req('/api/knowledge/search?q='+ 'x'.repeat(301))).status,400);
 const found=await(await req('/api/knowledge/search?q=milestone')).json();assert.equal(found.passages[0].source_id,'project');
 const recalled=await(await req('/api/ops/memory?q=milestone')).json();assert.ok(recalled.records.some(r=>r.key==='knowledge/project'&&r.source==='knowledge'));
 await req('/api/ops/control',{emergency_stop:true,reason:'test'});
 assert.equal((await req('/api/knowledge/import',input)).status,503);
 await req('/api/ops/control',{emergency_stop:false,reason:'test complete'});
 assert.equal((await req('/api/knowledge/import',{...input,source_id:'../bad'})).status,400);
});
test('existing health and additive personality survive new entry',async()=>{
 assert.equal((await req('/health',undefined,false)).status,200);
 const profile=await(await req('/api/ops/memory?q=trinity-komunikacia-v2')).json();assert.ok(profile.records.some(r=>r.key==='profil/trinity-komunikacia-v2'));
});
