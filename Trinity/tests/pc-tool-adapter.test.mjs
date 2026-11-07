import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runTool} from '../src/tools.js';
import {pcActionReceipt} from '../src/engine.js';

test('PC open-app receipt is completed only with verified execution evidence',()=>{
  const timestamp='2026-10-26T06:30:00.000Z';
  assert.deepEqual(pcActionReceipt({id:'proposal-1',status:'proposed'},timestamp),{
    tool:'pc_open_app',status:'pending',effect:'proposal',receipt_id:'proposal-1',verified_at:timestamp
  });
  assert.equal(pcActionReceipt({id:'claimed-1',status:'claimed'},timestamp).status,'running');
  assert.equal(pcActionReceipt({id:'failed-1',status:'failed'},timestamp).status,'failed');
  assert.deepEqual(pcActionReceipt({status:'completed',_evidence:{receipt_id:'verified-1'}},timestamp),{
    tool:'pc_open_app',status:'completed',effect:'mutation',actions:['execute'],receipt_id:'verified-1',verified_at:timestamp
  });
});

test('admin PC tools validate their own schema and dispatch bounded gateway payloads',async()=>{
  const payloads=[];
  const env={DB:{prepare(sql){return {
    bind(...values){if(sql.startsWith('INSERT INTO ops_system_actions'))payloads.push(JSON.parse(values[2]));return this;},
    async run(){return {};},async first(){return sql.includes('ops_plugins')?{installed:1,enabled:1}:{id:'test-action',action:'read',status:'completed',payload_json:'{}',receipt_json:JSON.stringify({content:'verified',sha256:'a'.repeat(64)})};}
  };}}};
  const agent={tools:['pc_run_script','pc_file_read','pc_file_write','pc_file_edit','pc_file_append','pc_run']};
  await assert.rejects(runTool(env,agent,'pc_file_read',{path:'Trinity/package.json'}),/admin/);
  const read=await runTool(env,agent,'pc_file_read',{path:'Trinity/package.json'},{adminAuthorized:true});
  assert.equal(read.content,'verified');
  await runTool(env,agent,'pc_file_write',{path:'Trinity/new.txt',content:'new'},{adminAuthorized:true});
  assert.equal(payloads.at(-1).expected_sha256,'absent');
  await runTool(env,agent,'pc_file_append',{path:'Trinity/new.txt',content:' appended'},{adminAuthorized:true});
  assert.deepEqual(payloads.at(-1),{path:'Trinity/new.txt',content:'verified appended',expected_sha256:'a'.repeat(64)});
  await runTool(env,agent,'pc_file_edit',{path:'Trinity/new.txt',find:'verified',replace:'$& replaced'},{adminAuthorized:true});
  assert.equal(payloads.at(-1).content,'$& replaced');
  await assert.rejects(runTool(env,agent,'pc_file_edit',{path:'Trinity/new.txt',find:'missing',replace:'x'},{adminAuthorized:true}),/presne raz/);
  await runTool(env,agent,'pc_run',{command:'npm run build',cwd:'Trinity'},{adminAuthorized:true});
  assert.deepEqual(payloads.at(-1),{project:'Trinity',task:'build'});
  await assert.rejects(runTool(env,agent,'pc_run_script',{runtime:'node',path:'Trinity/workspace/scripts/test.mjs',expected_sha256:'a'.repeat(64)}),/admin/);
  await runTool(env,agent,'pc_run_script',{runtime:'python',path:'Trinity/workspace/scripts/test.py',expected_sha256:'a'.repeat(64),args:['literal value']},{adminAuthorized:true});
  assert.deepEqual(payloads.at(-1),{task:'script',runtime:'python',path:'Trinity/workspace/scripts/test.py',expected_sha256:'a'.repeat(64),args:['literal value'],timeout_ms:30000});
  await runTool(env,agent,'pc_run',{command:'python --version'},{adminAuthorized:true});
  assert.equal(payloads.at(-1).task,'python-version');
  const before=payloads.length;
  await assert.rejects(runTool(env,agent,'pc_run',{command:'npm run build; arbitrary'},{adminAuthorized:true}),/povoľuje/);
  assert.equal(payloads.length,before);
  const openApp=await runTool(env,{tools:['pc_open_app']},'pc_open_app',{target:'calculator'},{adminAuthorized:true});
  assert.equal(payloads.at(-1).target,'calculator');
  await runTool(env,{tools:['pc_open_app']},'pc_open_app',{target:'cmder'},{adminAuthorized:true});
  assert.equal(payloads.at(-1).target,'cmder');
  await runTool(env,{tools:['pc_open_url']},'pc_open_url',{url:'https://auru.dev'},{adminAuthorized:true});
  assert.equal(payloads.at(-1).url,'https://auru.dev');
});
