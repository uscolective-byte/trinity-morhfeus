import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TrinityCopilotAgent} from '../src/copilot-agent.js';
import {skills,skillRegistry,memorySessions} from '../src/skillRegistry.js';
import {copilotPluginRegistry} from '../src/copilot-plugins.js';
import {copilotChatOptionsSchema} from '../src/copilot-options.js';
import {integrationReadiness} from '../src/integration-readiness.js';
import {runTool} from '../src/tools.js';

const kv=()=>{const values=new Map();return {get:async key=>values.get(key)||null,put:async(key,value)=>values.set(key,value)};};

test('public chat rejects identity, executable skills and unbounded runtime options',()=>{
  for(const options of [{userId:'another-user'},{skill:'pcRunScript'},{mock:true},{retries:999},{rateLimit:999999},{maxTokens:4097}])assert.equal(copilotChatOptionsSchema.safeParse(options).success,false);
  assert.equal(copilotChatOptionsSchema.safeParse({aiProvider:'gemini',maxTokens:1024,noCache:true}).success,true);
});

test('generic agent skill execution requires server-authorized admin context',async()=>{
  let executions=0;
  skillRegistry.register('regressionAdminSkill',async()=>{executions++;return 'ok';});
  const env={DB:{prepare:()=>({bind(){return this;},first:async()=>({installed:1,enabled:1})})}};
  const agent={id:'test',tools:['execute_skill']};
  await assert.rejects(runTool(env,agent,'execute_skill',{skill:'regressionAdminSkill',params:{}}),/administrátora/);
  assert.equal(executions,0);
  const response=await runTool(env,agent,'execute_skill',{skill:'regressionAdminSkill',params:{}},{adminAuthorized:true});
  assert.equal(response.result,'ok');
  assert.equal(executions,1);
});

test('stateless cache separates users, provider options, prompt case and request IDs',async()=>{
  let calls=0;
  const env={CACHE:kv(),AI:{run:async()=>({response:`answer-${++calls}`})}};
  const a=await TrinityCopilotAgent('Which project?',env,{userId:'alice'});
  const again=await TrinityCopilotAgent('Which project?',env,{userId:'alice'});
  assert.equal(again.cached,true);
  assert.equal(again.content,a.content);
  assert.notEqual(again.request_id,a.request_id);
  assert.equal((await TrinityCopilotAgent('Which project?',env,{userId:'bob'})).cached,false);
  assert.equal((await TrinityCopilotAgent('which project?',env,{userId:'alice'})).cached,false);
  assert.equal((await TrinityCopilotAgent('Which project?',env,{userId:'alice',maxTokens:100})).cached,false);
  assert.equal(calls,4);
});

test('same session ID cannot share user history; anonymous calls ignore supplied history',async()=>{
  const messages=[];
  const env={AI:{run:async(_model,input)=>{messages.push(input.messages);return {response:'OK'};}}};
  const sessionId=crypto.randomUUID();
  try{
    await TrinityCopilotAgent('private-alice',env,{userId:'alice',sessionId});
    await TrinityCopilotAgent('hello-bob',env,{userId:'bob',sessionId});
    await TrinityCopilotAgent('hello-anonymous',env,{sessionId});
    assert.ok(!JSON.stringify(messages[1]).includes('private-alice'));
    assert.ok(!JSON.stringify(messages[2]).includes('private-alice'));
    await TrinityCopilotAgent('followup-alice',env,{userId:'alice',sessionId});
    assert.ok(JSON.stringify(messages[3]).includes('private-alice'));
  }finally{memorySessions.clear();}
});

test('side-effecting skills are neither cached nor retried',async()=>{
  let writes=0;
  const name='regressionSideEffect';
  skillRegistry.register(name,async()=>{writes++;if(writes===1)throw new Error('HTTP 503 after write');return 'done';});
  const env={CACHE:kv()};
  await assert.rejects(TrinityCopilotAgent('write',env,{userId:'alice',skill:name,enableFallback:false}),/after write/);
  assert.equal(writes,1);
  await TrinityCopilotAgent('write',env,{userId:'alice',skill:name});
  await TrinityCopilotAgent('write',env,{userId:'alice',skill:name});
  assert.equal(writes,3);
});

test('disabled diagnostic plugin cannot execute through Copilot and does not disclose secrets',async()=>{
  const secret='private-test-secret-do-not-return';
  const report=integrationReadiness({}, {GEMINI_API_KEY:secret});
  assert.ok(!JSON.stringify(report).includes(secret));
  assert.equal(report.live_verified,false);
  assert.equal(report.items.find(x=>x.id==='gemini').status,'configured_unverified');
  assert.equal(report.items.find(x=>x.id==='copilot-studio').status,'needs_configuration');
  assert.equal(typeof skills.integrationReadiness,'function');
  copilotPluginRegistry.disable('integration-diagnostics');
  try{
    await assert.rejects(TrinityCopilotAgent('inspect',{}, {skill:'integrationReadiness',enableFallback:false}),/vypnutý/);
    await assert.rejects(skillRegistry.execute('integrationReadiness',{},{}),/vypnutý/);
  }
  finally{copilotPluginRegistry.enable('integration-diagnostics');}
});

test('Ollama-only configuration runs the provider instead of an unconfigured placeholder',async()=>{
  const originalFetch=globalThis.fetch;
  let called=0;
  globalThis.fetch=async(url,init)=>{
    assert.equal(String(url),'https://ollama.com/api/chat');
    assert.equal(init.headers.Authorization,'Bearer test-key');
    called++;
    return Response.json({message:{content:'real-provider-path'},model:'test-model'});
  };
  try{
    const response=await TrinityCopilotAgent('hello',{OLLAMA_API_KEY:'test-key',OLLAMA_MODEL:'test-model'},{noCache:true});
    assert.equal(response.content,'real-provider-path');
    assert.equal(response.provider,'trinity-ai');
    assert.equal(called,1);
  }finally{globalThis.fetch=originalFetch;}
});
