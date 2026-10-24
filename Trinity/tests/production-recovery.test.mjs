import test from 'node:test';
import assert from 'node:assert/strict';
import {callModel,usableModelText} from '../src/services.js';
import {runAgent} from '../src/engine.js';
import {telegramConfigSchema,sendTelegramAlert} from '../src/domain-desk-advanced.js';

const token = '123456789:' + 'a'.repeat(35);
const stored = config => ({prepare:()=>({bind(){return this;},first:async()=>({value:JSON.stringify(config)})})});

test('broken model output retries once and returns the actual model with a receipt', async()=>{
  const calls=[];
  const env={AI:{run:async model=>{calls.push(model);return {response:calls.length===1?'!'.repeat(1200):'42'};}}};
  const result=await runAgent(env,'writer','Napíš krátku odpoveď.');
  assert.equal(result.text,'42');
  assert.equal(result.model,'@cf/meta/llama-3.3-70b-instruct-fp8-fast');
  assert.equal(calls.length,2);
  assert.equal(result.tool_log[0].tool,'model_fallback');
  assert.equal(result.tool_log[0].reason,'invalid-output');
});

test('invalid fallback fails without an unbounded retry loop',async()=>{
  let calls=0;
  await assert.rejects(callModel({AI:{run:async()=>{calls++;return {response:'!'.repeat(120)};}}},'workers-ai',[]),/záložný model/);
  assert.equal(calls,2);
  assert.equal(usableModelText('42'),true);
  assert.equal(usableModelText('## Výsledok\n42'),true);
  assert.equal(usableModelText(' '),false);
});

test('Telegram rejects a Cloudflare variable name as a chat destination',()=>{
  assert.equal(telegramConfigSchema.safeParse({bot_token:token,chat_id:'CF_API_TOKEN'}).success,false);
  assert.equal(telegramConfigSchema.safeParse({bot_token:token,chat_id:'-1001234567890'}).success,true);
});

test('disabled stored Telegram config never falls through to environment credentials',async()=>{
  const result=await sendTelegramAlert({DB:stored({enabled:false}),TELEGRAM_BOT_TOKEN:token,TELEGRAM_CHAT_ID:'12345'},'Test');
  assert.equal(result.sent,false);
  assert.match(result.reason,/vypnuté/);
});

test('Telegram success requires provider acknowledgement and does not expose token or chat',async t=>{
  const env={TELEGRAM_BOT_TOKEN:token,TELEGRAM_CHAT_ID:'12345'};
  let request;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    request={url,options};
    return Response.json({ok:true,result:{message_id:7,chat:{id:12345}}});
  });
  assert.deepEqual(await sendTelegramAlert(env,'Test'),{sent:true,message_id:7});
  assert.equal(JSON.parse(request.options.body).chat_id,'12345');
  assert.ok(request.options.signal);
  globalThis.fetch.mock.mockImplementation(async()=>Response.json({ok:false,description:token},{status:403}));
  const failed=await sendTelegramAlert(env,'Test');
  assert.equal(failed.sent,false);
  assert.equal(JSON.stringify(failed).includes(token),false);
});
