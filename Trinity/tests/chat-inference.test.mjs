import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../services/chat-inference.js';
import {callModel, cleanModelResponse} from '../src/services.js';
import {runAgent} from '../src/engine.js';

const model="@cf/meta/llama-3.1-8b-instruct-fp8-fast";
const request=body=>new Request('https://chat.internal/generate',{method:'POST',body:JSON.stringify(body)});

test('private worker validates the request and bounds inference output',async()=>{
 let captured;const env={AI:{run:async(selected,input)=>{captured={selected,input};return {response:'Ahoj'};}}};
 const response=await worker.fetch(request({model,messages:[{role:'user',content:'Ahoj'}],max_tokens:9000}),env);
 assert.equal(response.status,200);assert.equal((await response.json()).response,'Ahoj');assert.equal(captured.input.max_tokens,600);
 assert.equal((await worker.fetch(request({model:'https://other.test',messages:[]}),env)).status,400);
 assert.equal((await worker.fetch(request({model,messages:[{role:'tool',content:'x'}]}),env)).status,400);
 assert.equal((await worker.fetch(request({model,messages:[{role:'user',content:'x'.repeat(61000)}]}),env)).status,413);
});

test('health does not generate text and service errors do not disclose provider details',async()=>{
 assert.equal((await worker.fetch(new Request('https://chat.internal/health'),{AI:{run(){throw Error('Must not run');}}})).status,200);
 const response=await worker.fetch(request({model,messages:[{role:'user',content:'Ahoj'}]}),{AI:{run(){throw Error('sensitive-provider-detail');}}});
 assert.equal(response.status,503);assert.equal((await response.text()).includes('sensitive-provider-detail'),false);
});

test('parent fast calls use the dedicated internal binding',async()=>{
 const result=await callModel({AI:{run(){throw Error('Should use helper');}},CHAT_INFERENCE_SERVICE:{fetch:async(url,options)=>{assert.equal(url,'https://chat-inference.internal/generate');return worker.fetch(new Request(url,options),{AI:{run:async()=>({response:'Funguje'})}});}}},'fast',[{role:'user',content:'Ahoj'}]);
 assert.equal(result.text,'Funguje');
});

test('parent workers-ai calls use the dedicated internal chat inference binding',async()=>{
 let usedBinding=false;
 const result=await callModel({
   AI:{run(){throw Error('Should route through CHAT_INFERENCE_SERVICE');}},
   CHAT_INFERENCE_SERVICE:{fetch:async(url,options)=>{
     usedBinding=true;
     assert.equal(url,'https://chat-inference.internal/generate');
     return worker.fetch(new Request(url,options),{AI:{run:async()=>({response:'Dedikovaný chat worker odpovedá.'})}});
   }}
 },'workers-ai',[{role:'user',content:'Ahoj Trinity'}]);
 assert.equal(usedBinding,true);
 assert.equal(result.text,'Dedikovaný chat worker odpovedá.');
});

test('multi-tier circuit fallback engages secondary tier when primary fails',async()=>{
 const tried=[];
 const env={AI:{run:async(selectedModel)=>{
   tried.push(selectedModel);
   if(selectedModel.includes('70b'))throw new Error('Primary overloaded');
   return {response:'Odpoveď zo sekundárneho modelu'};
 }}};
 const response=await worker.fetch(request({model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast',messages:[{role:'user',content:'Ahoj'}]}),env);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.success,true);
 assert.equal(data.fallback_engaged,true);
 assert.equal(data.model_used,'@cf/deepseek-ai/deepseek-r1-distill-qwen-32b');
 assert.equal(data.response,'Odpoveď zo sekundárneho modelu');
 assert.equal(tried.length,2);
});

test('streaming mode supports SSE and filters hallucinated tool dumps',async()=>{
 const sseReadable=new ReadableStream({
   start(controller){
     const enc=new TextEncoder();
     controller.enqueue(enc.encode('data: {"response":"Ahoj "}\n\n'));
     controller.enqueue(enc.encode('data: {"response":"Môj zoznam nástrojov je interný"}\n\n'));
     controller.enqueue(enc.encode('data: {"response":"Ivan!"}\n\n'));
     controller.enqueue(enc.encode('data: [DONE]\n\n'));
     controller.close();
   }
 });
 const env={AI:{run:async()=>sseReadable}};
 const response=await worker.fetch(request({model,messages:[{role:'user',content:'Ahoj'}],stream:true}),env);
 assert.equal(response.status,200);
 assert.equal(response.headers.get('Content-Type'),'text/event-stream; charset=utf-8');
 const reader=response.body.getReader();
 const decoder=new TextDecoder();
 let fullText='';
 while(true){
   const {done,value}=await reader.read();
   if(done)break;
   fullText+=decoder.decode(value);
 }
 assert.match(fullText,/Ahoj/);
 assert.match(fullText,/Ivan!/);
 assert.doesNotMatch(fullText,/Môj zoznam nástrojov/);
});

test('binding outage retains existing bounded Workers AI fallback',async()=>{
 let local=0;const result=await callModel({CHAT_INFERENCE_SERVICE:{fetch:async()=>new Response('',{status:503})},AI:{run:async()=>{local++;return {response:'Náhradná odpoveď'};}}},'fast',[]);
 assert.equal(local,1);assert.equal(result.text,'Náhradná odpoveď');
});

test('helper is private and bound to unified trinity Worker',()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.chat.jsonc',import.meta.url),'utf8'));
 assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);assert.equal(config.routes,undefined);
 const main=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(main.services.find(s=>s.binding==='CHAT_INFERENCE_SERVICE').service,'trinity-chat-inference');
});

test('self_intro responds cleanly to "napis mi vsetko o tebe" without hallucinations',async()=>{
 const result=await runAgent({},'orchestrator','napis mi vsetko o tebe','','workers-ai',1000,'sk',true);
 assert.match(result.text,/Som Trinity/);
 assert.match(result.text,/tvoja osobná AI asistentka/);
 assert.doesNotMatch(result.text,/152 expertných zručností/);
 assert.doesNotMatch(result.text,/248 Copilot skillov/);
 assert.doesNotMatch(result.text,/Môj zoznam nástrojov/);
 assert.equal(result.model,'deterministic-tool');
});

test('cleanModelResponse strips prompt leaks and loops',async()=>{
 const leak = 'Sabo Ivan, rád sa ti oznam, že som Trinity, váš osobný AI operačný systém a vrcholná asistentka. Mám 152 expertných zručností a 248 Copilot skillov.\n\nMôj zoznam nástrojov je:\n1. knowledge_search: opis\n2. search_memory: opis\n\nSkutočná odpoveď pre teba.';
 const cleaned = cleanModelResponse(leak);
 assert.doesNotMatch(cleaned,/152 expertných zručností/);
 assert.doesNotMatch(cleaned,/248 Copilot skillov/);
 assert.doesNotMatch(cleaned,/Môj zoznam nástrojov/);
 assert.match(cleaned,/Skutočná odpoveď pre teba/);
});
