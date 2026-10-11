import test from 'node:test';
import assert from 'node:assert/strict';
import {memorySearchTerms,selectMemoryRecords,formatMemoryContext} from '../src/memory-context.js';
import {SKILLS,agentById,selectSkills} from '../src/registry.js';
import {PLUGINS} from '../src/plugins.js';
import {runTool} from '../src/tools.js';
import {COMMUNICATION_STYLE} from '../src/cognition.js';

test('memory keywords skip filler and keep short technical identifiers',()=>{
  assert.deepEqual(memorySearchTerms('Prosím, chcem opraviť PC a MCP pre Trinity'),['opraviť','PC','MCP','Trinity']);
  assert.equal(memorySearchTerms('ghp_abcdefghijklmnopqrstuvwxyz').length,0);
  assert.ok(memorySearchTerms('one two three four five six seven eight').length<=6);
});

test('memory selection preserves profiles, ranks relevance, and removes duplicates',()=>{
  const profile={key:'profil/identity',value:'Jedna asistentka.',source:'user:explicit'};
  const relevant={key:'projekt/MCP',value:'MCP pripojenie je chránené.',source:'user'};
  const duplicate={key:'legacy/MCP',value:relevant.value,source:'legacy'};
  const unrelated={key:'old/random',value:'Nesúvisiaci záznam.',source:'legacy'};
  const secret={key:'credentials/token',value:'Do not expose.',source:'user'};
  assert.deepEqual(selectMemoryRecords([unrelated,duplicate,profile,relevant,secret],'MCP'),[profile,relevant]);
});

test('memory context is bounded, attributed, and redacts common credentials',()=>{
  const records=[{key:'project/test',value:'Bearer abcdefghijklmnopqrstuvwxyz and trn_live_abcdefghijklmnopqrstuvwxyz123456',source:'tool:untrusted',updated_at:'2026-10-11'}];
  const text=formatMemoryContext(records);
  assert.ok(text.includes('[redacted]'));assert.ok(!text.includes('abcdefghijklmnopqrstuvwxyz'));
  assert.equal(JSON.parse(text)[0].source,'tool:untrusted');
  assert.equal(formatMemoryContext([{key:'api-key/root',value:'private'}]),'[]');
  assert.ok(JSON.parse(formatMemoryContext(Array.from({length:20},(_,i)=>({key:String(i),value:'x'})))).length<=8);
});

test('skills expose concrete procedures without granting extra tool permissions',()=>{
  for(const id of ['memory-hygiene','integration-recovery','clear-communication']) {
    const skill=SKILLS.find(s=>s.id===id);assert.ok(skill);
    assert.ok(skill.steps.length>=3);assert.ok(skill.success_checks.length>=2);
  }
  assert.ok(selectSkills(agentById('writer'),'napíš vetu').some(s=>s.id==='clear-communication'));
  assert.ok(selectSkills(agentById('orchestrator'),'Pripoj Gemini cez MCP').some(s=>s.id==='integration-recovery'));
  assert.ok(!agentById('writer').tools.includes('pc_run'));
});

test('planning plugin returns a plan and checks, never an execution claim',async()=>{
  assert.ok(PLUGINS.find(p=>p.id==='task-planner'&&p.tools.includes('plan_work')));
  const env={DB:{prepare:()=>({bind(){return this;},first:async()=>({installed:1,enabled:1})})}};
  const result=await runTool(env,agentById('orchestrator'),'plan_work',{task:'Vytvor a nasad aplikáciu'});
  assert.equal(result.intent,'build');assert.equal(result.risk,'high');
  assert.ok(result.completion_checks.length>=2);assert.equal(result.execution_status,'not-started');
  assert.equal(result.grants_permissions,false);
});

test('disabled planning plugin cannot execute',async()=>{
  const env={DB:{prepare:()=>({bind(){return this;},first:async()=>({installed:1,enabled:0})})}};
  await assert.rejects(runTool(env,agentById('orchestrator'),'plan_work',{task:'naplánuj prácu'}),/vypnuté/);
});

test('communication requires one manageable step and distinguishes connectivity from authorization',()=>{
  assert.match(COMMUNICATION_STYLE,/jeden konkrétny krok/);
  assert.match(COMMUNICATION_STYLE,/HTTP 200/);
  assert.match(COMMUNICATION_STYLE,/neopakuj/i);
});