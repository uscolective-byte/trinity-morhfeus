import test from 'node:test';
import assert from 'node:assert/strict';
import {SKILLS,selectSkills,agentById,MAX_ACTIVE_SKILLS} from '../src/registry.js';
import {EXTENDED_PLUGINS} from '../src/extended-catalog.js';
import {TOOL_SCHEMAS,runTool} from '../src/tools.js';
import {verifyPluginTools,SAFE_PLUGIN_SMOKE_TESTS} from '../src/plugin-verification.js';

const enabledEnv={DB:{prepare:()=>({bind(){return this;},first:async()=>({installed:1,enabled:1})})}};

test('skill selection is bounded, stable, accent-insensitive and retains communication',()=>{
  const agent=agentById('backend');
  const accented=selectSkills(agent,'Priprav testovací plán a unit testy.');
  const plain=selectSkills(agent,'Priprav testovaci plan a unit testy.');
  assert.ok(accented.length<=MAX_ACTIVE_SKILLS);
  assert.deepEqual(accented.map(s=>s.id),plain.map(s=>s.id));
  assert.ok(accented.some(s=>s.id==='clear-communication'));
  assert.ok(accented.some(s=>s.id==='quality-02'));
  assert.deepEqual(selectSkills(agent,'x'.repeat(50000)),selectSkills(agent,'x'.repeat(12000)));
  assert.ok(selectSkills(agentById('orchestrator'),'Prepoj Gemini cez MCP').some(s=>s.id==='integration-recovery'));
});

test('skills never add permissions and retain detailed domain-specific procedures',()=>{
  const writer=agentById('writer');
  const before=[...writer.tools];
  selectSkills(writer,'Oprav backend a nasad Cloudflare Worker cez MCP');
  assert.deepEqual(writer.tools,before);
  assert.ok(!writer.tools.includes('pc_run'));
  for(const id of ['software-05','cloud-08','quality-02','support-04']){
    const skill=SKILLS.find(s=>s.id===id);
    assert.equal(skill.kind,'workflow');
    assert.ok(skill.steps.length>=4);
    assert.ok(skill.success_checks.length>=2);
  }
});

test('workflow bundles use explicit relevant existing tools, not circular assignment',()=>{
  const plugin=id=>EXTENDED_PLUGINS.find(p=>p.id===id);
  assert.deepEqual(plugin('data-pack-01').tools,['json_tool']);
  assert.deepEqual(plugin('data-pack-04').tools,['statistics']);
  assert.deepEqual(plugin('developer-pack-03').tools,['text_diff']);
  assert.deepEqual(plugin('design-pack-02').tools,['contrast_check']);
  assert.deepEqual(plugin('finance-pack-03').tools,['portfolio_summary']);
  for(const item of EXTENDED_PLUGINS){
    assert.equal(item.kind,'workflow-pack');
    assert.equal(item.external_code,false);
    assert.ok(item.tools.length>0);
    assert.equal(new Set(item.tools).size,item.tools.length);
    for(const tool of item.tools)assert.ok(TOOL_SCHEMAS[tool],`${item.id}: missing schema ${tool}`);
  }
});

test('every generic self-test executes its real bounded tool successfully',async()=>{
  const names=Object.keys(SAFE_PLUGIN_SMOKE_TESTS);
  const result=await verifyPluginTools({tools:names},(tool,args)=>runTool(enabledEnv,{tools:names},tool,args));
  assert.equal(result.status,'verified');
  assert.equal(result.verified,true);
  assert.equal(result.checks.length,names.length);
  assert.ok(result.checks.every(check=>check.status==='passed'));
});

test('registration never becomes verification and unsupported tools are never called',async()=>{
  let calls=0;
  const unsupported=['pc_run','generate_image','web_search','list_connectors'];
  const result=await verifyPluginTools({tools:unsupported},async()=>{calls++;throw new Error('must not execute');});
  assert.equal(calls,0);
  assert.equal(result.status,'registered');
  assert.equal(result.verified,false);
  assert.ok(result.checks.every(check=>check.status==='not-tested'));
  assert.equal((await verifyPluginTools({tools:[]},async()=>{})).status,'registered');
});

test('partial test does not claim all tools were verified',async()=>{
  const called=[];
  const result=await verifyPluginTools({tools:['calculate','web_search']},async tool=>{
    called.push(tool);return {result:42};
  });
  assert.deepEqual(called,['calculate']);
  assert.equal(result.status,'partial');
  assert.equal(result.verified,false);
});

test('failed, invalid and incorrect self-test replies cannot be marked verified',async()=>{
  for(const result of [null,{error:'failed'},{valid:false},{result:0}]){
    await assert.rejects(verifyPluginTools({tools:['calculate']},async()=>result));
  }
  await assert.rejects(verifyPluginTools({tools:['calculate']},async()=>{throw new Error('disabled');}),/disabled/);
});