import {test} from 'node:test';
import assert from 'node:assert/strict';
import builder from '../services/builder.js';
import connectors from '../services/connectors.js';

function request(body){return new Request('https://trinity.internal/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});}
function envFor(rows=[]){
  const queries=[];
  const DB={prepare(sql){queries.push(sql);return {bind(){return this;},all:async()=>({results:rows}),first:async()=>rows[0]||null,run:async()=>({success:true})};}};
  return {DB,AI:{run:async()=>({response:'export const ok = true;'})},IDEMPOTENCY:{get:async()=>null,put:async()=>{}},queries};
}

test('builder reads the deployed code_storage schema',async()=>{
  const env=envFor([{id:'one',code:'x',created_at:'now'}]);
  const response=await builder.fetch(request({action:'build.list',data:{limit:1}}),env);
  assert.equal(response.status,200);assert.equal((await response.json()).result[0].id,'one');
  assert.match(env.queries[0],/SELECT id, code, created_at FROM code_storage/);
  assert.doesNotMatch(env.queries[0],/language|title/);
});

test('builder mutations require an idempotency UUID',async()=>{
  const env=envFor();
  assert.equal((await builder.fetch(request({action:'build.store',data:{code:'const x=1'}}),env)).status,400);
  assert.equal((await builder.fetch(request({action:'build.store',data:{code:'const x=1'},idempotency_key:crypto.randomUUID()}),env)).status,200);
});

test('connectors use deployed columns and protect mutations',async()=>{
  const env=envFor([{id:'c1',name:'Cloudflare',type:'api',status:'active',config:'{}'}]);
  const list=await connectors.fetch(request({action:'connect.list',data:{}}),env);
  assert.equal(list.status,200);assert.match(env.queries[0],/updated_at FROM connectors/);assert.doesNotMatch(env.queries[0],/endpoint/);
  const denied=await connectors.fetch(request({action:'connect.register',data:{name:'bad',config:{endpoint:'https://example.com'}}}),env);
  assert.equal(denied.status,403);
});

test('connector endpoint validation blocks SSRF targets',async()=>{
  const env=envFor();
  const response=await connectors.fetch(request({action:'connect.register',data:{name:'local',config:{endpoint:'https://127.0.0.1/private'}},approval:{approved:true,role:'owner'},idempotency_key:crypto.randomUUID()}),env);
  assert.equal(response.status,403);
});
