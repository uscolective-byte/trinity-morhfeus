import test from 'node:test';
import assert from 'node:assert/strict';
import {callModel} from '../src/services.js';

const env={DB:{prepare(){return {bind(){return this;},first:async()=>null};}},GEMINI_MODEL:'gemini-test-only',GEMINI_API_KEY:'AIza'+'a'.repeat(32)};
const messages=[{role:'user',content:'Testovací dopyt'}];

test('Gemini fallback stops on auth, quota and server failures and reports the actual status',async t=>{
 for(const status of [401,403,429,500,503]){
  await t.test(String(status),async t=>{
   let attempts=0;
   t.mock.method(globalThis,'fetch',async input=>{
    const url=new URL(String(input));assert.equal(url.hostname,'generativelanguage.googleapis.com');
    if(url.pathname.endsWith('/interactions'))return Response.json({error:{message:'unsupported endpoint'}},{status:404});
    if(url.pathname.endsWith('/models'))return Response.json({models:[{name:'models/gemini-other-flash',supportedGenerationMethods:['generateContent']}]});
    attempts++;return Response.json({error:{message:'provider failure'}},{status});
   });
   await assert.rejects(callModel(env,'gemini',messages),new RegExp(`Gemini HTTP ${status}`));
   assert.equal(attempts,1,'A different model cannot fix authorization, quota or a server outage');
  });
 }
});

test('a missing model can still fall back to a discovered compatible model',async t=>{
 let attempts=0;
 t.mock.method(globalThis,'fetch',async input=>{
  const url=new URL(String(input));
  if(url.pathname.endsWith('/interactions'))return Response.json({error:{}},{status:404});
  if(url.pathname.endsWith('/models'))return Response.json({models:[{name:'models/gemini-other-flash',supportedGenerationMethods:['generateContent']}]});
  if(++attempts===1)return Response.json({error:{}},{status:404});
  return Response.json({candidates:[{content:{parts:[{text:'Overená odpoveď'}]}}]});
 });
 const result=await callModel(env,'gemini',messages);
 assert.equal(result.text,'Overená odpoveď');assert.equal(result.model,'gemini-other-flash');assert.equal(attempts,2);
});
