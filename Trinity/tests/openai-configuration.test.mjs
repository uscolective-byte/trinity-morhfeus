import test from 'node:test';
import assert from 'node:assert/strict';
import {configureAIProvider} from '../src/ai-providers.js';
test('OpenAI rejects project control before reading a credential',async()=>{
 await assert.rejects(configureAIProvider({},'owner','openai',{secret_id:'12345678-1234-4123-8123-123456789012',model:'gpt-test',project_control:true}));
});
test('unsupported providers cannot access the vault',async()=>{
 await assert.rejects(configureAIProvider({},'owner','unknown',{}),e=>e.status===404);
});
