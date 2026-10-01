import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeActionEvent,sanitizeHeartbeat} from '../src/policy.js';

test('heartbeat keeps only bounded capabilities',()=>{
  const result=sanitizeHeartbeat({gateway_id:'gateway:test',version:'1.2.0',capabilities:['read','run',123]});
  assert.deepEqual(result,{gateway_id:'gateway:test',version:'1.2.0',capabilities:['read','run']});
});

test('action events require UUID, allowlisted action, and status',()=>{
  const id='123e4567-e89b-42d3-a456-426614174000';
  assert.equal(sanitizeActionEvent({id,action:'run',status:'approved',requested_by:'trinity',updated_at:5}).id,id);
  assert.throws(()=>sanitizeActionEvent({id,action:'shell',status:'approved'}));
  assert.throws(()=>sanitizeActionEvent({id:'bad',action:'run',status:'approved'}));
});
