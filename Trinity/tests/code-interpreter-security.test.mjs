import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chatGptSkills} from '../src/skillRegistry.js';

test('code interpreter cannot execute model code in the host global scope',()=>{
  const key='__trinityInterpreterSecurityProbe';
  delete globalThis[key];
  try {
    for(const code of [`globalThis.${key} = true`, `({}).constructor.constructor('return globalThis')().${key} = true`, 'while (true) {}', 'process.env']){
      const result=chatGptSkills.chatGptCodeInterpreter({code,language:'javascript'});
      assert.equal(result.success,false);
      assert.equal(result.code,'SANDBOX_UNAVAILABLE');
      assert.equal(globalThis[key],undefined);
      assert.equal(Object.hasOwn(result,'output'),false);
    }
  } finally { delete globalThis[key]; }
});

test('code interpreter still parses JSON data and reports malformed input',()=>{
  const parsed=chatGptSkills.chatGptCodeInterpreter({code:'{"value":437}',language:'json'});
  assert.equal(parsed.success,true);
  assert.deepEqual(parsed.output,{value:437});
  assert.equal(chatGptSkills.chatGptCodeInterpreter({code:'invalid',language:'json'}).success,false);
});
