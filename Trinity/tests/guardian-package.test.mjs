import test from 'node:test';
import assert from 'node:assert/strict';
import packaged from '../../packages/trinity-guardian/src/index.js';
import guardian from '../services/guardian.js';
import skills from '../services/skills.js';
const key='fixture-guardian-key';
const request=(action,token,host='trinity.internal')=>new Request('https://'+host+'/',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action})});
test('both Guardian entry points support the authenticated orchestrator contract',async()=>{
  for(const worker of [packaged,guardian]) {
    const result=await worker.fetch(request('audit.list',key),{TRINITY_INTERNAL_KEY:key});
    assert.equal(result.status,200);assert.deepEqual((await result.json()).result,[]);
    const failed=await worker.fetch(request('guardian.check',key),{TRINITY_INTERNAL_KEY:key,TRINITY:{fetch:async()=>{throw Error('fixture outage');}}});
    assert.equal(failed.status,503);assert.equal((await failed.json()).ok,false);
  }
});
test('hostnames never grant internal access without a configured secret',async()=>{
  for(const worker of [packaged,guardian,skills]) for(const host of ['trinity.internal','localhost','127.0.0.1']) {
    const result=await worker.fetch(request(worker===skills?'skill.register':'audit.list',key,host),{});
    assert.equal(result.status,401);
  }
});
test('package denies legacy audit and healing before touching storage or AI',async()=>{
  for(const path of ['/audit','/heal','/dashboard']) {
    const res=await packaged.fetch(new Request('https://guardian.test'+path,{method:path==='/dashboard'?'GET':'POST'}),{});
    assert.equal(res.status,401);
  }
  const health=await packaged.fetch(new Request('https://guardian.test/health'),{});
  assert.equal(health.status,200);assert.equal((await health.json()).status,'serving');
});
