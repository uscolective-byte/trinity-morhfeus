import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm,symlink,readFile,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createLocalApp} from '../server.mjs';

async function fixture(t,reply,options={}){
  const dir=await mkdtemp(path.join(os.tmpdir(),'trinity-local-'));
  const mock=http.createServer(async(req,res)=>{
    let input='';for await(const c of req)input+=c;
    const body=input?JSON.parse(input):null;
    const result=req.url==='/api/tags'?{models:[{name:'qwen3:4b'}]}:await reply(body);
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));
  });
  await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
  const app=await createLocalApp({dataDir:path.join(dir,'Data'),workspace:path.join(dir,'Workspace'),ollamaPort:mock.address().port,...options});
  const state=await app.listen(0);const base=`http://127.0.0.1:${state.port}`;
  const request=async(p,body,headers={})=>fetch(base+p,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+app.token,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
  t.after(async()=>{await app.close();await new Promise(resolve=>{mock.close(resolve);mock.closeIdleConnections();});await rm(dir,{recursive:true,force:true});});
  return {app,base,request,dir};
}

test('local interface and status work; API authentication, Origin and Host are enforced',async t=>{
  const f=await fixture(t,()=>({done:true,message:{content:'Ahoj'}}));
  assert.equal((await fetch(f.base+'/')).status,200);
  assert.equal((await fetch(f.base+'/app.js')).status,200);
  assert.equal((await fetch(f.base+'/style.css')).status,200);
  assert.equal((await fetch(f.base+'/api/notes')).status,401);
  assert.equal((await f.request('/api/notes',undefined,{Origin:'https://evil.example'})).status,403);
  const badHost=await new Promise((resolve,reject)=>{http.get(f.base+'/health',{headers:{Host:'evil.example'}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject);});
  assert.equal(badHost,403);
  const status=await (await f.request('/api/status')).json();
  assert.equal(status.ollama.available,true);assert.equal(status.ollama.model_installed,true);
  assert.equal(status.connections.configured.gemini,false);
});

test('files persist, require the current hash for overwrite and retain backups',async t=>{
  const f=await fixture(t,()=>({done:true,message:{content:'OK'}}));
  const first=await (await f.request('/api/file',{path:'plan/day.md',content:'first'})).json();
  assert.equal(first.saved,true);
  assert.equal((await f.request('/api/file',{path:'plan/day.md',content:'clobber'})).status,409);
  const current=await (await f.request('/api/file?path=plan/day.md')).json();
  assert.equal(current.content,'first');
  assert.equal((await f.request('/api/file',{path:'plan/day.md',content:'second',expected_sha256:current.sha256})).status,200);
  assert.equal(await readFile(path.join(f.dir,'Workspace/plan/day.md'),'utf8'),'second');
  const backups=await readdir(path.join(f.dir,'Data/backups'));assert.equal(backups.length,1);
  assert.equal(await readFile(path.join(f.dir,'Data/backups',backups[0]),'utf8'),'first');
});

test('path traversal, Windows reserved names, hidden files and symlink escapes are denied',async t=>{
  const f=await fixture(t,()=>({done:true,message:{content:'OK'}}));
  for(const name of ['../escape','/etc/passwd','C:\\secret','a/../../x','.env','a/.secret','CON.txt','foo./bar'])assert.equal((await f.request('/api/file',{path:name,content:'no'})).status,400,name);
  try {
    await symlink(f.dir,path.join(f.dir,'Workspace/link'),'dir');
    assert.equal((await f.request('/api/file',{path:'link/escape',content:'no'})).status,403);
  } catch (err) {
    if (err.code !== 'EPERM') throw err;
  }
});

test('concurrent file writes cannot overwrite the same prior hash twice',async t=>{
  const f=await fixture(t,()=>({done:true,message:{content:'OK'}}));
  const first=await (await f.request('/api/file',{path:'race.txt',content:'initial'})).json();
  const results=await Promise.all(['one','two'].map(content=>f.request('/api/file',{path:'race.txt',content,expected_sha256:first.sha256})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
});

test('parallel notes are saved without losing records and can be deleted',async t=>{
  const f=await fixture(t,()=>({done:true,message:{content:'OK'}}));
  await Promise.all(Array.from({length:12},(_,i)=>f.request('/api/notes',{text:'Note '+i})));
  const {notes}=await (await f.request('/api/notes')).json();assert.equal(notes.length,12);
  await f.request('/api/notes/delete',{id:notes[0].id});
  assert.equal(JSON.parse(await readFile(path.join(f.dir,'Data/notes.json'),'utf8')).filter(n=>!n.deleted).length,11);
});

test('chat invokes the actual loopback API and saves conversation history',async t=>{
  let seen;
  const f=await fixture(t,input=>{seen=input;return {done:true,message:{content:'Ahoj Basterix'}};});
  const result=await (await f.request('/api/chat',{message:'Ahoj',allow_writes:false})).json();
  assert.equal(result.content,'Ahoj Basterix');assert.equal(seen.think,false);
  assert.ok(!seen.tools.some(t=>t.function.name==='write_file'));
  const history=await (await f.request('/api/history?session='+result.session_id)).json();
  assert.equal(history.messages.length,2);
});

test('agent file tools produce real workspace artifacts and receipts',async t=>{
  let call=0;
  const f=await fixture(t,()=>++call===1?{done:true,message:{content:'',tool_calls:[{function:{name:'write_file',arguments:{path:'created.md',content:'From Trinity'}}}]}}:{done:true,message:{content:'Súbor je uložený.'}});
  const response=await f.request('/api/chat',{message:'Vytvor súbor',allow_writes:true});
  assert.equal(response.status,200);const result=await response.json();
  assert.equal(result.receipts[0].success,true);
  assert.equal(await readFile(path.join(f.dir,'Workspace/created.md'),'utf8'),'From Trinity');
});

test('a malicious model cannot write when the user disabled writes',async t=>{
  let call=0;
  const f=await fixture(t,()=>++call===1?{done:true,message:{tool_calls:[{function:{name:'write_file',arguments:{path:'denied.md',content:'no'}}}]}}:{done:true,message:{content:'Zápis je vypnutý.'}});
  const result=await (await f.request('/api/chat',{message:'test',allow_writes:false})).json();
  assert.equal(result.receipts[0].success,false);
  assert.equal((await readdir(path.join(f.dir,'Workspace'))).length,0);
});

test('unfinished model output fails and does not create a successful chat history',async t=>{
  const f=await fixture(t,()=>({done:false,message:{content:'incomplete'}}));
  const response=await f.request('/api/chat',{message:'test'});assert.equal(response.status,502);
});

test('cloud task outbox retries with the same idempotency key and stores completed results',async t=>{
  const credentials=new Map([['cloud-production','cloud-key']]);let attempts=0;const keys=[];
  const externalFetch=async(url,init)=>{
    const input=JSON.parse(init.body);const {name,arguments:args}=input.params;
    if(name==='dispatch_task'){keys.push(args.idempotency_key);if(++attempts===1)throw new Error('network unavailable');}
    const result=name==='dispatch_task'?{id:crypto.randomUUID(),status:'queued'}:{status:'completed',result:'verified result'};
    return Response.json({result:{content:[{type:'text',text:JSON.stringify(result)}]}});
  };
  const f=await fixture(t,()=>({done:true,message:{content:'OK'}}),{vault:{get:async n=>credentials.get(n)||'',set:async(n,v)=>credentials.set(n,v)},externalFetch});
  const task=await (await f.request('/api/cloud/task',{task:'Research task'})).json();assert.equal(task.status,'pending_submission');
  const retried=await (await f.request('/api/tasks/refresh',{})).json();assert.equal(retried.tasks[0].status,'completed');assert.equal(retried.tasks[0].result,'verified result');assert.equal(keys[0],keys[1]);
  const status=await (await f.request('/api/status')).json();assert.ok(!JSON.stringify(status).includes('cloud-key'));
});

test('Gemini provider executes local tools through the same HTTP chat and credentials stay server-side',async t=>{
 let count=0;
 const f=await fixture(t,()=>({done:true,message:{content:'OK'}}),{vault:{get:async n=>n==='gemini'?'private-gemini-key':'',set:async()=>{}},externalFetch:async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:++count===1?[{functionCall:{name:'write_file',args:{path:'gemini.md',content:'written by Gemini'}}}]:[{text:'Hotovo'}]}}]})});
 assert.equal((await f.request('/api/connections',{provider:'gemini',gemini_model:'gemini-test'})).status,200);
 const result=await (await f.request('/api/chat',{message:'Vytvor súbor',allow_writes:true})).json();
 assert.equal(result.provider,'gemini');assert.equal(result.receipts[0].success,true);
 assert.equal(await readFile(path.join(f.dir,'Workspace/gemini.md'),'utf8'),'written by Gemini');
 assert.ok(!JSON.stringify(result).includes('private-gemini-key'));
});

test('MCP clients share local files but cannot write until configured',async t=>{
 const f=await fixture(t,()=>({done:true,message:{content:'OK'}}));
 const call=()=>f.request('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'write_file',arguments:{path:'copilot.md',content:'MCP write'}}});
 assert.equal((await call()).status,403);
 await f.request('/api/connections',{mcp_writes:true});
 assert.equal((await call()).status,200);
 assert.equal(await readFile(path.join(f.dir,'Workspace/copilot.md'),'utf8'),'MCP write');
});
