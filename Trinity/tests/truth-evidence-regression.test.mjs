import test from 'node:test';
import assert from 'node:assert/strict';
import {SovereignTruthGuard,verifyPhysicalDiskWrite,IndependentVerifier,fetchWithHardTimeout} from '../src/truth.js';

test('missing process result never defaults to exitCode zero',()=>{
  const guard=new SovereignTruthGuard();
  assert.equal(guard.verifyZeroSimulatedExecution().allowed,false);
  assert.equal(guard.verifyZeroSimulatedExecution({stdout:'done'}).allowed,false);
  assert.equal(guard.verifyZeroSimulatedExecution({exitCode:0,stdout:'done'}).allowed,true);
});
test('disk verification rejects Promise and truthy non-boolean values',()=>{
  for(const value of [Promise.resolve(false),'false',{},1]) {
    assert.throws(()=>verifyPhysicalDiskWrite('file',()=>value),TypeError);
  }
  assert.equal(verifyPhysicalDiskWrite('file',()=>false).verified,false);
});
test('independent verifier rejects absence of both planned and observed state',()=>{
  assert.throws(()=>IndependentVerifier.verify({proposingAgent:'planner'}),/Chýba/);
});
test('hard deadline terminates waiting even if fetch ignores cancellation',async()=>{
  const result=await fetchWithHardTimeout('https://example.test',{},10,()=>new Promise(()=>{}));
  assert.equal(result.ok,false);
  assert.equal(result.outcome,'unknown');
  assert.doesNotMatch(result.message,/nebola vykonaná/);
});
test('fetch propagates caller cancellation and preserves successful response',async()=>{
  const controller=new AbortController();
  controller.abort();
  let observed;
  const result=await fetchWithHardTimeout('https://example.test',{signal:controller.signal},100,
    async(_url,{signal})=>{observed=signal.aborted; throw new DOMException('Cancelled','AbortError');});
  assert.equal(observed,true);
  assert.equal(result.error_code,'ABORTED');
  const response={ok:true,status:200};
  assert.equal((await fetchWithHardTimeout('https://example.test',{},100,async()=>response)).response,response);
});
