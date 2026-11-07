import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgent} from '../src/engine.js';
import {formatFleetStatus} from '../src/fleet-response.js';

test('fleet summary counts probe results and rejects a missing canonical collection',()=>{
 assert.match(formatFleetStatus({fleet:'Fleet name'}),/nepodarilo overiť/);
 const text=formatFleetStatus({online_count:999,total_workers:999,workers:[{binding:'ONE',service:'one',status:'unreachable'}],auxiliary_workers:[]});
 assert.match(text,/0\/1 hlavných/);
 assert.doesNotMatch(text,/999/);
});

test('both chat fleet paths consume the real inspectFleet result without inference or invented connectivity',async()=>{
 for(const message of ['Stav workerov','Prosím skontroluj všetky workery a ich stav']){
  const env={
   AURA_ANALYZER:{fetch:async()=>Response.json({ok:true})},
   AURA_PLANNER:{fetch:async()=>new Response('Unavailable',{status:503})},
   CHAT_INFERENCE_SERVICE:{fetch:async()=>Response.json({ok:true})},
   AI:{run:async()=>{throw Error('Fleet status must not use inference');}}
  };
  const result=await runAgent(env,'orchestrator',message,'','fast');
  assert.equal(result.provider,'internal');
  assert.match(result.text,/1\/23/);
  assert.match(result.text,/AURA_ANALYZER/);
  assert.match(result.text,/AURA_PLANNER.*unreachable/);
  assert.match(result.text,/AURA_ARCHITECT.*not_configured/);
  assert.match(result.text,/CHAT_INFERENCE_SERVICE/);
  assert.doesNotMatch(result.text,/undefined|\[object Object\]|Všetky pripojené Workery sú dostupné/);
  assert.equal(result.tool_log.length,1);
  assert.equal(result.tool_log[0].tool,'fleet_status');
  assert.equal(result.tool_log[0].effect,'read');
 }
});
