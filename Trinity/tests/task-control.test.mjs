import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assistant/task-control.js.txt',import.meta.url),'utf8');
const {TaskControl,taskProgress}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const id='12345678-1234-4123-8123-123456789012';
test('Stop before job ID waits and then sends exactly one cancellation',async()=>{
 let calls=0;
 const control=new TaskControl(async(url,options)=>{calls++;assert.equal(url,'/api/ops/jobs/'+id+'/cancel');assert.equal(options.method,'POST');assert.equal(options.signal,undefined);return Response.json({status:'cancelled'});});
 assert.equal((await control.stop()).status,'waiting_for_id');assert.equal(calls,0);
 await control.attach(id);await Promise.all([control.stop(),control.stop()]);
 assert.equal(calls,1);assert.equal(control.receipt.status,'cancelled');
});
test('server failure and active status never become confirmed cancellation',async()=>{
 for(const response of [new Response('',{status:502}),Response.json({status:'running'})]){
  const control=new TaskControl(async()=>response);await control.attach(id);await assert.rejects(control.stop());assert.equal(control.receipt,null);
 }
});
test('completed race returns actual completed state and does not claim cancellation',async()=>{
 const control=new TaskControl(async()=>Response.json({status:'completed'}));await control.attach(id);
 assert.equal((await control.stop()).status,'completed');assert.equal(control.receipt.status,'completed');
});
test('progress distinguishes active, terminal and completed steps',()=>{
 const running=taskProgress({status:'running',steps:[{status:'completed'},{status:'running'}]});
 assert.equal(running.terminal,false);assert.equal(running.completed,1);assert.equal(running.total,2);
 assert.equal(taskProgress({status:'cancelled'}).label,'Zastavenie potvrdené');
});
