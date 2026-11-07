import test from 'node:test';
import assert from 'node:assert/strict';
import {findUnsupportedActionClaims, truthStatus, safeTruthResponse} from '../src/truth.js';
import {runAgent,toolReceiptForOutcome,unresolvedToolOutcome} from '../src/engine.js';
const text='Výsledok nástroja calculate je: 42';

test('error, blocked and empty results cannot manufacture successful receipts',()=>{
 for(const outcome of [null,undefined,{}, {error:'provider rejected'}, {status:'blocked'}, {status:'cancelled'}, {status:'unavailable'}, {success:false,_evidence:{effect:'mutation',receipt_id:'invented'}}]){
  const receipt=toolReceiptForOutcome('web_fetch',outcome);
  assert.equal(receipt.status,'failed');assert.equal(receipt.receipt_id,undefined);
 }
 assert.equal(toolReceiptForOutcome('write',{_evidence:{effect:'proposal',receipt_id:'proposal'}}).status,'pending');
 assert.equal(toolReceiptForOutcome('write',{status:'approval_required'}).status,'pending');
});

test('a failed calculator cannot be replaced by a bare model answer',async()=>{
 let calls=0;
 const env={AI:{run:async()=>({response:++calls===1?JSON.stringify({tool:'calculate',arguments:{operation:'invented',values:[19,23]}}):'437'})}};
 const result=await runAgent(env,'orchestrator','Použi kalkulačku a potvrď výsledok.','','fast');
 assert.equal(result.execution_status,'failed');assert.notEqual(result.text,'437');
 assert.match(result.text,/nepodarilo.*overiť/);assert.equal(result.tool_log[0].status,'failed');
});

test('explicit named tool request cannot be answered without executing the tool',async()=>{
 const result=await runAgent({AI:{run:async()=>({response:'42'})}},'orchestrator','Použi nástroj calculate na súčin šesť a sedem.','','fast');
 assert.equal(result.execution_status,'failed');assert.notEqual(result.text,'42');
 assert.equal(result.tool_log[0].status,'not_executed');
});

test('engine prompts for an omitted required tool and accepts its real result',async()=>{
 let calls=0;
 const env={AI:{run:async()=>({response:++calls===1?'42':calls===2?JSON.stringify({tool:'calculate',arguments:{operation:'multiply',values:[6,7]}}):'42'})}};
 const result=await runAgent(env,'orchestrator','Použi nástroj calculate na súčin šesť a sedem.','','fast');
 assert.equal(calls,3);assert.equal(result.text,'42');
 assert.equal(result.tool_log[0].tool,'calculate');assert.equal(result.tool_log[0].status,'completed');
});

test('a repaired tool call can finish while unrelated success cannot hide a failure',async()=>{
 let calls=0;
 const env={AI:{run:async()=>({response:++calls===1?JSON.stringify({tool:'calculate',arguments:{operation:'invented',values:[6,7]}}):calls===2?JSON.stringify({tool:'calculate',arguments:{operation:'multiply',values:[6,7]}}):'42'})}};
 const result=await runAgent(env,'orchestrator','Spočítaj súčin šesť a sedem cez nástroj.','','fast');
 assert.equal(result.text,'42');assert.equal(result.tool_log[1].status,'completed');
 assert.equal(unresolvedToolOutcome([{tool:'calculate',status:'failed'},{tool:'current_time',status:'completed',receipt_id:'clock'}]).execution_status,'failed');
 assert.equal(unresolvedToolOutcome([{tool:'pc_run',status:'pending'}]).execution_status,'pending');
});

test('truth policy allows an honest statement that PC access is unavailable',()=>{
 assert.deepEqual(findUnsupportedActionClaims('Nemám prístup k PC. Nemám overený výsledok.',[]),[]);
});

test('direct calculator failure preserves its failed tool log for the workflow',async()=>{
 await assert.rejects(runAgent({},'orchestrator','1 / 0','','fast'),error=>{
  assert.equal(error.tool_log[0].tool,'calculate');
  assert.equal(error.tool_log[0].status,'failed');return /nulou/.test(error.message);
 });
});
test('named tool result requires a successful receipt for the same tool',()=>{
  for(const receipts of [[],[{tool:'calculate',status:'failed',receipt_id:'failed'}],[{tool:'calculate',status:'completed'}],[{tool:'service_status',status:'completed',receipt_id:'other'}]]){
    assert.deepEqual(findUnsupportedActionClaims(text,receipts),['tool_result:calculate']);
  }
  assert.deepEqual(findUnsupportedActionClaims(text,[{tool:'calculate',status:'completed',receipt_id:'actual-calculator'}]),[]);
});
test('English named result and backtick name are checked without blocking ordinary arithmetic',()=>{
  assert.deepEqual(findUnsupportedActionClaims('The result of tool `calculate` is: 42',[]),['tool_result:calculate']);
  assert.deepEqual(findUnsupportedActionClaims('17 + 25 = 42.',[]),[]);
  assert.deepEqual(findUnsupportedActionClaims('Nemám overený výsledok nástroja calculate.',[]),[]);
});
test('engine cannot escape the truth check by removing JSON from a fabricated result',async()=>{
  const result=await runAgent({AI:{run:async()=>({response:text})}},'orchestrator','Daj výsledok pomenovaného nástroja bez volania.','','fast');
  assert.equal(result.tool_log.length,0);
  assert.match(result.text,/Nemám overený/);
  assert.doesNotMatch(result.text,/Výsledok nástroja calculate je/);
});
test('generic tool lifecycle never turns failure or partial work into a completed receipt',()=>{
  const timestamp='2026-10-26T07:10:00.000Z';
  const failed=toolReceiptForOutcome('delegate_worker',{ok:false,status:'not_configured',error:'missing'},timestamp);
  assert.equal(failed.status,'failed');
  assert.equal(failed.receipt_id,undefined);
  assert.equal(failed.effect,'diagnostic');
  const partial=toolReceiptForOutcome('orchestrate_team',{ok:false,status:'partial'},timestamp);
  assert.equal(partial.status,'partial');
  assert.equal(partial.receipt_id,undefined);
  const running=toolReceiptForOutcome('pc_run',{status:'claimed',id:'action-1'},timestamp);
  assert.equal(running.status,'running');
  assert.equal(running.effect,'proposal');
  const completed=toolReceiptForOutcome('calculate',{value:42},timestamp);
  assert.equal(completed.status,'completed');
  assert.match(completed.receipt_id,/^[0-9a-f-]{36}$/);
});

test('hardcore truth policy blocks fabricated document generation and phantom document UUID', ()=>{
  const docClaim = 'Dokumentácia projektu Trinity bola úspešne vygenerovaná a uložená v systéme Trinity Documents. ID dokumentu je 6ae21730-15e8-4ff6-bd4a-af6bfb8facbc.';
  const blockedClaims = findUnsupportedActionClaims(docClaim, []);
  assert.ok(blockedClaims.includes('create_file'), 'Should flag create_file action claim');
  assert.ok(blockedClaims.includes('unsupported_document_id:6ae21730-15e8-4ff6-bd4a-af6bfb8facbc'), 'Should flag phantom document UUID');

  // When completed receipt with matching document UUID is provided:
  const validReceipt = {
    tool: 'trinity_doc_create',
    status: 'completed',
    effect: 'mutation',
    actions: ['create_file'],
    receipt_id: 'doc:6ae21730-15e8-4ff6-bd4a-af6bfb8facbc',
    document_id: '6ae21730-15e8-4ff6-bd4a-af6bfb8facbc'
  };
  assert.deepEqual(findUnsupportedActionClaims(docClaim, [validReceipt]), []);
});

test('hardcore truth policy blocks fabricated github issue creation and phantom issue number', ()=>{
  const issueClaim = 'Dokumentácia projektu Trinity bola úspešne vytvorená ako issue číslo 12 v repozitári uscolective-byte/Trinity-antigravity na GitHub.';
  const blockedClaims = findUnsupportedActionClaims(issueClaim, []);
  assert.ok(blockedClaims.includes('publish'), 'Should flag publish action claim');
  assert.ok(blockedClaims.includes('unsupported_github_issue:12'), 'Should flag phantom issue number 12');

  // When completed receipt with matching issue number is provided:
  const validGhReceipt = {
    tool: 'github_manage',
    status: 'completed',
    effect: 'mutation',
    actions: ['change', 'publish'],
    receipt_id: 'github:create_issue:12',
    issue_number: 12
  };
  assert.deepEqual(findUnsupportedActionClaims(issueClaim, [validGhReceipt]), []);
});
