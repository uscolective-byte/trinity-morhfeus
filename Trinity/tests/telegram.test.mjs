import test from 'node:test';
import assert from 'node:assert/strict';
import {telegramStatus,authorizedTelegramMessage,configureTelegramWebhook,handleTelegramWebhook,telegramAPI} from '../src/telegram.js';
const config=()=>({TRINITY_ENV:'development',TELEGRAM_OWNER_USER_ID:'12345',TELEGRAM_BOT_TOKEN:'123:test-token',TELEGRAM_WEBHOOK_SECRET:'x'.repeat(32),TELEGRAM_WORKFLOW:{}});
const update=()=>({update_id:10,message:{text:'Ahoj Trinity',from:{id:12345,is_bot:false},chat:{id:12345,type:'private'}}});
test('requires exact numeric private identity and admin is disabled by default',()=>{
 const env=config();assert.ok(telegramStatus(env).configured);assert.equal(telegramStatus(env).admin_enabled,false);
 assert.ok(authorizedTelegramMessage(env,update()));
 for(const m of [{...update().message,from:{id:777}},{...update().message,chat:{id:12345,type:'group'}},{...update().message,text:'x'.repeat(6001)}])assert.equal(authorizedTelegramMessage(env,{update_id:10,message:m}),null);
 assert.equal(authorizedTelegramMessage({...env,TELEGRAM_OWNER_USER_ID:'@isabo'},update()),null);
});
test('wrong webhook secret cannot queue work',async()=>{
 const env=config();env.TELEGRAM_WORKFLOW.create=()=>assert.fail('must not queue');
 await assert.rejects(handleTelegramWebhook(new Request('https://auru.dev/api/integrations/telegram/webhook',{method:'POST',body:JSON.stringify(update())}),env),e=>e.status===403);
});
test('queues in durable workflow and duplicates reuse the same instance',async()=>{
 const env=config();let calls=0;env.TELEGRAM_WORKFLOW={async create(value){assert.equal(value.id,'telegram-10');assert.equal(value.params.text,'Ahoj Trinity');if(calls++)throw Error('exists');},async get(id){assert.equal(id,'telegram-10');return {status:async()=>({status:'running'})};}};
 const request=()=>new Request('https://auru.dev/api/integrations/telegram/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':env.TELEGRAM_WEBHOOK_SECRET},body:JSON.stringify(update())});
 const dependencies={limit:async()=>{},control:async()=>({emergency_stop:false})};
 for(let i=0;i<2;i++)assert.equal((await handleTelegramWebhook(request(),env,dependencies)).status,200);
 assert.equal(calls,2);
});
test('webhook registration checks origin and verifies provider receipt',async()=>{
 const env=config(),calls=[];const api=async(_env,method,payload)=>{calls.push({method,payload});return method==='getMe'?{username:'test_bot'}:method==='getWebhookInfo'?{url:'https://auru.dev/api/integrations/telegram/webhook'}:true;};
 await assert.rejects(configureTelegramWebhook(env,'https://example.com',api),e=>e.status===400);assert.equal(calls.length,0);
 const result=await configureTelegramWebhook(env,'https://auru.dev',api);assert.equal(result.end_to_end_verified,false);
 assert.equal(calls[1].payload.secret_token,env.TELEGRAM_WEBHOOK_SECRET);assert.deepEqual(calls[1].payload.allowed_updates,['message']);
});
test('network errors do not disclose bot token',async()=>{
 const env=config();await assert.rejects(telegramAPI(env,'getMe',{},async()=>{throw Error('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN);}),e=>e.status===502&&!e.message.includes(env.TELEGRAM_BOT_TOKEN));
});
