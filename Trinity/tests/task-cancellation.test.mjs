import test from 'node:test';
import assert from 'node:assert/strict';
import {cancelWorkflowJob} from '../src/task-cancellation.js';
test('failed workflow termination never marks a job cancelled',async()=>{
 const env={OPS_WORKFLOW:{get:async()=>({terminate:async()=>{throw Error('unreachable');}})},DB:{prepare:()=>assert.fail('must not update DB')}};
 await assert.rejects(cancelWorkflowJob(env,'id',async()=>({status:'running'})),e=>e.status===502);
});
test('terminal job does not invoke workflow termination',async()=>{
 assert.deepEqual(await cancelWorkflowJob({},'id',async()=>({status:'completed'})),{status:'completed'});
});
test('completion during cancellation wins and leaves step state intact',async()=>{
 let terminated=false;
 const env={OPS_WORKFLOW:{get:async()=>({terminate:async()=>{terminated=true;}})},DB:{prepare(sql){
  assert.ok(!sql.includes('ops_steps'));
  return {bind(){return {first:async()=>sql.startsWith('UPDATE')?null:{status:'completed'}};}};}}};
 assert.deepEqual(await cancelWorkflowJob(env,'id',async()=>({status:'running'})),{status:'completed'});assert.equal(terminated,true);
});
