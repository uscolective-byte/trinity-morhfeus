import test from 'node:test';
import assert from 'node:assert/strict';
import {executeCustomAgent,provisionAgentDomain} from '../src/agent-sandbox.js';
import {catalogSkills} from '../src/skillRegistry.js';
function fixture(ai){
 const writes=[];const agent={id:'owned',owner_id:'alice',name:'Owned',role:'Assistant',model:'@cf/test/model',system_prompt:'Use real results.',tools_json:'[]'};
 const env={AI:{run:ai},DB:{prepare(sql){let values=[];return {bind(...args){values=args;return this;},first:async()=>sql.includes('ops_custom_agents')&&values.includes('alice')?agent:null,run:async()=>{writes.push({sql,values});return {success:true};},all:async()=>({results:[]})};}}};return {env,writes};
}
test('AI failure is recorded as failed, without invented output or confidence',async()=>{
 const {env,writes}=fixture(async()=>{throw new Error('provider unavailable');});
 const result=await executeCustomAgent(env,'alice',{agent_id:'owned',input:'Test task'});
 assert.equal(result.ok,false);assert.equal(result.status,'failed');assert.equal(result.output,'');assert.equal(result.self_reflection.confidence_score,null);
 assert.equal(writes.find(x=>x.sql.includes('INSERT INTO ops_agent_executions')).values[6],'failed');
});
test('agent execution respects ownership and selected model',async()=>{
 let model;const {env}=fixture(async(name)=>{model=name;return {response:'Actual answer'};});
 await assert.rejects(executeCustomAgent(env,'bob',{agent_id:'owned',input:'Test task'}),e=>e.status===404);
 const result=await executeCustomAgent(env,'alice',{agent_id:'owned',input:'Test task'});
 assert.equal(result.output,'Actual answer');assert.equal(model,'@cf/test/model');
});
test('domain preparation never invents DNS, WAF, SSL or a zone receipt',async()=>{
 const {env}=fixture(async()=>({response:'unused'}));
 const result=await provisionAgentDomain(env,'alice',{agent_id:'owned',domain_name:'example.com'});
 assert.equal(result.applied,false);assert.equal(result.status,'planned');assert.equal(result.zone_id,null);assert.deepEqual(result.dns_records,[]);
});
test('catalog-only skill descriptions are not execution receipts',async()=>{
 const fn=Object.values(catalogSkills)[0];const result=await fn({});assert.equal(result.status,'catalog-only');assert.equal(result.execution_verified,false);
});
