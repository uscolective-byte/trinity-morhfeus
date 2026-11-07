import test from 'node:test';
import assert from 'node:assert/strict';
import {getDevHubStatus,executeDevHubCommand} from '../src/developer-hub.js';

test('Developer Hub configuration never proves OAuth, API availability or a connected PC',async()=>{
  const result=await getDevHubStatus({
    GOOGLE_PROJECT_ID:'existing-project',GOOGLE_ENABLED:'true',
    GOOGLE_CLIENT_ID:'declared-client',GOOGLE_SERVICES_ENABLED:'drive.googleapis.com',
    PC_BRIDGE_SERVICE:{},CF_ACCOUNT_ID:'configured-account'
  });
  for(const item of Object.values(result.environments)){
    assert.equal(item.active,false);
    assert.equal(item.verified,false);
  }
  assert.deepEqual(result.environments.google.configured_apis,['drive.googleapis.com']);
  assert.deepEqual(result.environments.google.enabled_apis,[]);
  assert.equal(result.environments.google.oauth_verified,false);
  assert.equal(result.environments.terminal_runtime.pc_bridge_configured,true);
  assert.equal(result.environments.terminal_runtime.pc_bridge_connected,false);
});
test('every DevHub command rejects absent executor without fake documents or secret echo',async()=>{
  const env={DB:{prepare(){throw Error('No fictional execution may be persisted');}}};
  for(const target of ['cloudflare_wrangler','google_cloud','microsoft_copilot','github_cli','pc_terminal']){
    const result=await executeDevHubCommand(env,'owner',{target,command:'SECRET command'});
    assert.equal(result.ok,false);
    assert.equal(result.executed,false);
    assert.equal(result.status,'not_configured');
    assert.doesNotMatch(JSON.stringify(result),/SECRET|OAuth overená|vykonaný/);
  }
});
