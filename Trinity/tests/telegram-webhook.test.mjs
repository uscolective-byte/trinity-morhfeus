import test from 'node:test';
import assert from 'node:assert/strict';
import {handleTelegramWebhook,processTelegramMessage,sendTelegramWebhookReply,TELEGRAM_WEBHOOK_PATH} from '../src/telegram-webhook.js';

const token = '123456789:' + 'a'.repeat(35);
const secret = 's'.repeat(40);
const env = () => ({
  TELEGRAM_BOT_TOKEN: token,
  TELEGRAM_WEBHOOK_SECRET: secret,
  TELEGRAM_CHAT_ID: '12345',
  DB: {prepare() {return {bind() {return this;},first: async () => ({count: 1})};}}
});
function request(update, header = secret) {
  return new Request('https://auru.space' + TELEGRAM_WEBHOOK_PATH, {
    method: 'POST',
    headers: {'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':header},
    body: JSON.stringify(update)
  });
}
const message = (chatId = 12345, text = '/ping') => ({
  update_id: 74,
  message: {message_id: 9, chat: {id: chatId,type:'private'},from: {is_bot: false},text}
});

test('webhook is closed until dedicated credentials and chat allowlist are present', async () => {
  await assert.rejects(handleTelegramWebhook(request(message()), {}, {}, async () => ''),
    error => error.status === 503);
});
test('webhook rejects a missing or wrong Telegram secret header', async () => {
  await assert.rejects(handleTelegramWebhook(request(message(), 'wrong'), env(), {}, async () => ''),
    error => error.status === 403);
});
test('webhook ignores messages from other accounts even with valid header', async () => {
  const result = await handleTelegramWebhook(request(message(22222)), env(), {}, async () => {throw new Error('must not call AI');});
  assert.equal(result.status, 200);
  assert.equal((await result.json()).ignored, true);
});
test('webhook accepts ping for the allowed private account and schedules its reply', async () => {
  const replies = [];
  const scheduled = [];
  const ctx = {waitUntil(promise) {scheduled.push(promise);}};
  const response = await handleTelegramWebhook(request(message()), env(), ctx,
    async () => {throw new Error('Ping should not run inference');},
    async (_env, chat, text, replyId) => {replies.push({chat,text,replyId});return {sent:true};});
  assert.equal(response.status, 200);
  await Promise.all(scheduled);
  assert.deepEqual(replies.map(x => [x.chat,x.replyId]), [['12345',9]]);
  assert.match(replies[0].text, /Pong/);
});
test('normal message reaches read-only chat inference with isolated Telegram identity', async () => {
  const calls = [];const replies = [];
  await processTelegramMessage(message(12345,'Ahoj').message,env(),
    async (prompt,options) => {calls.push({prompt,options});return {content:'Odpoveď Trinity'};},
    async (_env,chat,text) => {replies.push({chat,text});});
  assert.equal(calls[0].prompt,'Ahoj');
  assert.equal(calls[0].options.userId,'telegram:12345');
  assert.equal(calls[0].options.skill,undefined);
  assert.equal(calls[0].options.enableFallback,false);
  assert.deepEqual(replies,[{chat:'12345',text:'Odpoveď Trinity'}]);
});
test('outgoing Telegram acknowledgement is checked without exposing provider response', async t => {
  let outgoing;
  t.mock.method(globalThis,'fetch',async (url, init) => {
    outgoing = {url,init};
    return Response.json({ok:true,result:{message_id:99}});
  });
  const result = await sendTelegramWebhookReply(env(),'12345','Hello',9);
  assert.deepEqual(result,{sent:true});
  assert.match(outgoing.url,/sendMessage$/);
  assert.equal(JSON.parse(outgoing.init.body).reply_parameters.message_id,9);
  globalThis.fetch.mock.mockImplementation(async () => Response.json({ok:false,description:token},{status:403}));
  await assert.rejects(sendTelegramWebhookReply(env(),'12345','Hi'),error => error.status === 502 && !error.message.includes(token));
});
