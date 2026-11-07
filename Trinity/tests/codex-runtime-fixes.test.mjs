import {test} from 'node:test';
import assert from 'node:assert/strict';
import dispatcher from '../services/dispatcher.js';
import {executeCoreTool} from '../services/core.js';

function request(action,data={}){
  return new Request('https://trinity.internal/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,data})});
}

test('core calculator evaluates arithmetic without dynamic code execution',async()=>{
  const env={DB:{}};
  assert.equal((await executeCoreTool(env,'calculate',{expression:'(2 + 3) * 4 - 2^2'})).result,16);
  await assert.rejects(()=>executeCoreTool(env,'calculate',{expression:'1/0'}),/Invalid arithmetic expression/);
  await assert.rejects(()=>executeCoreTool(env,'calculate',{expression:'globalThis.process'}),/Invalid characters/);
});

test('dispatcher validates task updates and reports missing task',async()=>{
  const db={prepare(sql){return {bind(){return this;},run:async()=>({meta:{changes:0}})};}};
  const env={DB:db};
  assert.equal((await dispatcher.fetch(request('task.update',{id:'task-1',status:'pretend'}),env)).status,400);
  assert.equal((await dispatcher.fetch(request('task.update',{status:'completed'}),env)).status,400);
  const missing=await dispatcher.fetch(request('task.update',{id:'task-1',status:'completed'}),env);
  assert.equal(missing.status,404);
  assert.equal((await missing.json()).error,'Task not found');
});
