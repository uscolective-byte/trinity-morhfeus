import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {syncSharedNotes} from '../src/shared-notes.js';

let mf,db;
const key='test-only-ecosystem-secret-key-12345';
const url='https://trinity.test';

async function req(path,body,auth=true,extra={}){
  return mf.dispatchFetch(url+path,{
    method:body===undefined?'GET':'POST',
    headers:{
      ...(auth?{Authorization:'Bearer '+key}:{}),
      ...(body===undefined?{}:{'Content-Type':'application/json'}),
      ...extra
    },
    body:body===undefined?undefined:JSON.stringify(body)
  });
}

before(async()=>{
  const modules=readdirSync('dist').filter(x=>!x.endsWith('.map')&&!x.endsWith('.md')).map(name=>({
    type:name==='index.js'?'ESModule':'Text',
    path:resolve('dist',name)
  }));
  modules.sort((a,b)=>a.type==='ESModule'?-1:b.type==='ESModule'?1:0);

  mf=new Miniflare(convertV4MiniflareOptions({
    workers:[
      {
        name:'trinity',
        modules,
        compatibilityDate:'2026-10-01',
        compatibilityFlags:['nodejs_compat'],
        bindings:{
          CF_VERSION_METADATA:{id:'test-deployment',tag:'test-commit',timestamp:'2026-10-17T00:00:00.000Z'},
          TRINITY_OPS_KEY:key,
          TRINITY_VAULT_KEY:Buffer.alloc(32,7).toString('base64url')
        },
        d1Databases:{DB:'test-db'},
        r2Buckets:{ARTIFACTS:'test-r2'},
        serviceBindings:{AI:{name:'mock',entrypoint:'MockAI'}},
        workflows:{OPS_WORKFLOW:{name:'test-workflow',className:'TrinityOperations'}}
      },
      {
        name:'mock',
        modules:true,
        compatibilityDate:'2026-10-01',
        script:`import {WorkerEntrypoint} from 'cloudflare:workers';
          export class MockAI extends WorkerEntrypoint{
            async run(model,args){
              return {response:'MOCK_COPILOT_RESPONSE'};
            }
          }
          export default {fetch(){return new Response('mock')}};`
      }
    ]
  }));

  db=await mf.getD1Database('DB','trinity');
  await db.batch([
    db.prepare('CREATE TABLE audit_log(id INTEGER PRIMARY KEY,module TEXT NOT NULL,action TEXT NOT NULL,details TEXT)'),
    db.prepare('CREATE TABLE memory(id TEXT PRIMARY KEY,content TEXT)'),
    db.prepare('CREATE TABLE knowledge(id INTEGER PRIMARY KEY,topic TEXT,content TEXT)'),
    db.prepare('CREATE TABLE personality(id INTEGER PRIMARY KEY,trait TEXT,value TEXT)'),
    db.prepare('CREATE TABLE notes(id TEXT PRIMARY KEY,title TEXT,content TEXT)'),
    db.prepare('CREATE TABLE memory_long(key TEXT,value TEXT,category TEXT,importance INTEGER)'),
    db.prepare('CREATE TABLE projects(id TEXT,name TEXT,description TEXT,status TEXT,updated_at TEXT)'),
    db.prepare('CREATE TABLE tasks(id TEXT,title TEXT,status TEXT,assigned_agent TEXT,updated_at TEXT)')
  ]);

  for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort()){
    const sql=await (await import('node:fs/promises')).readFile(resolve('migrations',file),'utf-8');
    const statements=sql.split(/;\s*$/m).map(s=>s.trim()).filter(Boolean);
    for(const stmt of statements){
      await db.prepare(stmt).run();
    }
  }
});

after(async()=>{
  if(mf)await mf.dispose();
});

test('GET /api/ecosystem/stats returns live operational ecosystem metrics without authentication',async()=>{
  const res=await req('/api/ecosystem/stats',undefined,false);
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.status,'operational');
  assert.ok(data.domains_count>=15);
  assert.ok(data.active_apps>=10);
  assert.ok(data.active_skills>=20);
  assert.ok(data.infinite_scale_capacity>=1000000);
});

test('GET /api/ecosystem/domains returns all universal domains and application templates',async()=>{
  const res=await req('/api/ecosystem/domains',undefined,false);
  assert.equal(res.status,200);
  const data=await res.json();
  assert.ok(Array.isArray(data.domains));
  assert.ok(Array.isArray(data.templates));
  assert.ok(data.domains.some(d=>d.id==='software-dev'));
  assert.ok(data.domains.some(d=>d.id==='cloud-devops'));
  assert.ok(data.templates.some(t=>t.templateId==='dashboard'));
});

test('GET & POST /api/ecosystem/search finds relevant components across the catalog',async()=>{
  const resGet=await req('/api/ecosystem/search?q=Analytics&type=app');
  assert.equal(resGet.status,200);
  const dataGet=await resGet.json();
  assert.ok(dataGet.apps.length>0);

  const resPost=await req('/api/ecosystem/search',{query:'audit',type:'skill'});
  assert.equal(resPost.status,200);
  const dataPost=await resPost.json();
  assert.ok(dataPost.skills.length>0);
});

test('POST /api/ecosystem/synthesize/skill generates and registers a new dynamic skill',async()=>{
  const res=await req('/api/ecosystem/synthesize/skill',{
    name:'DataQualityChecker',
    domain:'data-science'
  });
  assert.equal(res.status,201);
  const data=await res.json();
  assert.equal(data.name,'DataQualityChecker');
  assert.equal(data.domain,'data-science');
  assert.equal(data.synthesized,true);
  assert.equal(data.id,'skill_dataqualitychecker');
});

test('POST /api/ecosystem/synthesize/plugin bundles skills into an active plugin manifest',async()=>{
  const res=await req('/api/ecosystem/synthesize/plugin',{
    name:'DevOpsAutomator',
    domain:'cloud-devops',
    skills:['DeployVerifier','LogAnalyzer']
  });
  assert.equal(res.status,201);
  const data=await res.json();
  assert.equal(data.name,'DevOpsAutomator');
  assert.equal(data.domain,'cloud-devops');
  assert.equal(data.enabled,true);
  assert.ok(data.skills.includes('skill_deployverifier'));
});

test('POST /api/ecosystem/synthesize/app creates an interactive application blueprint',async()=>{
  const res=await req('/api/ecosystem/synthesize/app',{
    name:'CyberThreatMatrix',
    domain:'cybersecurity',
    type:'tool'
  });
  assert.equal(res.status,201);
  const data=await res.json();
  assert.equal(data.name,'CyberThreatMatrix');
  assert.equal(data.domain,'cybersecurity');
  assert.equal(data.status,'ready');
});

test('GET /api/copilot/plugins & /api/copilot/skills returns registered registries',async()=>{
  const pluginsRes=await req('/api/copilot/plugins');
  assert.equal(pluginsRes.status,200);
  const pluginsData=await pluginsRes.json();
  assert.ok(Array.isArray(pluginsData.plugins));
  assert.ok(pluginsData.plugins.length>=7);

  const skillsRes=await req('/api/copilot/skills');
  assert.equal(skillsRes.status,200);
  const skillsData=await skillsRes.json();
  assert.ok(Array.isArray(skillsData.skills));
  assert.ok(skillsData.skills.length>=20);
});

test('POST /api/copilot/chat executes reasoning and skill execution through TrinityCopilotAgent',async()=>{
  const res=await req('/api/copilot/chat',{
    message:'Ahoj, otestuj integrovany copilot chat',
    options:{noCache:true}
  });
  assert.equal(res.status,200);
  const data=await res.json();
  assert.ok(data.content);
  assert.ok(data.type);
  assert.ok(data.request_id);
  assert.ok(typeof data.duration_ms==='number');
});

test('shared cloud notes use revision checks, mirror recall and preserve tombstones',async()=>{
 const id=crypto.randomUUID();
 const first=await syncSharedNotes({DB:db},{changes:[{id,text:'shared local note',base_revision:0}]});
 assert.equal(first.accepted[0].revision,1);
 assert.equal((await db.prepare('SELECT value FROM ops_memory WHERE key=?').bind('shared/'+id).first()).value,'shared local note');
 const conflict=await syncSharedNotes({DB:db},{changes:[{id,text:'overwrite without revision',base_revision:0}]});
 assert.equal(conflict.conflicts[0].current.text,'shared local note');
 const update=await syncSharedNotes({DB:db},{changes:[{id,text:'updated',base_revision:1}]});
 assert.equal(update.accepted[0].revision,2);
 const removed=await syncSharedNotes({DB:db},{changes:[{id,text:'updated',deleted:true,base_revision:2}]});
 assert.equal(removed.accepted[0].deleted,true);
 assert.equal(await db.prepare('SELECT value FROM ops_memory WHERE key=?').bind('shared/'+id).first(),null);
});

test('public Copilot options cannot select executable skills or override identity',async()=>{
  for(const options of [{skill:'pcRunScript'},{userId:'another-owner'},{maxTokens:999999}]){
    const response=await req('/api/copilot/chat',{message:'test public boundary',options});
    assert.equal(response.status,400);
  }
});

test('installed diagnostics plugin is executable and disabling it blocks the skill endpoint',async()=>{
  const path='/api/copilot/skills/integrationReadiness/execute';
  let response=await req(path,{input:{}});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.result.live_verified,false);
  assert.ok(data.result.items.some(item=>item.id==='gemini'));
  const toggle='/api/copilot/plugins/integration-diagnostics/toggle';
  assert.equal((await req(toggle,{enabled:false})).status,200);
  try{assert.equal((await req(path,{input:{}})).status,500);}
  finally{await req(toggle,{enabled:true});}
});

test('MCP exposes ecosystem and copilot tools for remote clients',async()=>{
  const headers={Accept:'application/json, text/event-stream'};
  
  // 1. Initialize MCP
  const initRes=await req('/mcp',{
    jsonrpc:'2.0',
    id:1,
    method:'initialize',
    params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'eco-test',version:'1'}}
  },true,headers);
  assert.equal(initRes.status,200);

  // 2. Call ecosystem_stats
  const statsRes=await req('/mcp',{
    jsonrpc:'2.0',
    id:2,
    method:'tools/call',
    params:{name:'ecosystem_stats',arguments:{}}
  },true,headers);
  assert.equal(statsRes.status,200);
  const statsText=await statsRes.text();
  assert.match(statsText,/domains_count/);
  assert.match(statsText,/infinite_scale_capacity/);

  // 3. Call synthesize_skill
  const synthRes=await req('/mcp',{
    jsonrpc:'2.0',
    id:3,
    method:'tools/call',
    params:{name:'synthesize_skill',arguments:{name:'McpLiveSkill',domain:'software-dev'}}
  },true,headers);
  assert.equal(synthRes.status,200);
  const synthText=await synthRes.text();
  assert.match(synthText,/skill_mcpliveskill/);
});
