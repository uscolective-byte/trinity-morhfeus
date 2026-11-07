import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp} from 'node:fs/promises';
import {DesktopTrinityAgent} from '../modules/trinity-agent.mjs';
import {createLocalApp} from '../server.mjs';

test('desktop agent retains the remote session across restarts',async()=>{
  const dataDir=await mkdtemp(path.join(os.tmpdir(),'trinity-provider-'));const calls=[];
  const client={configuration:()=>({model:'gpt-6-astra'}),run:async input=>{calls.push(input.sessionId);await input.onEvent({type:'agent.session.created',session:{id:'sess_fixture'}});return {status:'completed',session_id:'sess_fixture',output_text:'Fixture response',receipts:[],run_id:'fixture_run'};}};
  const first=new DesktopTrinityAgent({dataDir,clientFactory:async()=>client});
  await first.chat({session_id:'local_uuid',message:'first'});
  const resumed=new DesktopTrinityAgent({dataDir,clientFactory:async()=>client});
  await resumed.chat({session_id:'local_uuid',message:'second'});
  assert.deepEqual(calls,[undefined,'sess_fixture']);
});

test('desktop exposes billing failure and does not substitute another model',async()=>{
  const provider=new DesktopTrinityAgent({dataDir:await mkdtemp(path.join(os.tmpdir(),'trinity-billing-')),clientFactory:async()=>({run:async()=>({status:'failed',error:'usage or billing limit',receipts:[]})})});
  await assert.rejects(provider.chat({session_id:'uuid',message:'test'}),/billing limit/);
});

test('existing desktop chat can select Trinity and stream its real provider events',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'trinity-chat-'));let invoked=0;
  const trinityAgent={configuration:async()=>({api_key_configured:true,name:'Trinity',model:'gpt-6-astra'}),chat:async({onEvent})=>{invoked++;await onEvent({type:'agent.session.turn.output_text.delta',item_id:'m',output_index:0,content_index:0,delta:'Fixture'});return {content:'Fixture',model:'gpt-6-astra',remote_session_id:'sess_fixture',receipts:[],operation_status:'completed'};}};
  const app=await createLocalApp({dataDir:path.join(dir,'Data'),workspace:path.join(dir,'Workspace'),vault:{get:async()=>''},trinityAgent});const {port}=await app.listen(0);t.after(()=>app.close());
  const request=(route,input)=>fetch(`http://127.0.0.1:${port}`+route,{method:'POST',headers:{Authorization:'Bearer '+app.token,'Content-Type':'application/json'},body:JSON.stringify(input)});
  const config=await request('/api/connections',{provider:'trinity'});assert.equal(config.status,200);assert.equal((await config.json()).configured.trinity,true);
  const response=await request('/api/chat/stream',{message:'hello'});const stream=await response.text();
  assert.equal(response.status,200);assert.match(stream,/agent.session.turn.output_text.delta/);assert.match(stream,/trinity.chat.result/);assert.match(stream,/gpt-6-astra/);assert.equal(invoked,1);
});
