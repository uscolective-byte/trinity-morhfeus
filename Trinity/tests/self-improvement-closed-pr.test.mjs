import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reconcileSelfImprovements} from '../src/self-improvement.js';

test('closed unmerged improvement stops reconciliation without merging or claiming deployment',async()=>{
 const row={id:'proposal-1',kind:'code_improvement',status:'approved',result_json:JSON.stringify({status:'pull_request_created',pull_request:7,url:'https://github.com/example/pull/7'})};
 const events=[],requests=[];
 const env={TRINITY_GITHUB_TOKEN:'test-token',DB:{prepare(sql){
  let params=[];
  return {
   bind(...args){params=args;return this;},
   async all(){return {results:[{...row}]};},
   async run(){
    if(sql.startsWith('UPDATE self_improvement_proposals')){
     assert.match(sql,/status='rejected'/);assert.match(sql,/AND status='approved'/);assert.equal(params[1],row.id);
     if(row.status==='approved'){row.status='rejected';row.result_json=params[0];}
    }else if(sql.startsWith('INSERT INTO ops_events'))events.push(params);
    return {success:true};
   }
  };
 }}};
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{
   requests.push({url,method:options.method});
   assert.match(url,/\/pulls\/7$/);assert.equal(options.method,'GET');
   return Response.json({number:7,state:'closed',merged_at:null,closed_at:'2026-10-21T10:00:00Z'});
  };
  const result=await reconcileSelfImprovements(env);
  assert.equal(row.status,'rejected');assert.equal(result[0].status,'pull_request_closed');assert.equal(result[0].deployed,false);
  assert.equal(result[0].closed_at,'2026-10-21T10:00:00Z');
  assert.equal(events[0][0],'self_improvement_pull_request_closed');
  assert.deepEqual(await reconcileSelfImprovements(env),[]);assert.equal(requests.length,1);
 }finally{globalThis.fetch=old;}
});
