import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {readFileSync} from 'node:fs';
import {inspectChat,maintenanceStatus} from '../../Chat-Maintenance-Worker/src/maintenance.mjs';
import {chatPromptTools,directCalculation} from '../src/chat-prompt.js';
import {runAgent} from '../src/engine.js';
import {runTool,TOOL_HELP} from '../src/tools.js';
import {agentById} from '../src/registry.js';
import {PLUGINS} from '../src/plugins.js';

let mf,db;const now=Date.parse('2026-10-24T10:00:00Z');
before(async()=>{
  mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:{DB:'chat-tests'},compatibilityDate:'2026-10-01'}));
  db=await mf.getD1Database('DB');
  await db.batch([
    db.prepare('CREATE TABLE ops_jobs(id TEXT PRIMARY KEY,status TEXT,updated_at TEXT,created_at TEXT,result TEXT,error TEXT)'),
    db.prepare('CREATE TABLE ops_steps(job_id TEXT,status TEXT,error TEXT,updated_at TEXT)'),
    db.prepare('CREATE TABLE ops_memory(key TEXT PRIMARY KEY,value TEXT,source TEXT,updated_at TEXT)'),
    db.prepare(readFileSync('migrations/0047_chat_maintenance.sql','utf8'))
  ]);
});
after(async()=>{await mf?.dispose();});

test('maintainer reconciles terminated and stale jobs without replay and preserves broken replies',async()=>{
  for(const [id,status,updated,result] of [
    ['healthy','running','2026-10-24 09:50:00',null],
    ['stale','running','2026-10-24 09:00:00',null],
    ['terminal','running','2026-10-24 09:50:00',null],
    ['broken','completed','2026-10-24 09:50:00','!'.repeat(1000)]
  ])await db.prepare('INSERT INTO ops_jobs(id,status,updated_at,created_at,result) VALUES(?,?,?,?,?)').bind(id,status,updated,updated,result).run();
  const terminated=[];
  const workflow={get:async id=>({status:async()=>({status:id==='terminal'?'errored':'running'}),terminate:async()=>{terminated.push(id);}})};
  const env={PRODUCTION_DB:db,PRODUCTION_WORKFLOW:workflow};
  const report=await inspectChat(env,'production',{repair:true,now});
  assert.equal(report.repaired,2);
  assert.deepEqual(terminated,['stale']);
  assert.equal((await db.prepare("SELECT status FROM ops_jobs WHERE id='healthy'").first()).status,'running');
  assert.equal((await db.prepare("SELECT result FROM ops_jobs WHERE id='broken'").first()).result,'!'.repeat(1000));
  await inspectChat(env,'production',{repair:true,now});
  const status=await maintenanceStatus(env,'production');
  assert.equal(status.incidents.length,3);
  assert.equal(status.role.automatic_replay,false);
  await assert.rejects(inspectChat(env,'other',{repair:true,now}),/Invalid environment/);
});

test('a concurrent completed result wins over maintenance compare-and-set',async()=>{
  await db.prepare("INSERT INTO ops_jobs VALUES('racing','running','2026-10-24 09:00:00','2026-10-24 09:00:00',NULL,NULL)").run();
  const env={PRODUCTION_DB:db,PRODUCTION_WORKFLOW:{get:async()=>({status:async()=>({status:'errored'}),terminate:async()=>{}})}};
  env.PRODUCTION_WORKFLOW.get=async id=>({status:async()=>{
    if(id==='racing')await db.prepare("UPDATE ops_jobs SET status='completed',result='42' WHERE id='racing'").run();
    return {status:'errored'};
  }});
  await inspectChat(env,'production',{repair:true,now});
  assert.equal((await db.prepare("SELECT status FROM ops_jobs WHERE id='racing'").first()).status,'completed');
});

test('fast chat executes the actual calculator and keeps an execution receipt',async()=>{
  let calls=0,prompt;
  const env={AI:{run:async(model,args)=>{prompt=args.messages[0].content;calls++;return {response:calls===1?JSON.stringify({tool:'calculate',arguments:{operation:'add',values:[17,25]}}):'42'};}}};
  const result=await runAgent(env,'orchestrator','Napíš krátky prirodzený pozdrav po slovensky.','','fast');
  assert.equal(result.text,'42');
  assert.equal(result.tool_log[0].tool,'calculate');
  assert.equal(result.tool_log[0].status,'completed');
  assert.match(prompt,/tool_catalog/);
  assert.ok(chatPromptTools(agentById('orchestrator').tools,'domény',TOOL_HELP).length<=16);
});

test('explicit short arithmetic requests use calculator deterministically without model guessing',async()=>{
  let modelCalls=0;
  const env={AI:{run:async()=>{modelCalls++;throw new Error('model must not guess arithmetic');}}};
  const result=await runAgent(env,'orchestrator','Vypočítaj 19 × 23 pomocou kalkulačky a odpovedz iba výsledkom.','','fast');
  assert.equal(result.text,'437');assert.equal(result.tool_log[0].tool,'calculate');assert.equal(modelCalls,0);
  assert.deepEqual(directCalculation('19 × 23'),{operation:'multiply',values:[19,23]});
  assert.equal(directCalculation('Vypočítaj obrat firmy za Q3'),null);
});

test('tool catalog returns exact input schemas only for installed permitted tools',async()=>{
  const env={DB:{prepare:()=>({bind(){return this;},first:async()=>({installed:1,enabled:1}),all:async()=>({results:PLUGINS.filter(p=>['calculator','capabilities'].includes(p.id)).map(p=>({id:p.id,installed:1,enabled:1}))})})}};
  const catalog=await runTool(env,agentById('orchestrator'),'tool_catalog',{query:'calculate'});
  assert.equal(catalog.items[0].name,'calculate');
  assert.equal(catalog.items[0].parameters.type,'object');
  assert.ok(catalog.items[0].parameters.properties.operation);
  assert.equal((await runTool(env,agentById('orchestrator'),'tool_catalog',{query:'domain'})).items.some(item=>item.name==='domain_list'),false);
});
