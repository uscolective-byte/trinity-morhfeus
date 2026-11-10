import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleTelegramWebhook,
  telegramIntegrationStatus,
  activateTelegramWebhook,
  parseCommand,
  executeStatus,
  executePC,
  executeCrypto,
  executeFleet,
  executeResearch,
  getAllowedUserIds,
  getChatHistory,
  saveChatHistory,
  clearChatHistory,
  buildSystemGroundingContext,
  callResilientBrain
} from '../src/telegram-bridge.js';

function setup() {
  const sent = [];
  const seen = new Set();
  const requests = [];
  const memoryStore = new Map();
  let activeWebhook='';
  const env = {
    TELEGRAM_BOT_TOKEN:'test-telegram-token',
    TELEGRAM_WEBHOOK_SECRET:'a_long_test_secret_12345',
    TELEGRAM_ALLOWED_USER_IDS:'12345',
    TELEGRAM_AI_PROVIDER:'openai',
    OPENAI_API_KEY:'test-openai-api-key',
    OPENAI_MODEL:'gpt-4o',
    DB:{
      prepare(sql) {
        return {
          bind(...args) { this.args=args; return this; },
          async first() {
            if (sql.includes('ops_limits')) return {count:1};
            const key=this.args[0];
            if (sql.includes('SELECT value FROM ops_memory')) {
              return memoryStore.has(key) ? {value: memoryStore.get(key)} : null;
            }
            if (seen.has(key)) return null;
            seen.add(key);
            return {key};
          },
          async all() {
            return {results: []};
          },
          async run() {
            if (sql.includes('INSERT INTO ops_memory')) {
              memoryStore.set(this.args[0], this.args[1]);
            } else if (sql.includes('DELETE FROM ops_memory')) {
              memoryStore.delete(this.args[0]);
            }
            return {success: true};
          }
        };
      }
    }
  };
  const message = (text='/help', id=12345, chatType='private') =>
    ({update_id:100, message:{text,from:{id},chat:{id,type:chatType}}});
  const createRequest = (body, token=env.TELEGRAM_WEBHOOK_SECRET) =>
    new Request('https://auru.dev/api/telegram/webhook',{method:'POST',
      headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':token},
      body:JSON.stringify(body)});
  const context = () => {
    const pending=[];
    return {ctx:{waitUntil:p=>pending.push(p)},done:async()=>Promise.all(pending)};
  };
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async (url, options)=>{
    requests.push({url:String(url),body:options?.body});
    if (String(url).includes('api.telegram.org')) {
      const body=JSON.parse(options.body);
      if (String(url).endsWith('/getWebhookInfo')) return Response.json({ok:true,result:{url:activeWebhook}});
      if (String(url).endsWith('/setWebhook')) { activeWebhook=body.url; return Response.json({ok:true,result:true}); }
      sent.push(body);
      return Response.json({ok:true,result:{message_id:1}});
    }
    if (String(url).includes('api.openai.com')) {
      return Response.json({model:'gpt-4o',choices:[{message:{content:'Odpoveď z OpenAI'}}],usage:{}});
    }
    throw new Error('Unexpected external request');
  };
  return {env,sent,requests,message,createRequest,context,setExistingWebhook:url=>{activeWebhook=url;},restore:()=>{globalThis.fetch=oldFetch;}};
}

test('Telegram bridge fails closed when webhook is unconfigured',async()=>{
  const t=setup();
  try {
    const res=await handleTelegramWebhook(t.createRequest(t.message()),{...t.env,TELEGRAM_WEBHOOK_SECRET:''});
    assert.equal(res.status,503);
  } finally {t.restore();}
});

test('Telegram invalid signature is rejected before database access',async()=>{
  const t=setup();
  try {
    const res=await handleTelegramWebhook(t.createRequest(t.message(),'wrong-secret'),t.env);
    assert.equal(res.status,401);
    assert.equal(t.sent.length,0);
  } finally {t.restore();}
});

test('Telegram only processes allowlisted private accounts',async()=>{
  const t=setup();
  try {
    const {ctx,done}=t.context();
    assert.equal((await handleTelegramWebhook(t.createRequest(t.message('/help',56789)),t.env,ctx)).status,200);
    assert.equal((await handleTelegramWebhook(t.createRequest(t.message('/help',12345,'group')),t.env,ctx)).status,200);
    await done();
    assert.equal(t.sent.length,0);
  } finally {t.restore();}
});

test('Telegram answers private /help and rejects duplicate updates',async()=>{
  const t=setup();
  try {
    const first=t.context();
    const res=await handleTelegramWebhook(t.createRequest(t.message()),t.env,first.ctx);
    assert.equal(res.status,200);
    await first.done();
    assert.equal(t.sent.length,1);
    assert.match(t.sent[0].text,/Trinity Telegram AI/);
    const second=t.context();
    const again=await handleTelegramWebhook(t.createRequest(t.message()),t.env,second.ctx);
    assert.equal((await again.json()).duplicate,true);
    await second.done();
    assert.equal(t.sent.length,1);
  } finally {t.restore();}
});

test('Telegram uses own OpenAI API credentials and responds without exposing token',async()=>{
  const t=setup();
  try {
    const update=t.message('/openai Vysvetli čo je Trinity');
    const work=t.context();
    const res=await handleTelegramWebhook(t.createRequest(update),t.env,work.ctx);
    assert.equal(res.status,200);
    await work.done();
    assert.equal(t.sent.length,1);
    assert.equal(t.sent[0].text,'Odpoveď z OpenAI');
    assert.equal(t.requests.filter(x=>x.url.includes('api.openai.com')).length,1);
    assert.equal(JSON.parse(t.requests.find(x=>x.url.includes('api.openai.com')).body).model,'gpt-4.1-mini');
    assert.ok(!t.sent[0].text.includes(t.env.TELEGRAM_BOT_TOKEN));
  } finally {t.restore();}
});

test('Telegram status describes settings without revealing secrets',()=>{
  const t=setup();
  try {
    const status=telegramIntegrationStatus(t.env);
    assert.equal(status.allowed_users,true);
    assert.equal(status.provider,'openai');
    assert.equal(JSON.stringify(status).includes(t.env.TELEGRAM_BOT_TOKEN),false);
  } finally {t.restore();}
});

test('Telegram reads an existing custom Cloudflare secret binding without copying the value',async()=>{
  const t=setup();
  try {
    delete t.env.TELEGRAM_BOT_TOKEN;
    t.env.TELEGRAM_BOT_TOKEN='test-alias-secret-value';
    const status=telegramIntegrationStatus(t.env);
    assert.equal(status.bot_token,true);
    assert.equal(JSON.stringify(status).includes(t.env.TELEGRAM_BOT_TOKEN),false);
    const work=t.context();
    const response=await handleTelegramWebhook(t.createRequest(t.message('/help')),t.env,work.ctx);
    assert.equal(response.status,200);
    await work.done();
    assert.equal(t.sent.length,1);
    assert.ok(t.requests.some(item=>item.url.endsWith('/bottest-alias-secret-value/sendMessage')));
  } finally {t.restore();}
});

test('Telegram setup endpoint is closed without a temporary secret',async()=>{
  const t=setup();
  try {
    const req=new Request('https://auru.space/api/telegram/setup',{method:'POST'});
    const r=await activateTelegramWebhook(req,{...t.env,TRINITY_ENV:'production'});
    assert.equal(r.status,401);
    assert.equal(t.requests.length,0);
  } finally {t.restore();}
});

test('Telegram setup refuses to overwrite a foreign existing webhook',async()=>{
  const t=setup();
  try {
    t.setExistingWebhook('https://another-service.example.org/telegram');
    const setupKey='a-test-bootstrap-key-with-more-than-32-chars';
    const req=new Request('https://auru.space/api/telegram/setup',{method:'POST',headers:{'X-Trinity-Telegram-Setup':setupKey}});
    const r=await activateTelegramWebhook(req,{...t.env,TRINITY_ENV:'production',TRINITY_TELEGRAM_SETUP_KEY:setupKey,TELEGRAM_WEBHOOK_SECRET:'webhook_secret_Aaaa1234567890123456789012'});
    assert.equal(r.status,409);
    assert.equal(t.requests.filter(item=>item.url.endsWith('/setWebhook')).length,0);
  } finally {t.restore();}
});

test('Telegram setup registers and verifies webhook only with the temporary secret',async()=>{
  const t=setup();
  try {
    const setupKey='a-test-bootstrap-key-with-more-than-32-chars';
    const req=new Request('https://auru.space/api/telegram/setup',{method:'POST',headers:{'X-Trinity-Telegram-Setup':setupKey}});
    const secret='webhook_secret_Aaaa1234567890123456789012';
    const r=await activateTelegramWebhook(req,{...t.env,TRINITY_ENV:'production',TRINITY_TELEGRAM_SETUP_KEY:setupKey,TELEGRAM_WEBHOOK_SECRET:secret});
    assert.equal(r.status,200);
    const activated=await r.json();
    assert.equal(activated.registered,true);
    assert.equal(activated.delivery_test,true);
    assert.equal(t.sent.length,1);
    assert.equal(t.sent[0].chat_id,'12345');
    assert.equal(t.requests.filter(item=>item.url.endsWith('/setWebhook')).length,1);
    const options=JSON.parse(t.requests.find(item=>item.url.endsWith('/setWebhook')).body);
    assert.equal(options.url,'https://auru.space/api/telegram/webhook');
    assert.equal(options.secret_token,secret);
    assert.deepEqual(options.allowed_updates,['message']);
  } finally {t.restore();}
});

test('Telegram handles /status, /pc, /crypto, /fleet and /clear commands', async () => {
  const t = setup();
  try {
    // 1. /fleet
    const fleetUpdate = t.message('/fleet', 12345);
    fleetUpdate.update_id = 201;
    const ctxFleet = t.context();
    await handleTelegramWebhook(t.createRequest(fleetUpdate), t.env, ctxFleet.ctx);
    await ctxFleet.done();
    assert.match(t.sent[t.sent.length - 1].text, /KATALÓG CLOUDFLARE SERVICE BINDINGS/);
    assert.match(t.sent[t.sent.length - 1].text, /živý stav|Aktuálny stav|dostupnosť/i);

    // 2. /pc
    const pcUpdate = t.message('/pc', 12345);
    pcUpdate.update_id = 202;
    const ctxPC = t.context();
    await handleTelegramWebhook(t.createRequest(pcUpdate), t.env, ctxPC.ctx);
    await ctxPC.done();
    assert.match(t.sent[t.sent.length - 1].text, /LOKÁLNE PC/);

    // 3. /crypto
    const cryptoUpdate = t.message('/crypto', 12345);
    cryptoUpdate.update_id = 203;
    const ctxCrypto = t.context();
    await handleTelegramWebhook(t.createRequest(cryptoUpdate), {
      ...t.env,
      JERICHO_SERVICE: {
        async getPrices() {
          return {btc: {price_usd: 68500, change_24h_pct: 2.5, live: true}};
        },
        async getTetrakisInfo() {
          return {treasury_address: '0x1234567890abcdef1234567890abcdef12345678'};
        }
      }
    }, ctxCrypto.ctx);
    await ctxCrypto.done();
    assert.match(t.sent[t.sent.length - 1].text, /BTC: \$68,500/);
    assert.match(t.sent[t.sent.length - 1].text, /Tetrakis \(\$TTK\) Token/);
    assert.doesNotMatch(t.sent[t.sent.length - 1].text, /0x1234567890abcdef1234567890abcdef12345678/);

    // 4. /status
    const statusUpdate = t.message('/status', 12345);
    statusUpdate.update_id = 204;
    const ctxStatus = t.context();
    await handleTelegramWebhook(t.createRequest(statusUpdate), t.env, ctxStatus.ctx);
    await ctxStatus.done();
    assert.match(t.sent[t.sent.length - 1].text, /Trinity Telegram: nakonfigurované/);
    assert.match(t.sent[t.sent.length - 1].text, /TRINITY 11\.[0-9] SOVEREIGN ECOSYSTEM/);

    // 5. /clear
    const clearUpdate = t.message('/clear', 12345);
    clearUpdate.update_id = 205;
    const ctxClear = t.context();
    await handleTelegramWebhook(t.createRequest(clearUpdate), t.env, ctxClear.ctx);
    await ctxClear.done();
    assert.match(t.sent[t.sent.length - 1].text, /Konverzačná pamäť bola vyčistená/);
  } finally {
    t.restore();
  }
});

test('Telegram handles /research command via researcher service or fallback', async () => {
  const t = setup();
  try {
    const researchUpdate = t.message('/research kvantové šifrovanie', 12345);
    researchUpdate.update_id = 206;
    const ctxResearch = t.context();
    await handleTelegramWebhook(t.createRequest(researchUpdate), {
      ...t.env,
      RESEARCHER_SERVICE: {
        async fetch(url, options) {
          const body = JSON.parse(options.body);
          return Response.json({summary: `Syntetizovaný výskum pre ${body.query}.`});
        }
      }
    }, ctxResearch.ctx);
    await ctxResearch.done();
    assert.match(t.sent[t.sent.length - 1].text, /Výsledok Výskumu: kvantové šifrovanie/);
    assert.match(t.sent[t.sent.length - 1].text, /Syntetizovaný výskum/);
  } finally {
    t.restore();
  }
});

test('getAllowedUserIds combines env allowed IDs with D1 ops_memory chat IDs', async () => {
  const mockEnv = {
    TELEGRAM_ALLOWED_USER_IDS: '111,222',
    DB: {
      prepare(sql) {
        return {
          async all() {
            return {
              results: [
                {value: JSON.stringify({chat_id: '333', enabled: true})},
                {value: JSON.stringify({chat_id: '444', enabled: true})}
              ]
            };
          }
        };
      }
    }
  };
  const ids = await getAllowedUserIds(mockEnv);
  assert.equal(ids.has('111'), true);
  assert.equal(ids.has('222'), true);
  assert.equal(ids.has('333'), true);
  assert.equal(ids.has('444'), true);
  assert.equal(ids.has('555'), false);
});

test('Chat history management stores, retrieves and clears history in D1 ops_memory', async () => {
  const t = setup();
  try {
    const history = await getChatHistory(t.env, 12345);
    assert.deepEqual(history, []);

    const newHistory = [
      {role: 'user', content: 'Ahoj Trinity'},
      {role: 'assistant', content: 'Ahoj Sabo'}
    ];
    await saveChatHistory(t.env, 12345, newHistory);

    const loaded = await getChatHistory(t.env, 12345);
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0].content, 'Ahoj Trinity');
    assert.equal(loaded[1].content, 'Ahoj Sabo');

    await clearChatHistory(t.env, 12345);
    const afterClear = await getChatHistory(t.env, 12345);
    assert.deepEqual(afterClear, []);
  } finally {
    t.restore();
  }
});

test('buildSystemGroundingContext dynamically injects system, PC and crypto context', async () => {
  const mockEnv = {
    JERICHO_SERVICE: {
      async getPrices() {
        return {btc: {price_usd: 69000, live: true}};
      }
    }
  };
  const generalContext = await buildSystemGroundingContext(mockEnv, 'Ahoj');
  assert.match(generalContext, /Sabo Ivan \(Basterix\)/);
  assert.match(generalContext, /35 prepojených Cloudflare Workerov/);

  const pcContext = await buildSystemGroundingContext(mockEnv, 'Ako je na tom moje PC?');
  assert.match(pcContext, /Lokálne PC/);

  const cryptoContext = await buildSystemGroundingContext(mockEnv, 'Koľko stojí BTC a čo Tetrakis?');
  assert.match(cryptoContext, /ceny z Jericho/);
  assert.match(cryptoContext, /Tetrakis \(\$TTK\)/);
  assert.match(cryptoContext, /Nasadenie, sieť a treasury adresa nie sú.*overené/);
});

test('Telegram configuration cannot claim an active webhook from env variables alone',()=>{
  const status=telegramIntegrationStatus({TELEGRAM_BOT_TOKEN:'synthetic',TELEGRAM_WEBHOOK_SECRET:'synthetic',TELEGRAM_ALLOWED_USER_IDS:'123'});
  assert.equal(status.bot_token,true);
  assert.equal(status.live_verified,false);
  assert.match(status.verification_note,/getWebhookInfo/);
});

test('Telegram crypto without Jericho receipts never claims live prices or treasury address',async()=>{
  const output=await executeCrypto({});
  assert.match(output,/nepodarilo sa načítať overené ceny/);
  assert.match(output,/neoverená/);
  assert.doesNotMatch(output,/prepojenie aktívne|BIP-39 \/ EVM peňaženka pripravená/);
});

test('Telegram crypto ignores reference prices and never prints an unverified treasury address',async()=>{
  const privateLookingTreasury = '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e';
  const output=await executeCrypto({
    JERICHO_SERVICE: {
      async getPrices() { return {BTC: {price_usd: 67500, live: false, source: 'unverified-reference'}}; },
      async getTetrakisInfo() { return {treasury_address: privateLookingTreasury}; }
    }
  });
  assert.match(output,/nepodarilo sa načítať overené ceny/);
  assert.doesNotMatch(output,new RegExp(privateLookingTreasury));
  assert.match(output,/Treasury adresa: neoverená/);
  assert.match(output,/nasadenie smart kontraktu nebolo.*overené/);
});
