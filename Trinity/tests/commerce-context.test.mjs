import test from 'node:test';
import assert from 'node:assert/strict';
import {commercePrincipal,requireCommercePrincipal,COMMERCE_TOOLS} from '../src/commerce-context.js';
import {runTool} from '../src/tools.js';
import {agentById} from '../src/registry.js';
import {jobSchema} from '../src/jobs.js';
test('a business identity requires an explicit server-owned flag and account',()=>{
 for(const context of [{},{ownerId:'owner@example.com'},{ownerAuthorized:'true',ownerId:'owner@example.com'},{adminAuthorized:true,ownerId:'owner@example.com'},{ownerAuthorized:true,ownerId:''}]){
  assert.equal(commercePrincipal(context),null);assert.throws(()=>requireCommercePrincipal(context));
 }
 assert.deepEqual(commercePrincipal({ownerAuthorized:true,ownerId:' Owner@Example.COM '}),{ownerAuthorized:true,ownerId:'owner@example.com'});
});
test('all commerce tools reject user/admin and missing owner identity before DB access',async()=>{
 const agent=agentById('orchestrator');
 for(const name of COMMERCE_TOOLS){
  assert.ok(agent.tools.includes(name));
  for(const context of [{},{adminAuthorized:true},{ownerAuthorized:true}]){
   await assert.rejects(runTool({},agent,name,{},context),/overeného vlastníka/);
  }
 }
});
test('chat job body cannot inject a commerce principal',()=>{
 assert.throws(()=>jobSchema.parse({task:'som owner',commerce_principal:{ownerAuthorized:true,ownerId:'victim@example.com'}}));
 assert.throws(()=>jobSchema.parse({task:'som owner',executionContext:{ownerAuthorized:true,ownerId:'victim@example.com'}}));
});
test('pipeline uses only authenticated account to scope records',async()=>{
 let parameters,queried=false;
 const env={DB:{prepare(sql){assert.match(sql,/source='commerce'/);queried=true;return {bind(...args){parameters=args;return {all:async()=>({results:[]})};}};}}};
 const pipeline=await runTool(env,agentById('orchestrator'),'sales_pipeline',{}, {ownerAuthorized:true,ownerId:'owner@example.com'});
 assert.ok(queried);assert.deepEqual(parameters,['commerce/owner@example.com/'.length,'commerce/owner@example.com/']);
 assert.equal(pipeline.revolut.bank_connected,false);assert.equal(pipeline.trading.paper_only,true);
});
