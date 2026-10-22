import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../public/assistant/chat.js.txt',import.meta.url),'utf8');
const start=source.indexOf('function selfImprovementApplyLabel');
const end=source.indexOf('function renderSelfImprovement',start);
assert.notEqual(start,-1,'self-improvement label helper is present');
assert.ok(end>start,'helper can be isolated from the shipped UI source');
const selfImprovementApplyLabel=new Function(source.slice(start,end)+';return selfImprovementApplyLabel;')();
const now=Date.parse('2026-10-21T20:00:00Z');

test('self-improvement UI offers only valid apply and recovery actions',()=>{
  assert.equal(selfImprovementApplyLabel({status:'approved',kind:'code',result_json:null},now),'Vykonať návrh');
  assert.equal(selfImprovementApplyLabel({status:'approved',kind:'plugin_install',result_json:null},now),'Nainštalovať modul');
  assert.equal(selfImprovementApplyLabel({status:'approved',kind:'code',result_json:{status:'failed'}},now),'Skúsiť znova');
  assert.equal(selfImprovementApplyLabel({status:'approved',kind:'code',result_json:{status:'preparing',started_at:'2026-10-21T19:45:00.001Z'}},now),null);
  assert.equal(selfImprovementApplyLabel({status:'approved',kind:'code',result_json:{status:'preparing',started_at:'2026-10-21T19:45:00.000Z'}},now),'Obnoviť spracovanie');
  assert.equal(selfImprovementApplyLabel({status:'approved',kind:'code',result_json:{status:'preparing',started_at:'invalid'}},now),null);
  assert.equal(selfImprovementApplyLabel({status:'pending',kind:'code',result_json:null},now),null);
  assert.equal(selfImprovementApplyLabel({status:'approved',kind:'code',result_json:{status:'pull_request_created'}},now),null);
});
