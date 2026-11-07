import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgent,toolReceiptForOutcome} from '../src/engine.js';

test('tech news chat shows returned comments_count without undefined metrics',async t=>{
 t.mock.method(globalThis,'fetch',async input=>{
  const url=new URL(String(input));assert.equal(url.hostname,'hacker-news.firebaseio.com');
  if(url.pathname.endsWith('/topstories.json'))return Response.json([42]);
  return Response.json({id:42,title:'Testovaná správa',url:'https://example.com/story',score:0,descendants:7,time:1700000000});
 });
 const result=await runAgent({},'orchestrator','Technologické novinky','','fast');
 assert.match(result.text,/Testovaná správa/);assert.match(result.text,/7 komentárov/);assert.match(result.text,/0 bodov/);
 assert.doesNotMatch(result.text,/undefined/);
 assert.equal(result.tool_log[0].status,'completed');
});

test('unavailable external data cannot produce a completed receipt even with generated evidence',()=>{
 const receipt=toolReceiptForOutcome('tech_news',{available:false,reason:'HTTP 503',_evidence:{effect:'read',receipt_id:'generated-id'}});
 assert.equal(receipt.status,'failed');
 assert.notEqual(receipt.receipt_id,'generated-id');
});

test('news source outage produces a failed chat outcome rather than a successful read',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('Unavailable',{status:503}));
 const result=await runAgent({},'orchestrator','Tech správy','','fast');
 assert.equal(result.tool_log[0].status,'failed');
 assert.equal(result.execution_status,'failed');
 assert.doesNotMatch(result.text,/Najnovšie technologické správy|undefined/);
});
