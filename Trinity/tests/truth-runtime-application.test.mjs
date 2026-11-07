import test from 'node:test';
import assert from 'node:assert/strict';
import {finalizeAgentResponse,findUnsupportedActionClaims} from '../src/truth.js';
import {runAgent,pcActionReceipt,toolReceiptForOutcome} from '../src/engine.js';
import {formatAppOpenResult,formatWalletStatus,formatIntegrationStatus,formatCloudflareStatus,formatGitHubStatus,formatInfrastructureStatus,UNAVAILABLE} from '../src/verified-response-formatters.js';
const completed={tool:'pc_open_app',status:'completed',effect:'mutation',actions:['execute'],receipt_id:'real-executor-result'};

test('public response finalizer blocks false success despite caller supplied passed metadata',()=>{
  const result=finalizeAgentResponse({text:'Otvorila som aplikáciu Kalkulačka na tvojom počítači.',truth:{status:'passed'},tool_log:[]});
  assert.equal(result.truth.status,'blocked');
  assert.equal(result.truth.response_filtered,true);
  assert.match(result.text,/Nemám overený/);
  assert.doesNotMatch(result.text,/Otvorila som/);
});
test('failed, pending, forged, wildcard or string-action receipts cannot certify execution',()=>{
  for(const receipt of [{...completed,status:'pending'},{...completed,error:'failed'},{...completed,success:false},
    {...completed,issuer:'llm_model'},{...completed,forged:true},{...completed,receipt_id:' '},
    {...completed,actions:'execute'},{...completed,actions:[],action:'*'}]){
    assert.deepEqual(findUnsupportedActionClaims('Otvorila som aplikáciu Kalkulačka.',[receipt]),['execute']);
  }
  const result=finalizeAgentResponse({text:'Otvorila som aplikáciu Kalkulačka.',tool_log:[completed]});
  assert.equal(result.truth.status,'passed');
  assert.equal(result.truth.response_filtered,false);
});
test('the real agent entrypoint rejects model-generated application launch success',async()=>{
  const result=await runAgent({AI:{run:async()=>({response:'Otvorila som aplikáciu Kalkulačka.'})}},
    'orchestrator','Daj finálnu správu bez volania nástroja.','','fast',500,'sk');
  assert.match(result.text,/Nemám overený/);
  assert.equal(result.tool_log.length,0);
});
test('unverified assumptions do not bypass the shared finalizer with a read-only receipt',()=>{
  const result=finalizeAgentResponse({text:'Malo by to bežať na pozadí.',tool_log:[
    {tool:'calculate',status:'completed',effect:'read',receipt_id:'unrelated-read'}]});
  assert.equal(result.truth.status,'blocked');
  assert.ok(result.truth.unsupported_claims.includes('unsupported_assumption'));
});
test('an unrelated issue number or substring document UUID cannot prove the claimed entity',()=>{
  const text='Vytvorila som issue číslo 12.';
  const wrong={tool:'github_manage',status:'completed',effect:'mutation',actions:['publish'],
    receipt_id:'issue:123',url:'https://github.com/owner/repo/issues/123'};
  assert.ok(findUnsupportedActionClaims(text,[wrong]).includes('unsupported_github_issue:12'));
  assert.deepEqual(findUnsupportedActionClaims(text,[{...wrong,receipt_id:'issue:12',issue_number:12}]),[]);
  const uuid='6ae21730-15e8-4ff6-bd4a-af6bfb8facbc';
  assert.ok(findUnsupportedActionClaims('ID dokumentu je '+uuid,[{...completed,receipt_id:'unrelated:'+uuid+':suffix'}])
    .includes('unsupported_document_id:'+uuid));
});
test('app result formatting follows receipt state, not the launch request or generated identifier',()=>{
  for(const outcome of [{desktop:{operation:'launch'},id:'generated'},
    {status:'completed',_evidence:{receipt_id:'result'},desktop:{opened:false}},
    {status:'failed',desktop:{operation:'launch'}}]){
    const receipt=pcActionReceipt(outcome);
    assert.doesNotMatch(formatAppOpenResult('Kalkulačka',receipt),/Otvorila som/);
  }
  assert.match(formatAppOpenResult('Kalkulačka',pcActionReceipt({status:'completed',_evidence:{receipt_id:'result'}})),/Otvorila som/);
});
test('missing tool results and explicit uncertainty never become completed receipts',()=>{
  for(const outcome of [null,undefined,{status:'unknown'},{status:'denied'},{error:'failed'},{status:'cancelled'}]){
    assert.notEqual(toolReceiptForOutcome('tool',outcome).status,'completed');
  }
});
test('wallet distinguishes missing values, invalid values and actual zero without fake payment configuration',()=>{
  const absent=formatWalletStatus({});
  assert.match(absent,new RegExp(UNAVAILABLE));
  assert.doesNotMatch(absent,/0\.00|0x\.\.\.|Polygon|pripravený|Okamžitý/);
  assert.match(formatWalletStatus({wallet:{balance_eur:0}}),/Celkový zostatok: 0\.00 EUR/);
  for(const balance_eur of [null,'100',NaN,Infinity]){
    assert.match(formatWalletStatus({wallet:{balance_eur}}),new RegExp('Celkový zostatok: '+UNAVAILABLE));
  }
});
test('configuration summaries never invent account, connectivity or issue counts',()=>{
  assert.doesNotMatch(formatCloudflareStatus({}),/b60342|plne aktívne|workerd/);
  assert.match(formatGitHubStatus({}),new RegExp('Otvorené issues: '+UNAVAILABLE));
  assert.match(formatGitHubStatus({details:{open_issues:0}}),/Otvorené issues: 0/);
  assert.doesNotMatch(formatInfrastructureStatus({hosting:{configured:true}}),/ONLINE|Aktívny|Cloudflare overené/);
  const integrations=formatIntegrationStatus({integrations:[{name:'Firebase',status:'AWAITING_AUTH'}]});
  assert.match(integrations,/Firebase: AWAITING_AUTH/);
  assert.doesNotMatch(integrations,/Trinity má priame napojenie/);
});
