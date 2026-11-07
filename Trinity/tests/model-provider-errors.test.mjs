import test from 'node:test';
import assert from 'node:assert/strict';
import {callModel} from '../src/services.js';

const fakeSecret='synthetic-private-value-for-error-test';
const env={DB:{prepare(){return {bind(){return this;},first:async()=>null};}},GEMINI_MODEL:'gemini-test-only',GEMINI_API_KEY:'AIza'+'a'.repeat(32),
 GROQ_API_KEY:fakeSecret,DEEPSEEK_API_KEY:fakeSecret,ANTHROPIC_API_KEY:fakeSecret,MISTRAL_API_KEY:fakeSecret,OPENROUTER_API_KEY:fakeSecret,OPENAI_API_KEY:'sk-'+'a'.repeat(32)};
const providers=['gemini','openai','groq','deepseek','anthropic','mistral','openrouter'];

test('provider HTTP errors retain status but never echo upstream private content',async t=>{
 for(const provider of providers)await t.test(provider,async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({error:{message:`Rejected ${fakeSecret}; Authorization: Bearer fake-token; prompt=private-text`}},{status:401}));
  await assert.rejects(callModel(env,provider,[{role:'user',content:'Test'}]),error=>{
   assert.match(error.message,/HTTP 401/);
   assert.doesNotMatch(error.message,/synthetic-private|fake-token|private-text|Authorization/);
   return true;
  });
 });
});

test('invalid success JSON cannot leak raw body snippets through parser exceptions',async t=>{
 for(const provider of providers)await t.test(provider,async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(`not-json ${fakeSecret}`,{status:200}));
  await assert.rejects(callModel(env,provider,[{role:'user',content:'Test'}]),error=>{
   assert.doesNotMatch(error.message,/synthetic-private|not-json/);
   assert.match(error.message,/neplatnú odpoveď/);
   return true;
  });
 });
});
