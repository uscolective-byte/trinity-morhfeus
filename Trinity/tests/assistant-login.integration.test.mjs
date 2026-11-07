import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/assistant/chat.js.txt',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/assistant/chat.html',import.meta.url),'utf8');
function setup(){
 const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
 const elements=new Map();
 function node(){return {children:[],hidden:false,value:'',checked:false,disabled:false,textContent:'',innerHTML:'',dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return node();},querySelectorAll(){return [];},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},focus(){},setAttribute(){},getAttribute(){return null;},removeAttribute(){}};}
 for(const id of ids)elements.set(id,node());
 const storage=new Map(),calls=[];let bootstrap;
 const context={console,URL,URLSearchParams,TextDecoder,AbortController,AbortSignal,Response,DOMException,crypto,Intl,Date,setTimeout,clearTimeout,setInterval,clearInterval,
 MutationObserver:class {observe(){} disconnect(){}},
 document:{getElementById:id=>elements.get(id)||null,querySelector:()=>null,querySelectorAll:()=>[],createElement:node,documentElement:node(),body:node(),addEventListener(){}},
 localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 location:{hostname:'auru.dev',host:'auru.dev',origin:'https://auru.dev',href:'https://auru.dev/',hash:'',search:'',pathname:'/'},
 history:{replaceState(){}},navigator:{},window:{addEventListener(){},PublicKeyCredential:function(){}},
 fetch:async()=>Response.json({error:'Prihlás sa do Trinity.'},{status:401}),
 TrinityAuth:{start(options){bootstrap=options;},config:async()=>({google_enabled:false,google_required:false}),requestJSON:async()=>({account:{role:'guest'}})}
 };
 vm.createContext(context);vm.runInContext(source,context,{timeout:3000});
 return {context,elements,calls,get bootstrap(){return bootstrap;},run:code=>vm.runInContext(code,context)};
}
test('real assistant HTML boots completely even without the removed memory navigation',()=>{
 const s=setup();assert.equal(s.elements.has('memory-nav'),false);
 assert.equal(typeof s.bootstrap.initialize,'function');assert.equal(typeof s.elements.get('login-form').onsubmit,'function');
});
test('guest status opens authentication instead of presenting a working chat',async()=>{
 const s=setup();await s.bootstrap.initialize();
 assert.equal(s.elements.get('login').hidden,false);assert.equal(s.elements.get('app-views').hidden,true);
 assert.match(s.elements.get('notice').textContent,/Prihlás/);
});
test('status failure leaves a visible recoverable login screen',async()=>{
 const s=setup();s.context.TrinityAuth.requestJSON=async()=>{throw Error('Server nedostupný');};
 await s.bootstrap.initialize();assert.equal(s.elements.get('login').hidden,false);
 assert.equal(s.elements.get('app-views').hidden,true);assert.equal(s.elements.get('notice').textContent,'Server nedostupný');
});
test('expired API session reopens login without treating a denial as success',async()=>{
 const s=setup();await assert.rejects(s.run("api('/projects')"),e=>e.status===401);
 assert.equal(s.elements.get('login').hidden,false);assert.equal(s.elements.get('app-views').hidden,true);
});
test('login surfaces server rejection and retains the key for correction',async()=>{
 const s=setup();s.elements.get('key').value='test-only-fake-key';
 s.context.TrinityAuth.requestJSON=async()=>{throw Object.assign(Error('Nesprávny prístupový kľúč.'),{status:401});};
 await s.elements.get('login-form').onsubmit({preventDefault(){}});
 assert.equal(s.elements.get('key').value,'test-only-fake-key');assert.match(s.elements.get('notice').textContent,/Nesprávny/);
});

test('authenticated owner opens the chat with the current HTML',async()=>{
 const s=setup();s.context.TrinityAuth.requestJSON=async()=>({account:{role:'owner',email:'owner@example.test'},pc_bridge:{connected:false},cloud:true});
 s.context.fetch=async path=>Response.json(path.includes('/ui-evolution')?{state:{}}:[]);
 await s.bootstrap.initialize();
 assert.equal(s.elements.get('login').hidden,true,s.elements.get('notice').textContent);
 assert.equal(s.elements.get('app-views').hidden,false);assert.equal(s.elements.get('logout').hidden,false);
});
test('chat denial preserves the draft and opens authentication',async()=>{
 const s=setup();s.elements.get('message').value='Ahoj';s.elements.get('engine').value='cloud';
 await s.elements.get('chat-form').onsubmit({preventDefault(){}});
 assert.equal(s.elements.get('message').value,'Ahoj');assert.equal(s.elements.get('login').hidden,false);
 assert.equal(s.elements.get('send').disabled,false);
});

test('overview link is hidden until an owner is authenticated',async()=>{
 for(const role of ['user','admin','owner']){
  const s=setup();s.context.TrinityAuth.requestJSON=async()=>({account:{role,email:'member@example.test'},pc_bridge:{connected:false}});
  s.context.fetch=async path=>Response.json(path.includes('/ui-evolution')?{state:{}}:[]);
  await s.bootstrap.initialize();assert.equal(s.elements.get('owner-overview-nav').hidden,role!=='owner');
  s.bootstrap.lock();assert.equal(s.elements.get('owner-overview-nav').hidden,true);
 }
});
test('direct overview navigation returns nonowners to chat without reading dashboard data',async()=>{
 const s=setup();s.run("state={account:{role:'admin'}}");
 s.context.fetch=async path=>{assert.notEqual(path,'/api/assistant/dashboard');return Response.json([]);};
 await s.run("setView('dashboard',false)");assert.equal(s.run('currentView'),'chat');
});


test('chat handles a non-JSON gateway failure and retains the unsent draft',async()=>{
 const s=setup();s.elements.get('message').value='Ahoj';
 s.context.fetch=async()=>new Response('Bad gateway',{status:502});
 await s.elements.get('chat-form').onsubmit({preventDefault(){}});
 assert.equal(s.elements.get('message').value,'Ahoj');
 assert.match(s.elements.get('notice').textContent,/HTTP 502/);
 assert.equal(s.elements.get('send').disabled,false);
});
test('chat timeout is recoverable and releases the send button',async()=>{
 const s=setup();s.elements.get('message').value='Test správy';
 s.context.fetch=async()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'});};
 await s.elements.get('chat-form').onsubmit({preventDefault(){}});
 assert.equal(s.elements.get('message').value,'Test správy');
 assert.match(s.elements.get('notice').textContent,/časovom limite/);
 assert.equal(s.elements.get('send').disabled,false);
 assert.equal(s.elements.get('stop').hidden,true);
});

test('failed send preserves the next draft being typed',async()=>{
 const s=setup();s.elements.get('message').value='Pôvodná správa';
 let fail;s.context.fetch=()=>new Promise((resolve,reject)=>{fail=reject;});
 const sending=s.elements.get('chat-form').onsubmit({preventDefault(){}});
 s.elements.get('message').value='Ďalšia rozpísaná správa';fail(new Error('Prerušené spojenie'));
 await sending;assert.equal(s.elements.get('message').value,'Ďalšia rozpísaná správa');
 assert.ok(s.elements.get('messages').children.at(-1).children.some(n=>n.textContent==='Obnoviť pôvodnú správu'));
});

test('IME Enter and Shift Enter do not submit the composer',()=>{
 const s=setup();let count=0;s.elements.get('chat-form').requestSubmit=()=>count++;
 const handler=s.elements.get('message').onkeydown;
 handler({key:'Enter',isComposing:true,preventDefault(){throw Error('IME blocked');}});
 handler({key:'Enter',shiftKey:true,preventDefault(){throw Error('newline blocked');}});
 handler({key:'Enter',preventDefault(){}});assert.equal(count,1);
});

test('stream decoder consumes final event without a trailing newline',async()=>{
 const s=setup();s.context.response=new Response('{"type":"delta","text":"Ahoj"}\n{"type":"delta","text":" Ivan"}');
 s.context.events=[];await s.run('readChatStream(response,event=>events.push(event))');
 assert.equal(s.context.events.map(x=>x.text).join(''),'Ahoj Ivan');
});

test('empty stream is recoverable instead of leaving a thinking bubble',async()=>{
 const s=setup();s.elements.get('message').value='Otázka';s.context.fetch=async()=>new Response('',{headers:{'Content-Type':'application/x-ndjson'}});
 await s.elements.get('chat-form').onsubmit({preventDefault(){}});
 assert.equal(s.elements.get('message').value,'Otázka');assert.match(s.elements.get('notice').textContent,/Neprišla žiadna odpoveď/);
});

test('stale request cannot restore text into a new conversation',async()=>{
 const s=setup();s.elements.get('message').value='Starý rozhovor';let fail;
 s.context.fetch=()=>new Promise((resolve,reject)=>{fail=reject;});
 const sending=s.elements.get('chat-form').onsubmit({preventDefault(){}});
 s.run('chatGeneration++');s.elements.get('message').value='Nový rozhovor';fail(new Error('Network error'));await sending;
 assert.equal(s.elements.get('message').value,'Nový rozhovor');assert.equal(s.elements.get('notice').textContent,'');
});

test('repository result is readable without claiming unconfirmed authentication',()=>{
 const s=setup();s.context.raw=JSON.stringify({success:true,repo:'owner/repo',authenticated:false,details:{default_branch:'main',visibility:'public'}});
 const rendered=s.run('readableReply(raw)');assert.match(rendered.text,/owner\/repo/);assert.match(rendered.text,/nebol potvrdený/);assert.ok(rendered.details);
});

test('reading old messages opts out of automatic follow',()=>{
 const s=setup(),area=s.elements.get('chat-area');area.scrollTop=50;area.scrollHeight=1000;
 s.run('chatFollowLatest=false;bottom()');assert.equal(area.scrollTop,50);
 s.run('bottom(true)');assert.equal(area.scrollTop,1000);
});

test('late history cannot replace messages sent while history was loading',async()=>{
 const s=setup();let resolveHistory;
 s.context.fetch=async path=>path.includes('/history')?new Promise(resolve=>{resolveHistory=resolve;}):new Response('Bad gateway',{status:502});
 const loading=s.run('loadHistory()');
 s.elements.get('message').value='Nová správa počas načítavania';
 await s.elements.get('chat-form').onsubmit({preventDefault(){}});
 const bubbles=s.elements.get('messages').children.slice();
 assert.equal(bubbles.length,2);
 resolveHistory(Response.json([{role:'assistant',content:'Stará história'}]));
 await loading;
 assert.deepEqual(s.elements.get('messages').children,bubbles);
 assert.equal(bubbles[0].children[1].textContent,'Nová správa počas načítavania');
});
