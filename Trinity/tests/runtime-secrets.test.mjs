import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveRuntimeSecrets,runtimeSecretStatus} from '../src/runtime-secrets.js';

test('provider aliases and Secrets Store resolve without changing the original environment',async()=>{
 const env={GOOGLE_GEMINI_API_KEY:'unit-private-key',OLLAMA_SECRET:{get:async()=>'unit-ollama-key'},OPENAI_API_KEY:'canonical-key',OPENAI_KEY:'unused-key'};
 const result=await resolveRuntimeSecrets(env);
 assert.equal(result.GEMINI_API_KEY,'unit-private-key');assert.equal(result.OLLAMA_API_KEY,'unit-ollama-key');assert.equal(result.OPENAI_API_KEY,'canonical-key');assert.equal(env.GEMINI_API_KEY,undefined);
 const status=JSON.stringify(runtimeSecretStatus(result));assert.ok(!status.includes('unit-private-key'));assert.ok(!status.includes('canonical-key'));assert.equal(runtimeSecretStatus(result).bindings.find(x=>x.name==='GEMINI_API_KEY').verified,false);
});
test('failed canonical binding does not silently select alternative credentials',async()=>{
 const result=await resolveRuntimeSecrets({OPENAI_API_KEY:{get:async()=>''},OPENAI_KEY:'another-account'});
 assert.equal(result.OPENAI_API_KEY,undefined);
 assert.equal(runtimeSecretStatus(result).bindings.find(x=>x.name==='OPENAI_API_KEY').status,'unavailable');
});
