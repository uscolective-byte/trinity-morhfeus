import test from 'node:test';
import assert from 'node:assert/strict';
import {attachHostedDomain} from '../src/hosted-domains.js';
const site_id='12345678-1234-4123-8123-123456789012',worker='trinity-site-12345678-1234-4123';
const input={site_id,domain:'example.com',hostname:'app.example.com'};
function fixture({records=[],zoneAccount='account',hostname=input.hostname}={}){
 const writes=[],requests=[],site={id:site_id,worker,visibility:'private'};
 const env={CF_ACCOUNT_ID:'account',DB:{
  prepare(sql){
   return {bind(...values){
    return {first:async()=>({value:JSON.stringify(site)}),run:async()=>{writes.push({sql,values});}};
   }};
  }
 }};
 const deps={lookup:async()=>({domain_name:'example.com',zone_id:'zone'}),request:async(_env,path,method='GET',body)=>{
  requests.push({path,method,body});
  if(path==='/zones/zone')return {result:{name:'example.com',status:'active',account:{id:zoneAccount}}};
  if(path.includes('/dns_records'))return {result:records};
  assert.equal(path,'/accounts/account/workers/domains');assert.equal(method,'PUT');
  return {result:{id:'attachment',hostname,service:worker}};
 }};
 return {env,deps,writes,requests};
}
test('attaches an unused hostname without claiming TLS or HTTP readiness',async()=>{
 const f=fixture(),result=await attachHostedDomain(f.env,input,f.deps);
 assert.equal(result.status,'attached');assert.equal(result.verification,'pending');assert.equal(result.visibility,'private');
 assert.equal(f.writes.length,2);assert.equal(f.requests.at(-1).body.zone_id,'zone');
 assert.equal(f.requests.at(-1).body.service,worker);
});
test('existing DNS and a foreign account block mutation',async()=>{
 for(const config of [{records:[{id:'existing'}]},{zoneAccount:'other'}]){
  const f=fixture(config);await assert.rejects(attachHostedDomain(f.env,input,f.deps),e=>e.status===409);
  assert.ok(f.requests.every(r=>r.method==='GET'));assert.equal(f.writes.length,0);
 }
});
test('suffix confusion and incorrect provider receipts are rejected',async()=>{
 let f=fixture();await assert.rejects(attachHostedDomain(f.env,{...input,hostname:'appexample.com'},f.deps),e=>e.status===400);
 assert.equal(f.requests.length,0);
 f=fixture({hostname:'wrong.example.com'});await assert.rejects(attachHostedDomain(f.env,input,f.deps),e=>e.status===502);assert.equal(f.writes.length,0);
});
