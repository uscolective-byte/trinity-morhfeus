import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TrinityCloud} from '../modules/cloud.mjs';
import {geminiChat,copilotStudioChat} from '../modules/providers.mjs';
import {syncNotes} from '../modules/notes-sync.mjs';

test('cloud connector sends authenticated real MCP envelopes and parses SSE',async()=>{
 let sent;
 const cloud=new TrinityCloud({getToken:async()=> 'private-token',fetcher:async(url,init)=>{assert.equal(url,'https://auru.space/mcp');assert.equal(init.headers.Authorization,'Bearer private-token');sent=JSON.parse(init.body);return new Response('event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:sent.id,result:{content:[{type:'text',text:JSON.stringify({ready:true})}]}})+'\n\n');}});
 assert.equal((await cloud.call('trinity_status')).ready,true);assert.equal(sent.params.name,'trinity_status');
 assert.throws(()=>new TrinityCloud({environment:'other',getToken:async()=>''}),/prostredie/);
 await assert.rejects(new TrinityCloud({getToken:async()=>''}).call('trinity_status'),/kľúč/);
});

test('Gemini maps local tools and preserves native signature parts for the next turn',async()=>{
 let count=0;
 const fetcher=async(url,init)=>{
  assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'));assert.equal(init.headers['x-goog-api-key'],'test-key');
  const input=JSON.parse(init.body);assert.equal(input.tools[0].functionDeclarations[0].name,'read_file');
  if(++count===2)assert.equal(input.contents[1].parts[0].thoughtSignature,'native-signature');
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{thoughtSignature:'native-signature',functionCall:{name:'read_file',args:{path:'x.txt'}}}]}}]});
 };
 const messages=[{role:'system',content:'Trinity'},{role:'user',content:'read'}];
 const options={key:'test-key',model:'gemini-test',messages,tools:[{function:{name:'read_file',description:'read',parameters:{type:'object',properties:{path:{type:'string'}}}}}],fetcher};
 const first=await geminiChat(options);assert.equal(first.message.tool_calls[0].function.name,'read_file');
 await geminiChat({...options,messages:[...messages,{role:'assistant',...first.message},{role:'tool',tool_name:'read_file',content:'{"content":"data"}'}]});
});

test('Copilot Studio uses conversation token, drains greetings and returns bot output',async()=>{
 const auth=[],calls=[];
 const fetcher=async(url,init)=>{
  auth.push(init.headers.Authorization);calls.push(String(url));
  if(url.endsWith('/tokens/generate'))return Response.json({token:'token-one'});
  if(url.endsWith('/conversations'))return Response.json({conversationId:'conversation',token:'token-two'});
  if(init.method==='POST')return Response.json({id:'activity'});
  if(url.includes('watermark='))return Response.json({watermark:'2',activities:[{type:'message',from:{id:'bot',role:'bot'},text:'Skutočná odpoveď'}]});
  return Response.json({watermark:'1',activities:[{type:'message',from:{role:'bot'},text:'Greeting'}]});
 };
 const result=await copilotStudioChat({secret:'direct-line-secret',query:'Ahoj',fetcher,pollMs:0});
 assert.equal(result.message.content,'Skutočná odpoveď');assert.equal(auth[0],'Bearer direct-line-secret');assert.equal(auth[2],'Bearer token-two');assert.ok(!JSON.stringify(result).includes('secret'));
});

test('shared notes import remote changes, retain conflicts and avoid replaying accepted edits',async()=>{
 const id=crypto.randomUUID(),other=crypto.randomUUID();let sent=0;
 const cloud={call:async(_name,input)=>{if(input.changes?.length){sent++;return {accepted:[],conflicts:[{id,current:{id,text:'cloud version',deleted:false,revision:2}}]};}return {notes:[{id,text:'cloud version',revision:2},{id:other,text:'remote note',deleted:false,revision:1}],next_cursor:null};}};
 const result=await syncNotes(cloud,[{id,text:'my local version',cloud_revision:1,sync_dirty:true}]);
 assert.equal(result.conflicts.length,1);assert.equal(result.notes.find(n=>n.id===id).text,'my local version');assert.equal(result.notes.find(n=>n.id===other).text,'remote note');assert.equal(sent,1);
});
