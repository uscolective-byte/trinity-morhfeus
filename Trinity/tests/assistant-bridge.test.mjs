import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assistantNoteSchema,handleAssistantBridge} from '../src/assistant-bridge.js';

test('bridge note inputs require a revision and reject privilege injection',()=>{
  const valid={id:crypto.randomUUID(),text:'Spoločná poznámka Trinity',source:'copilot',base_revision:0};
  assert.equal(assistantNoteSchema.safeParse(valid).success,true);
  for(const invalid of [
    {...valid,base_revision:-1},
    {...valid,text:''},
    {...valid,text:'a'.repeat(8001)},
    {...valid,source:'root-admin'},
    {...valid,owner_id:'someone-else'},
    {...valid,command:'deploy'},
    {...valid,id:'not-uuid'}
  ])assert.equal(assistantNoteSchema.safeParse(invalid).success,false);
});

test('bridge denies every unsupported path before touching storage',async()=>{
  const env={};
  await assert.rejects(handleAssistantBridge(new Request('https://auru.dev/api/assistant-bridge/execute',{method:'POST'}),env),e=>e.status===404);
  await assert.rejects(handleAssistantBridge(new Request('https://auru.dev/api/assistant-bridge/notes',{method:'DELETE'}),env),e=>e.status===404);
});
