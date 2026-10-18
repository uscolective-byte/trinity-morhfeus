import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleRequest,tasksEnabled} from '../src/index.mjs';

test('staging targets only development and disables task execution',()=>{
  const config=JSON.parse(readFileSync(new URL('../wrangler.staging.jsonc',import.meta.url),'utf8'));
  assert.equal(config.name,'trinity-copilot-bridge-development');
  assert.deepEqual(config.services,[{binding:'TRINITY',service:'trinity-development'}]);
  assert.equal(config.routes,undefined);
  assert.equal(tasksEnabled({...config.vars,ENTRA_ALLOWED_USER_OIDS:'11111111-2222-4333-8444-555555555555',COPILOT_TRINITY_TASK_KEY:'trn_live_test'}),false);
});
test('unconfigured staging denies API calls without invoking an upstream',async()=>{
  let called=false;
  const response=await handleRequest(new Request('https://bridge.test/v1/trinity/status'),{ENTRA_ENABLE_TASKS:'false',TRINITY:{fetch(){called=true;}}});
  assert.ok([401,503].includes(response.status));
  assert.equal(called,false);
});
