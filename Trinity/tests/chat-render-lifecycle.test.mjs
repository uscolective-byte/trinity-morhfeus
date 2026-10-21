import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const chat=await readFile(new URL('../public/assistant/chat.js.txt',import.meta.url),'utf8');
const source=await readFile(new URL('../public/assistant/task-control.js.txt',import.meta.url),'utf8');
const taskModule=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const start=chat.indexOf("$('chat-form').onsubmit=safe(async()=>{");
const end=chat.indexOf('\n});',start);
assert.ok(start>=0&&end>start,'Chat submit handler must be available');
const handler=chat.slice(start,end+4);

function runChatSubmission(handler,taskModule,mode,answer){
 const elements=Object.fromEntries(['message','send','stop','activity','engine','remember','allow-files','chat-form'].map(id=>[id,{value:'',checked:false,hidden:false,disabled:false,textContent:''}]));
 elements.message.value='Show the result';elements.engine.value='cloud';
 const rendered=[],notices=[],requests=[];
 const node=(_tag,text='')=>({textContent:text,children:[],append(...items){this.children.push(...items);},setAttribute(){}});
 const scope={
  $:id=>elements[id],controller:null,activeTask:null,activeStream:false,stopRequested:false,
  session:'12345678-1234-4123-8123-123456789012',language:'auto',taskModule,
  safe:fn=>fn,node,t:key=>key,bubble:()=>({content:node('div'),wrap:node('article')}),
  localStorage:{getItem:()=>null,setItem(){}},sessions:async()=>{},bottom(){},
  notice:message=>notices.push(message),
  renderReply:(target,text)=>{rendered.push(text);target.textContent='[formatted]'+text;},
  reportStopFailure:()=>{throw new Error('Unexpected cancellation failure');},
  AbortController:class{constructor(){this.signal={};}abort(){}},
  TextDecoder:class{decode(value){return value;}},
  fetch:async(url)=>{
   requests.push(url);
   if(url==='/api/assistant/chat'){
    if(mode==='job')return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({id:'12345678-1234-4123-8123-123456789012',session_id:'session'})};
    let read=false;
    return {ok:true,headers:{get:()=> 'application/x-ndjson'},body:{getReader:()=>({read:async()=>{
     if(read)return {done:true};read=true;return {done:false,value:JSON.stringify({type:'delta',text:answer})+'\n'};
    }})}};
   }
   return {ok:true,json:async()=>({status:'completed',result:answer,steps:[]})};
  }
 };
 new Function(...Object.keys(scope),handler.replace("await import('/task-control.js')",'taskModule'))(...Object.values(scope));
 return elements['chat-form'].onsubmit().then(()=>({rendered,notices,requests,elements}));
}

for(const mode of ['job','stream']){
 test(mode+' answer is rendered once from original Markdown and retains submit cleanup',async()=>{
  const answer='**Hotovo**\n\n[Report](/api/assistant/files/12345678-1234-4123-8123-123456789012/report.pdf)\n\n'+
   '\x60\x60\x60js\nconsole.log(1);\n\x60\x60\x60';
  const result=await runChatSubmission(handler,taskModule,mode,answer);
  assert.deepEqual(result.rendered,[answer]);
  assert.deepEqual(result.notices,[]);
  assert.equal(result.requests.length,mode==='job'?2:1);
  assert.equal(result.elements.send.disabled,false);
  assert.equal(result.elements.stop.hidden,true);
  assert.equal(result.elements.activity.textContent,'');
 });
}
