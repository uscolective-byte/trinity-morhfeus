import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveProviderSecret} from '../src/secret-vault.js';
import {bridgeExecutionVerified,ExecutionLifecycleGuard,workflowResultComplete} from '../src/truth.js';
import {planTask} from '../src/planner.js';

test('provider lookup continues after empty or failed bindings and trims values',async()=>{
  for(const first of [{get:async()=>''},{get:async()=>{throw Error('unavailable');}},'   ']) {
    assert.equal(await resolveProviderSecret({CF_API_TOKEN:first,CLOUDFLARE_API_TOKEN:' fixture-fallback '},'cloudflare'),'fixture-fallback');
  }
  assert.equal(await resolveProviderSecret({OLLAMA_SECRET:{get:async()=> ' fixture-binding '}},'ollama'),'fixture-binding');
  assert.equal(await resolveProviderSecret({GITHUBE_FINE_TOKEN:'fixture-broad'},'github'),null);
  assert.equal(await resolveProviderSecret({default_grok_default:'fixture-generic'},'groq'),null);
});
test('owner identity cannot turn a generated plan into an authorization grant',()=>{
  assert.equal(planTask('Nasad aplikaciu',true).grants_permissions,false);
});
test('HTTP success, missing exit code and generated identifiers are not execution evidence',()=>{
  const valid={status:'completed',exit_code:0,local_ledger_receipt:{receipt_id:'fixture-ledger',exit_code:0,block_hash:'a'.repeat(64)}};
  assert.equal(bridgeExecutionVerified(true,valid),true);
  for(const value of [{},{...valid,exit_code:undefined},{...valid,status:'queued'},{...valid,exit_code:1},{...valid,error:'failed'},
    {...valid,local_ledger_receipt:null},{...valid,simulated:true},{...valid,local_ledger_receipt:{...valid.local_ledger_receipt,exit_code:1}}]) {
    assert.equal(bridgeExecutionVerified(true,value),false);
  }
  assert.equal(bridgeExecutionVerified(false,valid),false);
  assert.throws(()=>ExecutionLifecycleGuard.validateTransition('RUNNING','COMPLETED'),/receipt/);
  const receipt={issuer:'executor',executorId:'fixture',exitCode:0,receipt_id:'fixture-original'};
  assert.equal(ExecutionLifecycleGuard.validateTransition('RUNNING','COMPLETED',receipt).state,'COMPLETED');
  assert.throws(()=>ExecutionLifecycleGuard.validateTransition('COMPLETED','VERIFIED',{...receipt,issuer:'llm_model'}),/SECURITY/);
});

test('workflow never completes queued, pending or partially failed tool results',()=>{
  for(const state of ['pending','queued','running','failed','partial']) {
    assert.equal(workflowResultComplete({execution_status:state,tool_log:[]}),false);
    assert.equal(workflowResultComplete({tool_log:[{status:state}]}),false);
  }
  assert.equal(workflowResultComplete({tool_log:[]}),true);
  assert.equal(workflowResultComplete({tool_log:[{status:'completed'}]}),true);
  assert.equal(workflowResultComplete({}),false);
});
