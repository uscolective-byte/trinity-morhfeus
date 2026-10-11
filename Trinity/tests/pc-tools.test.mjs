import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PC_TOOLS,TOOL_SCHEMAS,runTool} from '../src/tools.js';
import {findUnsupportedActionClaims} from '../src/truth.js';

const agent={id:'test-pc-operator',tools:[...PC_TOOLS]};
const admin={adminAuthorized:true};
const samples={
  pc_screenshot:{},
  pc_run:{command:'npm test'},
  pc_file_read:{path:'Trinity/example.txt'},
  pc_file_write:{path:'Trinity/example.txt',content:'test'},
  pc_file_append:{path:'Trinity/example.txt',content:'append'},
  pc_file_edit:{path:'Trinity/example.txt',find:'test',replace:'updated'},
  pc_directory_create:{path:'Trinity/test-folder'},
  pc_open_app:{target:'notepad'},
  pc_app_control:{operation:'launch',app:'notepad'},
  pc_notify:{message:'Test notification'},
  pc_system_info:{},
  pc_scrape:{url:'https://example.test/'},
  pc_web_fetch:{url:'https://example.test/'},
  pc_download:{url:'https://example.test/file',path:'Trinity/file.txt'},
  pc_git_commit:{message:'test commit'},
  pc_git_pr:{title:'test pull request',head:'test-branch'},
};

// In-memory contract fixture only: no network, process launch or Windows write.
function fixture({installed=1,enabled=1,poll={status:'completed',receipt:{confirmed:true}}}={}) {
  let row,reads=0;
  const writes=[];
  const env={DB:{prepare(sql) {
    let args;
    return {
      bind(...values){args=values;return this;},
      async run(){
        writes.push({sql,args});
        if(sql.startsWith('INSERT INTO ops_system_actions')){
          const [id,action,payload_json,rationale,status,requested_by,approved_by]=args;
          row={id,action,payload_json,rationale,status,requested_by,approved_by,receipt_json:null};
        }
        return {success:true};
      },
      async first(){
        if(sql.includes('FROM ops_plugins'))return {installed,enabled};
        assert.match(sql,/SELECT \* FROM ops_system_actions WHERE id=\?/);
        assert.equal(args[0],row.id);
        reads++;
        if(reads===1)return {...row};
        return {...row,status:poll.status,error:poll.error,
          receipt_json:poll.receipt===undefined?null:JSON.stringify(poll.receipt)};
      },
    };
  }}};
  return {env,writes,get row(){return row;}};
}
function fastPolling(t) {
  t.mock.method(globalThis,'setTimeout',callback=>{queueMicrotask(callback);return 0;});
}
function log(name,outcome) {
  return {tool:name,status:'completed',...outcome._evidence};
}

test('every PC tool has a strict bounded schema in the shared registry',()=>{
  assert.deepEqual(Object.keys(samples).sort(),[...PC_TOOLS].sort());
  for(const name of PC_TOOLS){
    assert.ok(TOOL_SCHEMAS[name],name);
    assert.deepEqual(TOOL_SCHEMAS[name].parse(samples[name]),samples[name]);
    assert.equal(TOOL_SCHEMAS[name].safeParse({...samples[name],adminAuthorized:true}).success,false,name);
  }
  assert.equal(TOOL_SCHEMAS.pc_file_write.safeParse({path:'x',content:'x'.repeat(500001)}).success,false);
  assert.equal(TOOL_SCHEMAS.pc_file_read.safeParse({path:'x',depth:4}).success,false);
  assert.equal(TOOL_SCHEMAS.pc_run.safeParse({command:'x',timeout:120001}).success,false);
});

test('non-admin and unlisted-agent PC calls never reach the database',async()=>{
  for(const context of [{},{adminAuthorized:false},{adminAuthorized:'true'}]){
    await assert.rejects(runTool({},agent,'pc_file_write',samples.pc_file_write,context),/admin režime/);
  }
  await assert.rejects(runTool({},{tools:[]},'pc_file_write',samples.pc_file_write,admin),/Tool not allowed/);
});

test('invalid PC arguments cannot enqueue an action or impersonate admin context',async()=>{
  const f=fixture();
  for(const input of [{path:'x'}, {...samples.pc_file_write,approval:true},
    {...samples.pc_file_write,adminAuthorized:true}, {path:'',content:'x'}]){
    await assert.rejects(runTool(f.env,agent,'pc_file_write',input,admin),error=>error.name==='ZodError');
  }
  assert.equal(f.writes.length,0);
});

test('missing or disabled PC plugins still block action creation',async()=>{
  for(const settings of [{installed:0},{enabled:0}]){
    const f=fixture(settings);
    await assert.rejects(runTool(f.env,agent,'pc_file_write',samples.pc_file_write,admin),/vypnuté/);
    assert.equal(f.writes.length,0);
  }
});

test('confirmed PC writes use mutation evidence and existing scoped action claims',async t=>{
  fastPolling(t);
  const names=['pc_file_write','pc_file_append','pc_file_edit','pc_directory_create',
    'pc_run','pc_open_app','pc_app_control','pc_notify','pc_download','pc_git_commit','pc_git_pr'];
  for(const name of names){
    const f=fixture(),result=await runTool(f.env,agent,name,samples[name],admin);
    assert.equal(result.confirmed,true);
    assert.equal(result._evidence.effect,'mutation',name);
    assert.equal(result._evidence.receipt_id,f.row.id);
    assert.ok(result._evidence.actions.length>0);
    assert.equal(f.row.status,'approved');
    assert.equal(f.row.requested_by,'admin:agent:trinity');
    assert.equal(f.row.approved_by,'admin:agent:trinity');
    assert.equal(f.writes.length,2);
    assert.match(f.writes[1].args[0],/^system_action_admin_authorized$/);
    if(name==='pc_file_write'){
      assert.deepEqual(JSON.parse(f.row.payload_json),samples.pc_file_write);
      assert.deepEqual(findUnsupportedActionClaims('Vytvorila som súbor.',[log(name,result)]),[]);
      assert.deepEqual(findUnsupportedActionClaims('Nasadila som nový Worker.',[log(name,result)]),['deploy']);
    }
    if(name==='pc_file_append')assert.equal(JSON.parse(f.row.payload_json).operation,'append');
    if(name==='pc_directory_create')assert.equal(JSON.parse(f.row.payload_json).operation,'mkdir');
  }
});

test('confirmed read-only PC tools retain read evidence and cannot prove file creation',async t=>{
  fastPolling(t);
  for(const name of ['pc_screenshot','pc_file_read','pc_system_info','pc_scrape','pc_web_fetch']){
    const f=fixture(),result=await runTool(f.env,agent,name,samples[name],admin);
    assert.equal(result._evidence.effect,'read',name);
    assert.deepEqual(result._evidence.actions,['verify']);
    assert.deepEqual(findUnsupportedActionClaims('Vytvorila som súbor.',[log(name,result)]),['create_file']);
  }
});

test('pending, revoked-to-proposal and unconfirmed PC actions never prove completion',async t=>{
  fastPolling(t);
  for(const status of ['proposed','approved','claimed']){
    const f=fixture({poll:{status}}),result=await runTool(f.env,agent,'pc_file_write',samples.pc_file_write,admin);
    assert.equal(result._evidence.effect,'proposal');
    assert.equal(result._evidence.receipt_id,undefined);
    assert.deepEqual(findUnsupportedActionClaims('Vytvorila som súbor.',[log('pc_file_write',result)]),['create_file']);
  }
});

test('failed actions and completed rows without an object receipt cannot produce success evidence',async t=>{
  fastPolling(t);
  const failed=fixture({poll:{status:'failed',error:'Test gateway failure'}});
  await assert.rejects(runTool(failed.env,agent,'pc_file_write',samples.pc_file_write,admin),/Test gateway failure/);
  for(const receipt of [undefined,null,[],false,'untrusted string']){
    const f=fixture({poll:{status:'completed',receipt}});
    await assert.rejects(runTool(f.env,agent,'pc_file_write',samples.pc_file_write,admin),/potvrden/i);
  }
});