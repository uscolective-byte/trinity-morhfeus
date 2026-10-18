import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectAction,readCopilotProjectAction,proposeCopilotProjectAction} from '../src/copilot-project.js';
test('Copilot edits are bounded source proposals, not arbitrary shell actions',()=>{
  assert.equal(projectAction({operation:'edit',path:'Trinity/src/example.js',content:'export const x=1;',rationale:'Improve project example'}).action,'selfwrite');
  for(const path of ['.env','Trinity/src/../../.env','C:/Windows/file.js','Local-Gateway/src/server.mjs'])assert.throws(()=>projectAction({operation:'edit',path,content:'x',rationale:'Change the source file'}));
  assert.throws(()=>projectAction({operation:'deploy',rationale:'Deploy the application'}));
  assert.throws(()=>projectAction({operation:'test',command:'rm -rf /',rationale:'Run project test suite'}));
  assert.deepEqual(projectAction({operation:'test',rationale:'Run project test suite'}).payload,{command:'npm test',cwd:'Trinity',allowNonZero:false});
});
test('project operations fail closed and hide other clients actions',async()=>{
  await assert.rejects(()=>proposeCopilotProjectAction({}, {id:'a'},{}),/disabled/);
  const env={COPILOT_PROJECT_CONTROL:'development',DB:{prepare(){return {bind(){return {first:async()=>({id:'x',requested_by:'copilot:other',payload_json:'{}'})};}};}}};
  await assert.rejects(()=>readCopilotProjectAction(env,{id:'a'},'x'),/not found/);
});
