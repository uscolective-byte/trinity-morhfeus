import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createEvidenceResponseFilter} from '../src/evidence-response-filter.js';

const now = Date.parse('2026-11-01T04:00:00Z');
const request = {runId:'run-1', operationId:'op-1', action:'create_file',
  target:'C:/workspace/result.txt', receiptId:'receipt-1'};
const receipt = {...request, executorId:'os-executor', proposerId:'planner',
  status:'completed', kind:'process', exitCode:0, observedAt:new Date(now).toISOString()};
const state = {...request, verified:true, verifierId:'state-checker',
  observedAt:new Date(now).toISOString()};
function setup(overrides = {}) {
  const events = [];
  return {events, filter:createEvidenceResponseFilter({
    clock:()=>now, readReceipt:async()=>({...receipt}),
    verifyState:async()=>({...state}),
    appendAudit:async event=>{events.push(event); return {persisted:true,eventId:'event-1'};},
    ...overrides
  })};
}
test('system success requires execution, independent state check and persisted audit', async()=>{
  const {filter,events} = setup();
  const result = await filter({...request,candidateText:'SECRET: I sent money',exitCode:0});
  assert.equal(result.allowed,true);
  assert.equal(result.status,'verified');
  assert.equal(result.auditId,'event-1');
  assert.doesNotMatch(JSON.stringify([result,events]),/SECRET|sent money/);
});
test('missing, foreign, stale, failed or incomplete receipts cannot authorize success', async()=>{
  for (const bad of [null, {...receipt,runId:'other'}, {...receipt,target:'other'},
    {...receipt,operationId:'other'}, {...receipt,receiptId:'other'},
    {...receipt,observedAt:'invalid'}, {...receipt,observedAt:new Date(now-300001).toISOString()},
    {...receipt,exitCode:undefined}, {...receipt,exitCode:1}, {...receipt,signal:'SIGTERM'},
    {...receipt,status:'failed'}, {...receipt,status:'running'}, {...receipt,timedOut:true},
    {...receipt,issuer:'llm_model'}, {...receipt,ok:false}, {...receipt,error:'failed'}]) {
    assert.equal((await setup({readReceipt:async()=>bad}).filter(request)).allowed,false);
  }
  assert.equal((await setup().filter({candidateText:'Created the file',exitCode:0})).status,'unavailable');
});
test('API HTTP success alone is not completion evidence', async()=>{
  const api = {...receipt,kind:'api',httpStatus:200,exitCode:undefined};
  assert.equal((await setup({readReceipt:async()=>api}).filter(request)).allowed,false);
  assert.equal((await setup({readReceipt:async()=>({...api,providerConfirmed:true})}).filter(request)).allowed,true);
  assert.equal((await setup({readReceipt:async()=>({...api,httpStatus:500,providerConfirmed:true})}).filter(request)).allowed,false);
});
test('state check must be fresh, exact, affirmative and independent of planner and executor', async()=>{
  for (const bad of [null,{...state,verified:false},{...state,target:'other'},
    {...state,verifierId:'os-executor'},{...state,verifierId:'planner'},
    {...state,observedAt:new Date(now-1).toISOString()},{...state,issuer:'llm_model'}]) {
    assert.equal((await setup({verifyState:async()=>bad}).filter(request)).allowed,false);
  }
});
test('verification timeout is unknown and never claims the operation did not happen', async()=>{
  const {filter,events} = setup({timeoutMs:10,verifyState:async()=>new Promise(()=>{})});
  const result = await filter(request);
  assert.equal(result.status,'unknown');
  assert.equal(events[0].status,'unknown');
  assert.doesNotMatch(result.text,/nebola vykonaná/);
});
test('permission failures are audited without leaking stack or secrets', async()=>{
  const {filter,events} = setup({readReceipt:async()=>{
    throw Object.assign(new Error('SECRET stack content'),{code:'EACCES'});
  }});
  const result = await filter(request);
  assert.equal(result.status,'denied');
  assert.equal(events[0].reason,'VERIFICATION_ACCESS_DENIED');
  assert.doesNotMatch(JSON.stringify([result,events]),/SECRET/);
});
test('audit failure or queued persistence blocks a verified success', async()=>{
  for (const appendAudit of [async()=>{throw Error('offline');},
    async()=>({persisted:false,eventId:'queued'}),async()=>({persisted:true})]) {
    const result=await setup({appendAudit}).filter(request);
    assert.equal(result.allowed,false);
    assert.equal(result.reason,'AUDIT_UNAVAILABLE');
  }
});
test('separate OS process verifies exact file content, then rejects a missing file', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'trinity-evidence-'));
  const path=join(dir,'result.txt');
  const localRequest={...request,target:path};
  try {
    writeFileSync(path,'actual content','utf8');
    const filter=createEvidenceResponseFilter({
      clock:()=>now,
      // Full-suite process startup on Windows can exceed two seconds under load.
      timeoutMs:15000,
      readReceipt:async()=>({...receipt,target:path}),
      verifyState:async identity=>{
        const child=spawnSync(process.execPath,['--input-type=module','-e',
          "import {readFileSync} from 'node:fs'; process.exit(readFileSync(process.argv[1],'utf8') === 'actual content' ? 0 : 1);",path],
          {encoding:'utf8',timeout:10000});
        return {...state,...identity,verifierId:'os-child-'+child.pid,verified:child.status===0};
      },
      appendAudit:async()=>({persisted:true,eventId:'test-audit'})
    });
    assert.equal((await filter(localRequest)).allowed,true);
    rmSync(path);
    assert.equal((await filter(localRequest)).allowed,false);
  } finally {
    rmSync(dir,{recursive:true,force:true});
  }
});
