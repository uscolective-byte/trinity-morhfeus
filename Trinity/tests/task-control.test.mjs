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

test('explicit Stop retries a failed cancellation but preserves confirmed receipts',async()=>{
 for(const failure of [
  async()=>{throw new Error('Network unavailable');},
  async()=>new Response('',{status:503}),
  async()=>Response.json({status:'running'}),
  async()=>new Response('invalid JSON')
 ]){
  let calls=0;
  const control=new TaskControl(async()=>{
   calls++;
   return calls===1?failure():Response.json({status:'cancelled'});
  });
  await control.attach(id);
  await assert.rejects(control.stop());
  assert.equal(control.receipt,null);
  assert.equal(calls,1);
  assert.equal((await control.stop()).status,'cancelled');
  assert.equal(calls,2);
  assert.equal((await control.stop()).status,'cancelled');
  assert.equal(calls,2);
 }
});
test('concurrent Stop calls share a failed request and a later retry sends only once',async()=>{
 let calls=0,finishFirst;
 const firstResponse=new Promise(resolve=>{finishFirst=resolve;});
 const control=new TaskControl(async()=>{
  calls++;
  return calls===1?firstResponse:Response.json({status:'cancelled'});
 });
 await control.attach(id);
 const first=control.stop(),second=control.stop();
 assert.equal(calls,1);
 finishFirst(new Response('',{status:503}));
 const failed=await Promise.allSettled([first,second]);
 assert.equal(failed[0].status,'rejected');assert.equal(failed[1].status,'rejected');
 assert.equal(control.receipt,null);
 await Promise.all([control.stop(),control.stop()]);
 assert.equal(calls,2);assert.equal(control.receipt.status,'cancelled');
});

test('Stop can be retried after cancellation failed while attaching the job ID',async()=>{
 let calls=0;
 const control=new TaskControl(async()=>{
  calls++;
  return calls===1?new Response('',{status:503}):Response.json({status:'cancelled'});
 });
 assert.equal((await control.stop()).status,'waiting_for_id');
 await assert.rejects(control.attach(id));
 assert.equal(control.id,id);assert.equal(control.receipt,null);
 assert.equal((await control.stop()).status,'cancelled');assert.equal(calls,2);
});
