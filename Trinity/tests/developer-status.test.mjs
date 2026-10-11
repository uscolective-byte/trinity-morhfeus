import test from 'node:test';
import assert from 'node:assert/strict';
import {developerStatus} from '../src/developer-status.js';

test('developer diagnostics are bounded metadata without secrets or raw PC payloads',async()=>{
  const queries=[];
  const env={DB:{prepare:sql=>{queries.push(sql);return{all:async()=>({results:[]})};}},
    Mastermind:{},ARTIFACTS:{},OPS_WORKFLOW:{},AI:{},OPENAI_API_KEY:'synthetic-secret-not-for-output'};
  const result=await developerStatus(env,'9.4.0',{
    readiness:async()=>({ready:true,checks:{schema:true}}),
    pc:async()=>({connected:true,status:'available',lastSeen:'2026-10-11T16:00:00Z',token:'private',files:['private-file']}),
  });
  assert.equal(result.read_only,true);assert.equal(result.partial,false);
  assert.equal(result.providers.openai,true);
  assert.equal(result.pc.connected,true);
  const text=JSON.stringify(result);
  assert.doesNotMatch(text,/synthetic-secret|private-file|"token"/);
  assert.ok(queries.every(sql=>sql.startsWith('SELECT')));
  assert.match(queries[0],/LIMIT 20/);assert.match(queries[1],/LIMIT 15/);
  assert.doesNotMatch(queries[1],/details/);
});

test('failed diagnostic sections are explicit and do not suppress independent results',async()=>{
  const result=await developerStatus({DB:{prepare:()=>({all:async()=>{throw new Error('Sensitive internal error');}})}},'9.4.0',{
    readiness:async()=>({ready:true,checks:{schema:true}}),pc:async()=>{throw new Error('private-token');},
  });
  assert.equal(result.partial,true);assert.equal(result.readiness.ready,true);
  assert.deepEqual(result.unavailable_sections.sort(),['events','jobs','pc']);
  assert.equal(result.pc.connected,false);assert.deepEqual(result.jobs,[]);
  assert.doesNotMatch(JSON.stringify(result),/Sensitive|private-token/);
});

test('non-date heartbeat fields never forward arbitrary bridge objects',async()=>{
  const result=await developerStatus({DB:{prepare:()=>({all:async()=>({results:[]})})}},'9.4.0',{
    readiness:async()=>({ready:false,checks:{}}),
    pc:async()=>({connected:true,status:'available',lastSeen:{secret:'must not appear'}}),
  });
  assert.equal(result.pc.last_seen,null);
  assert.doesNotMatch(JSON.stringify(result),/must not appear/);
});

test('a hung PC status probe becomes partial data instead of hanging the monitor',async()=>{
  const result=await developerStatus({DB:{prepare:()=>({all:async()=>({results:[]})})}},'9.4.0',{
    readiness:async()=>({ready:true,checks:{schema:true}}),pc:()=>new Promise(()=>{}),timeoutMs:5,
  });
  assert.equal(result.partial,true);assert.ok(result.unavailable_sections.includes('pc'));
  assert.equal(result.pc.connected,false);assert.equal(result.readiness.ready,true);
});