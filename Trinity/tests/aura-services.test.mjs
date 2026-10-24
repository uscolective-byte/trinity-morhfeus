import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../services/aura-entry.js';

const base={AI:{},DB:{prepare:()=>({bind(){return this;},run:async()=>({success:true})})},IDEMPOTENCY:{get:async()=>null,put:async()=>{}}};
for(const role of ['aura_analyzer','aura_architect','aura_codegen','aura_deployer','aura_evolver','aura_memory','aura_optimizer','aura_planner','aura_sentinel','aura_tester']){
  test(`${role} exposes bounded health`,async()=>{const env={...base,WORKER_ROLE:role,...(role==='aura_deployer'?{CODE_KV:{}}:{})};const response=await worker.fetch(new Request('https://aura.internal/health'),env);assert.equal(response.status,200);assert.equal((await response.json()).status,'serving');});
}
test('unknown actions and malformed input fail closed',async()=>{const env={...base,WORKER_ROLE:'aura_analyzer'};assert.equal((await worker.fetch(new Request('https://aura.internal/',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"shell","data":{}}'}),env)).status,400);assert.equal((await worker.fetch(new Request('https://aura.internal/',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'}),env)).status,400);});
test('deployment mutations require approval and idempotency',async()=>{const env={...base,WORKER_ROLE:'aura_deployer',CODE_KV:{}};const request=body=>new Request('https://aura.internal/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal((await worker.fetch(request({action:'deploy.rollback',data:{version_id:'x'}}),env)).status,403);assert.equal((await worker.fetch(request({action:'deploy.rollback',data:{version_id:'x'},approval:{approved:true,actor_role:'owner',request_id:crypto.randomUUID()}}),env)).status,403);});
test('endpoint tester blocks arbitrary SSRF targets',async()=>{const env={...base,WORKER_ROLE:'aura_tester'};const response=await worker.fetch(new Request('https://aura.internal/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'test.endpoint',data:{url:'http://127.0.0.1/admin'},approval:{approved:true,actor_role:'owner',request_id:crypto.randomUUID()}})}),env);assert.equal(response.status,403);});

test('reconciled Aura services retain deployed actions and bounded status without invoking AI for probes',async()=>{
  for(const role of ['aura_architect','aura_codegen','aura_planner']){
    const response=await worker.fetch(new Request('https://aura.internal/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'aura.status',data:{}})}),{...base,WORKER_ROLE:role,AI:{run(){throw new Error('Health probe must not invoke AI');}}});
    assert.equal(response.status,200,role);assert.equal((await response.json()).ok,true);
  }
  for(const [role,action] of [['aura_architect','architect.review'],['aura_codegen','codegen.docs'],['aura_planner','plan.timeline']]){
    const response=await worker.fetch(new Request('https://aura.internal/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data:{}})}),{...base,WORKER_ROLE:role,AI:{run:async()=>({response:'{"reviewed":true}'})}});
    assert.equal(response.status,200,action);assert.equal((await response.json()).result.reviewed,true);
  }
});

test('recovered actions that store generated content require idempotency',async()=>{
  const token='unit-test-shared-internal-service-token-very-long';
  for(const [role,action] of [['aura_codegen','codegen.refactor'],['aura_codegen','codegen.scaffold'],['aura_planner','plan.task'],['aura_planner','plan.project']]){
    const response=await worker.fetch(new Request('https://aura.internal/',{method:'POST',headers:{'Content-Type':'application/json','X-Aura-Service-Token':token},body:JSON.stringify({action,data:{},approval:{approved:true,actor_role:'owner',request_id:crypto.randomUUID()}})}),{...base,WORKER_ROLE:role,AURA_SERVICE_TOKEN:token});
    assert.equal(response.status,400,action);assert.match((await response.json()).error,/idempotency_key/);
  }
});

test('all Aura workers expose aura.skills and can execute skills', async () => {
  for (const role of ['aura_analyzer', 'aura_architect', 'aura_codegen', 'aura_deployer', 'aura_evolver', 'aura_memory', 'aura_optimizer', 'aura_planner', 'aura_sentinel', 'aura_tester']) {
    const env = { ...base, WORKER_ROLE: role, ...(role === 'aura_deployer' ? { CODE_KV: {} } : {}) };
    const resList = await worker.fetch(new Request('https://aura.internal/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'aura.skills', data: {} })
    }), env);
    assert.equal(resList.status, 200, role);
    const bodyList = await resList.json();
    assert.equal(bodyList.ok, true);
    assert.deepEqual(bodyList.skills.map(s=>s.name).sort(),['integrationReadiness','semverCheck']);

    const resExec = await worker.fetch(new Request('https://aura.internal/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'aura.execute_skill', data: { skill: 'semverCheck', params: { version: '2.1.0' } } })
    }), env);
    assert.equal(resExec.status, 200, role);
    const bodyExec = await resExec.json();
    assert.equal(bodyExec.ok, true);
    assert.equal(bodyExec.result.major, 2);
  }
});

test('Aura refuses high-privilege registry skills and keeps diagnostics read-only',async()=>{
 const env={...base,WORKER_ROLE:'aura_analyzer'};
 const req=skill=>new Request('https://aura.internal/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'aura.execute_skill',data:{skill,params:{domain_name:'example.com'}}})});
 for(const skill of ['domainRegister','domainSetDns','domainSell','callPowerPlatform']){
   const response=await worker.fetch(req(skill),env);
   assert.equal(response.status,403,skill);
 }
});

test('Aura mutating actions need a verified service token, not client approval flags',async()=>{
 const token='unit-test-shared-internal-service-token-very-long';
 const env={...base,WORKER_ROLE:'aura_deployer',AURA_SERVICE_TOKEN:token,CODE_KV:{put:async()=>{},delete:async()=>{}}};
 const req=(headers={})=>new Request('https://aura.internal/',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({action:'deploy.stage',data:{name:'website',code:'export default 1'},idempotency_key:crypto.randomUUID(),approval:{approved:true,actor_role:'owner',request_id:crypto.randomUUID()}})});
 assert.equal((await worker.fetch(req(),env)).status,403);
 assert.equal((await worker.fetch(req({'X-Aura-Service-Token':'wrong-secret'}),env)).status,403);
 const good=await worker.fetch(req({'X-Aura-Service-Token':token}),env);
 assert.equal(good.status,200);
 assert.equal((await good.json()).result.cloudflare_deployed,false);
});

test('Aura cannot claim external deployment or rollback without an actual provider receipt',async()=>{
 const token='unit-test-shared-internal-service-token-very-long';
 const env={...base,WORKER_ROLE:'aura_deployer',AURA_SERVICE_TOKEN:token,CODE_KV:{put:async()=>{},delete:async()=>{}}};
 const req=action=>new Request('https://aura.internal/',{method:'POST',headers:{'Content-Type':'application/json','X-Aura-Service-Token':token},body:JSON.stringify({action,data:{version_id:'abc'},idempotency_key:crypto.randomUUID(),approval:{approved:true,actor_role:'owner',request_id:crypto.randomUUID()}})});
 for(const action of ['deploy.complete','deploy.rollback']){
  const response=await worker.fetch(req(action),env);
  assert.equal(response.status,501);
  assert.equal((await response.json()).ok,false);
 }
});

test('Aura endpoint checks enforce exact domains, no credentials, no redirects and read-only methods',async()=>{
 const env={...base,WORKER_ROLE:'aura_tester',AURA_SERVICE_TOKEN:'unit-test-shared-internal-service-token-very-long'};
 const request=(url,method)=>new Request('https://aura.internal/',{method:'POST',headers:{'Content-Type':'application/json','X-Aura-Service-Token':env.AURA_SERVICE_TOKEN},body:JSON.stringify({action:'test.endpoint',data:{url,method},approval:{approved:true,actor_role:'owner',request_id:crypto.randomUUID()}})});
 for(const url of ['https://auru.space@evil.example/health','https://auru.space/admin','https://auru.space:444/health','https://auru.space/health?token=1','https://other.saboivan2008.workers.dev/health']){
  const r=await worker.fetch(request(url,'GET'),env);assert.equal(r.status,403,url);
 }
 const allowed=await worker.fetch(request('https://auru.dev/health','POST'),env);assert.equal(allowed.status,400);
});

test('a real SQL write error returns a failed Aura action instead of fabricated success',async()=>{
 const token='unit-test-shared-internal-service-token-very-long';
 const env={...base,WORKER_ROLE:'aura_codegen',AURA_SERVICE_TOKEN:token,
   AI:{run:async()=>({response:JSON.stringify({code:'export const value=1',language:'javascript'})})},
   DB:{prepare(sql){if(sql.startsWith('INSERT INTO code_snippets'))return{bind(){return this;},run:async()=>{throw new Error('D1 unavailable');}};return{bind(){return this;},run:async()=>({success:true})};}}
 };
 const req=new Request('https://aura.internal/',{method:'POST',headers:{'Content-Type':'application/json','X-Aura-Service-Token':token},body:JSON.stringify({action:'codegen.generate',data:{spec:'small helper'},idempotency_key:crypto.randomUUID(),approval:{approved:true,actor_role:'owner',request_id:crypto.randomUUID()}})});
 const res=await worker.fetch(req,env);assert.equal(res.status,500);assert.equal((await res.json()).ok,false);
});

test('Aura role status uses the shared protocol version',async()=>{
 for(const role of ['aura_analyzer','aura_architect','aura_codegen','aura_deployer','aura_evolver','aura_memory','aura_optimizer','aura_planner','aura_sentinel','aura_tester']){
  const env={...base,WORKER_ROLE:role,AI:{run(){throw Error('status must not query AI');}}};
  const res=await worker.fetch(new Request('https://aura.internal/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'aura.status',data:{}})}),env);
  assert.equal(res.status,200,role);
  const body=await res.json();assert.equal(body.result.version,body.service_version,role);
  assert.equal(body.result.version,'2.1.0',role);
 }
});
