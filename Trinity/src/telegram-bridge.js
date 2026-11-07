/**
 * @module TRINITY_OMNI_CORE
 * @subsystem EXTERNAL_CONNECTORS
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul telegram-bridge.js (Trinity/src/telegram-bridge.js) v ekosystéme TRINITY OMNI-CORE.
 */
import {callModel} from './services.js';
import {equal,rateLimit,readJSON} from './security.js';
import {getPCBridgeStatus} from './system-actions.js';

// Telegram is an independent, text-only entrypoint. It never authenticates as a Trinity admin.
const reply = (data, status = 200) => Response.json(data, {status});
const allowedIds = value => new Set(String(value || '').split(',').map(x => x.trim()).filter(x => /^[0-9]+$/.test(x)));
const WEBHOOK_HEADER = 'X-Telegram-Bot-Api-Secret-Token';

// Alias is the Cloudflare binding NAME only. Its secret VALUE remains in the Worker.
export function telegramToken(env) {
  return env.TELEGRAM_BOT_TOKEN || '';
}

export function telegramIntegrationStatus(env) {
  return {
    bot_token: Boolean(telegramToken(env)),
    webhook_secret: Boolean(env.TELEGRAM_WEBHOOK_SECRET),
    allowed_users: allowedIds(env.TELEGRAM_ALLOWED_USER_IDS).size > 0,
    provider: env.TELEGRAM_AI_PROVIDER === 'openai' ? 'openai' : 'gemini',
    capabilities: [
      'private-text-chat', 'gemini', 'openai', 'groq',
      'help', 'status', 'pc', 'crypto', 'fleet', 'research',
      'multi-turn-memory', 'system-grounding', 'clear'
    ],
    live_verified: false,
    verification_note: 'Konfigurácia nie je dôkazom aktívneho webhooku. Over cez Telegram getWebhookInfo.'
  };
}

export async function getAllowedUserIds(env) {
  const ids = allowedIds(env.TELEGRAM_ALLOWED_USER_IDS);
  if (env.DB) {
    try {
      const rows = await env.DB.prepare(
        "SELECT value FROM ops_memory WHERE key IN ('assistant:telegram:config', 'domain_monitoring:telegram')"
      ).all();
      for (const row of rows?.results || []) {
        try {
          const cfg = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          const cid = String(cfg?.chat_id || '').trim();
          if (/^[0-9]+$/.test(cid)) ids.add(cid);
        } catch {}
      }
    } catch {}
  }
  return ids;
}

export async function getChatHistory(env, chatId) {
  if (!env.DB) return [];
  try {
    const key = `telegram:history:${chatId}`;
    const row = await env.DB.prepare('SELECT value FROM ops_memory WHERE key = ?').bind(key).first();
    if (!row?.value) return [];
    const list = JSON.parse(row.value);
    return Array.isArray(list) ? list.slice(-8) : [];
  } catch {
    return [];
  }
}

export async function saveChatHistory(env, chatId, history) {
  if (!env.DB) return;
  try {
    const key = `telegram:history:${chatId}`;
    const truncated = history.slice(-8);
    await env.DB.prepare(
      "INSERT INTO ops_memory(key, value, source, updated_at) VALUES(?, ?, 'telegram-chat', datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')"
    ).bind(key, JSON.stringify(truncated)).run();
  } catch {}
}

export async function clearChatHistory(env, chatId) {
  if (!env.DB) return;
  try {
    const key = `telegram:history:${chatId}`;
    await env.DB.prepare('DELETE FROM ops_memory WHERE key = ?').bind(key).run();
  } catch {}
}

export async function buildSystemGroundingContext(env, userQuestion = '') {
  let context = '\n[AKTUÁLNY STAV A VEDOMOSTI TRINITY 11.1]:\n';
  context += '• Majiteľ a suverénny architekt: Sabo Ivan (Basterix).\n';
  context += '• Cloudflare Edge domény: https://auru.space (produkcia) a https://auru.dev (vývoj).\n';
  context += '• Flotila workerov: 35 prepojených Cloudflare Workerov (10× AURA špecialisti, 8× Core, 8× RPC, 6× Rozšírené).\n';
  context += '• Databázy: D1 trinity-v03, KV Mastermind, R2 trinity-artifacts.\n';

  const q = String(userQuestion || '').toLowerCase();
  if (/pc|počítač|pocitac|bridge|gateway|lokál|lokal|windows|terminál|terminal/.test(q)) {
    try {
      const pc = await getPCBridgeStatus(env).catch(() => ({connected: false, status: 'offline'}));
      context += `• Lokálne PC (saboi-PC / Windows): ${pc.connected ? 'Online a pripojené (Local Gateway 8791, MCP Bridge 3333, ~/trinity_local)' : 'Momentálne offline / uspaté'}.\n`;
    } catch {}
  }
  if (/krypto|crypto|btc|eth|sol|bitcoin|tetrakis|ttk|token|pokladnic|treasury|cen[ay]/.test(q)) {
    try {
      if (env.JERICHO_SERVICE) {
        let prices = null;
        if (typeof env.JERICHO_SERVICE.getPrices === 'function') prices = await env.JERICHO_SERVICE.getPrices();
        else if (env.JERICHO_SERVICE.fetch) {
          const res = await env.JERICHO_SERVICE.fetch('https://trinity.internal/api/prices');
          if (res.ok) prices = (await res.json()).prices;
        }
        if (prices) {
          context += '• Živé krypto ceny (Jericho Engine): ' + Object.entries(prices).map(([k, v]) => `${k.toUpperCase()}: $${Number(v.price_usd).toLocaleString('en-US', {maximumFractionDigits: 2})}`).join(', ') + '.\n';
        }
        context += '• Tetrakis ($TTK): Fixná zásoba 1,000,000,000 TTK (ERC-20, OpenZeppelin v5.1.0, Shanghai EVM, sieť Sepolia/Ethereum).\n';
      }
    } catch {}
  }
  return context;
}

export async function callResilientBrain(env, provider, messages, maxTokens = 2048) {
  const candidates = [provider, 'gemini', 'openai', 'groq'].filter((v, i, a) => a.indexOf(v) === i);
  let lastErr = null;
  for (const prov of candidates) {
    try {
      const apiModel = prov === 'openai' ? 'gpt-4.1-mini' : null;
      const res = await callModel(env, prov, messages, maxTokens, apiModel);
      if (res?.text && res.text.trim()) {
        return res.text.trim();
      }
    } catch (err) {
      lastErr = err;
    }
  }
  if (env.AI?.run) {
    try {
      const aiRes = await env.AI.run(env.AI_FAST_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8-fast', {
        messages: messages.map(m => ({role: m.role, content: m.content}))
      });
      if (aiRes?.response?.trim()) return aiRes.response.trim();
    } catch {}
  }
  throw lastErr || new Error('Žiadny AI poskytovateľ momentálne neodpovedá.');
}

export function parseCommand(input, env) {
  const text = String(input || '').trim();
  if (/^\/(start|help)(?:@[a-z0-9_]+)?$/i.test(text)) {
    return {
      answer:
        '🤖 Trinity Telegram AI (v11.1)\n\n' +
        'Dostupné príkazy:\n' +
        '• /status — Prehľad stavu ekosystému Trinity, databáz a AI\n' +
        '• /pc — Stav pripojenia lokálneho PC (PC Bridge & Gateway)\n' +
        '• /crypto alebo /ttk — Živé trhové ceny a Tetrakis ($TTK) token\n' +
        '• /fleet alebo /workers — Prehľad 35 Cloudflare Workerov flotily\n' +
        '• /research <téma> — Hĺbkový výskum témy cez Researcher AI\n' +
        '• /clear alebo /reset — Reset konverzačnej pamäte bota\n' +
        '• /gemini <otázka> — Priamy dopyt na model Gemini\n' +
        '• /openai <otázka> — Priamy dopyt na model OpenAI\n' +
        '• /groq <otázka> — Priamy dopyt na model Groq Llama 3.3\n\n' +
        'Alebo napíš otázku priamo bez lomky pre bežnú konverzáciu.\n' +
        '(Bot je v bezpečnom režime Truth Policy 2.0 — iba pravdivé overené odpovede s kognitívnou pamäťou).'
    };
  }
  if (/^\/status(?:@[a-z0-9_]+)?$/i.test(text)) {
    return {command: 'status'};
  }
  if (/^\/pc(?:@[a-z0-9_]+)?$/i.test(text)) {
    return {command: 'pc'};
  }
  if (/^\/(crypto|ttk|tetrakis)(?:@[a-z0-9_]+)?$/i.test(text)) {
    return {command: 'crypto'};
  }
  if (/^\/(fleet|workers)(?:@[a-z0-9_]+)?$/i.test(text)) {
    return {command: 'fleet'};
  }
  if (/^\/(clear|reset)(?:@[a-z0-9_]+)?$/i.test(text)) {
    return {command: 'clear'};
  }
  const researchMatch = text.match(/^\/research(?:@[a-z0-9_]+)?(?:\s+([\s\S]+))?$/i);
  if (researchMatch) {
    if (!researchMatch[1]?.trim()) return {answer: 'Použitie: /research téma (napr. /research kvantové siete)'};
    return {command: 'research', query: researchMatch[1].trim()};
  }
  const chosen = text.match(/^\/(gemini|openai|groq)(?:@[a-z0-9_]+)?(?:\s+([\s\S]+))?$/i);
  if (chosen && !chosen[2]?.trim()) return {answer: 'Použitie: /' + chosen[1].toLowerCase() + ' tvoja otázka'};
  if (text.startsWith('/') && !chosen) return {answer: 'Neznámy príkaz. Použi /help.'};
  return {provider: chosen ? chosen[1].toLowerCase() : env.TELEGRAM_AI_PROVIDER === 'openai' ? 'openai' : 'gemini', question: (chosen ? chosen[2] : text).slice(0, 4000)};
}

export async function executeStatus(env) {
  const status = telegramIntegrationStatus(env);
  const pc = await getPCBridgeStatus(env).catch(() => ({connected: false, status: 'offline'}));
  const pcDesc = pc.connected ? '🟢 Pripojené (saboi-PC)' : '⚪ Offline / uspaté';
  const cfgDesc = status.bot_token && status.webhook_secret && status.allowed_users ? 'nakonfigurované' : 'neúplná konfigurácia';
  return (
    `Trinity Telegram: ${cfgDesc}.\n\n` +
    '🛡️ TRINITY 11.1 SOVEREIGN ECOSYSTEM\n' +
    '• Verzia: 11.1.0 Sovereign Edition\n' +
    '• Produkčné domény: https://auru.space | https://auru.dev\n' +
    '• Flotila: deklarované Service Bindings (živé pripojenie neoverené)\n' +
    '• Úložiská: D1, KV a R2 podľa konfigurácie (dostupnosť sa tu netestuje)\n' +
    `• Lokálne PC: ${pcDesc}\n` +
    `• Predvolený AI model: ${status.provider.toUpperCase()}\n` +
    '• Režim pravdy: Truth Policy 2.0 Hardcore'
  );
}

export async function executePC(env) {
  const pc = await getPCBridgeStatus(env).catch(() => ({connected: false, status: 'offline'}));
  if (pc.connected) {
    return (
      '💻 LOKÁLNE PC (saboi-PC / Windows)\n\n' +
      '• Stav: 🟢 Online & Pripravené\n' +
      '• Local Gateway: http://127.0.0.1:8791 (Pripojené)\n' +
      '• MCP Bridge: Port 3333 (trinity-mcp-bridge)\n' +
      '• Bezpečný workspace: ~/trinity_local\n' +
      '• Truth Policy: 2.0 Hardcore (Striktná verifikácia)'
    );
  }
  return (
    '💻 LOKÁLNE PC (saboi-PC / Windows)\n\n' +
    '• Stav: ⚪ Offline / Uspané\n' +
    '• Poznámka: PC Bridge na lokálnom porte 8791 momentálne neodpovedá cez Cloudflare Service Binding.\n' +
    '• Pravidlo pravdy: Žiadne simulácie lokálnych akcií.'
  );
}

export async function executeCrypto(env) {
  let prices = null;
  let ttkInfo = null;
  if (env.JERICHO_SERVICE) {
    try {
      if (typeof env.JERICHO_SERVICE.getPrices === 'function') {
        prices = await env.JERICHO_SERVICE.getPrices();
      } else if (env.JERICHO_SERVICE.fetch) {
        const res = await env.JERICHO_SERVICE.fetch('https://trinity.internal/api/prices');
        if (res.ok) {
          const d = await res.json();
          prices = d.prices;
        }
      }
    } catch {}
    try {
      if (typeof env.JERICHO_SERVICE.getTetrakisInfo === 'function') {
        ttkInfo = await env.JERICHO_SERVICE.getTetrakisInfo();
      } else if (env.JERICHO_SERVICE.fetch) {
        const res = await env.JERICHO_SERVICE.fetch('https://trinity.internal/api/tetrakis');
        if (res.ok) ttkInfo = await res.json();
      }
    } catch {}
  }
  let msg = '💎 TRINITY KRYPTO & TETRAKIS ($TTK)\n\n';
  if (prices && typeof prices === 'object' && Object.keys(prices).length > 0) {
    msg += '📊 Trhové Ceny (Jericho Engine):\n';
    for (const [sym, data] of Object.entries(prices)) {
      if (!data) continue;
      const price = Number(data.price_usd || 0).toLocaleString('en-US', {maximumFractionDigits: 2});
      const chg = data.change_24h_pct !== undefined ? ` (${data.change_24h_pct >= 0 ? '+' : ''}${Number(data.change_24h_pct).toFixed(2)}%)` : '';
      msg += `• ${sym.toUpperCase()}: $${price}${chg}\n`;
    }
    msg += '\n';
  } else {
    msg += '• Trhové dáta: nepodarilo sa načítať overené ceny z Jericho Engine\n\n';
  }
  const treasuryAddr = ttkInfo?.treasury_address
    ? `${ttkInfo.treasury_address.slice(0, 10)}...${ttkInfo.treasury_address.slice(-6)}`
    : 'neoverená (nebola vrátená adresa)';
  msg +=
    '🪙 Tetrakis ($TTK) Token:\n' +
    '• Celková ponuka: 1,000,000,000 TTK (Fixná zásoba)\n' +
    '• Štandard: ERC-20 (OpenZeppelin v5.1.0, Shanghai EVM)\n' +
    `• Treasury adresa: ${treasuryAddr}\n` +
    '• Stav: nasadenie smart kontraktu nebolo týmto príkazom overené';
  return msg;
}

export function executeFleet() {
  return (
    '⚡ KATALÓG CLOUDFLARE SERVICE BINDINGS TRINITY\n\n' +
    '🎯 10× AURA Špecialisti:\n' +
    '• AURA_ANALYZER, AURA_ARCHITECT, AURA_CODEGEN, AURA_DEPLOYER, AURA_EVOLVER\n' +
    '• AURA_MEMORY, AURA_OPTIMIZER, AURA_PLANNER, AURA_SENTINEL, AURA_TESTER\n\n' +
    '🏛️ 8× Trinity Core:\n' +
    '• CORE, BUILDER, DISPATCHER, CONNECTORS, GUARDIAN, MEMORY, SENTINEL, SKILLS\n\n' +
    '🔗 8× RPC & Špecializované:\n' +
    '• KNOWLEDGE, CAPACITY, INTEGRATIONS, PC_BRIDGE, PC_BRIDGE_V2, AUDIT, JERICHO, CHAT_INFERENCE\n\n' +
    '🚀 6× Rozšírené Služby:\n' +
    '• RESEARCHER_SERVICE (Llama 3.3 70B & Web Search)\n' +
    '• GEMINI_BRIDGE_SERVICE (Gemini 2.5 Flash Gateway)\n' +
    '• OPS_SERVICE (Ops & MCP Proxy)\n' +
    '• CHAT_MAINTAINER_SERVICE (Autonomous Chat Healing)\n' +
    '• DEPLOYER_SERVICE (KV Code Deployer)\n' +
    '• SEEDER_SERVICE (D1 Database Seeder)\n\n' +
    'Zoznam je deklarovaný katalóg. Aktuálny stav Workerov ani ich dostupnosť tento príkaz netestuje.'
  );
}

export async function executeResearch(env, topic) {
  if (!topic?.trim()) return 'Použitie: /research téma (napr. /research kvantové siete)';
  if (env.RESEARCHER_SERVICE?.fetch) {
    try {
      const res = await env.RESEARCHER_SERVICE.fetch('https://trinity.internal/research', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query: topic.trim(), depth: 'concise'})
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.summary || data?.result || data?.answer;
        if (text) return `🔬 Výsledok Výskumu: ${topic}\n\n${text}`;
      }
    } catch {}
  }
  const system = 'Si autonómny výskumný špecialista Trinity. Poskytni štruktúrovaný, hĺbkový a vecný rešerš k zadanej téme v slovenskom jazyku. Uveď kľúčové fakty, aktuálny stav a zhrnutie. Buď vecný a pravdivý.';
  const res = await callModel(env, 'gemini', [{role:'system',content:system},{role:'user',content:`Vypracuj stručný rešerš na tému: ${topic}`}], 1000);
  return `🔬 Výsledok Výskumu: ${topic}\n\n${res?.text || 'Výskum nevrátil výsledok.'}`;
}

async function sendTelegramMessage(env, chatId, text) {
  const response = await fetch('https://api.telegram.org/bot' + telegramToken(env) + '/sendMessage', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({chat_id: chatId, text: String(text).slice(0, 3900)}),
    signal: AbortSignal.timeout(10000),
    redirect: 'manual'
  });
  if (!response.ok) throw new Error('Telegram delivery HTTP ' + response.status);
  const result = await response.json();
  if (result.ok !== true) throw new Error('Telegram rejected the message');
}

export async function processTelegramUpdate(env, update) {
  const message = update.message;
  if (!message || typeof message.text !== 'string') return;
  const parsed = parseCommand(message.text, env);
  let output = parsed.answer;
  if (!output && parsed.command) {
    try {
      if (parsed.command === 'status') output = await executeStatus(env);
      else if (parsed.command === 'pc') output = await executePC(env);
      else if (parsed.command === 'crypto') output = await executeCrypto(env);
      else if (parsed.command === 'fleet') output = executeFleet();
      else if (parsed.command === 'research') output = await executeResearch(env, parsed.query);
      else if (parsed.command === 'clear') {
        await clearChatHistory(env, message.chat.id);
        output = '🧹 Konverzačná pamäť bola vyčistená. Začíname odznova.';
      }
    } catch (err) {
      output = 'Chyba pri spracovaní príkazu: ' + (err instanceof Error ? err.message : String(err));
    }
  }
  if (!output) {
    try {
      const history = await getChatHistory(env, message.chat.id);
      const grounding = await buildSystemGroundingContext(env, parsed.question);
      const system =
        'Si Trinity_Telegram, vysoko inteligentná, suverénna AI asistentka ekosystému Trinity 11.1 v súkromnom Telegram chate s majiteľom Sabom Ivanom (Basterixom).\n' +
        'Odpovedaj prirodzene, bystro, slovensky, s rešpektom a vtipom kde sa hodí, ale striktne pravdivo.\n' +
        'Tento kanál slúži na reporting, konzultácie, analýzy a riadenie ekosystému. Nemáš oprávnenie spúšťať deštruktívne shell príkazy na PC ani vykonávať platby. Dodržiavaj Truth Policy 2.0 Hardcore – nikdy netvrď, že si niečo vykonala, ak to nie je overené.\n' +
        grounding;

      const modelMessages = [
        {role: 'system', content: system},
        ...history,
        {role: 'user', content: parsed.question}
      ];

      const answerText = await callResilientBrain(env, parsed.provider, modelMessages, 850);
      output = answerText;

      // Update history in background
      history.push({role: 'user', content: parsed.question});
      history.push({role: 'assistant', content: answerText});
      await saveChatHistory(env, message.chat.id, history);
    } catch {
      output = 'Model momentálne neodpovedá. Skontroluj konfiguráciu poskytovateľa v Trinity.';
    }
  }
  await sendTelegramMessage(env, message.chat.id, output);
}

export async function handleTelegramWebhook(request, env, ctx) {
  if (request.method !== 'POST') return reply({error: 'Method not allowed'}, 405);
  const status = telegramIntegrationStatus(env);
  if (!status.bot_token || !status.webhook_secret || !status.allowed_users || !env.DB) {
    return reply({error: 'Telegram bridge not configured'}, 503);
  }
  const received = request.headers.get(WEBHOOK_HEADER);
  if (!received || !await equal(received, String(env.TELEGRAM_WEBHOOK_SECRET))) {
    return reply({error: 'Unauthorized'}, 401);
  }
  let update;
  try { update = await readJSON(request, 16000); }
  catch { return reply({error: 'Invalid update'}, 400); }
  if (!Number.isSafeInteger(update?.update_id) || update.update_id < 0) return reply({error: 'Invalid update id'}, 400);
  const message = update.message;
  const allowed = await getAllowedUserIds(env);
  if (!message || typeof message.text !== 'string' || message.chat?.type !== 'private' ||
      !Number.isSafeInteger(message.from?.id) || !Number.isSafeInteger(message.chat?.id) ||
      message.from.id !== message.chat.id ||
      !allowed.has(String(message.from.id))) {
    return reply({ok: true, ignored: true});
  }
  await rateLimit(env, 'telegram:private:' + message.from.id, 12, 60);
  const key = 'telegram:inbound:' + update.update_id;
  const inserted = await env.DB.prepare(
    "INSERT INTO ops_memory(key,value,source,updated_at) VALUES(?,?,'telegram-inbound',datetime('now')) ON CONFLICT(key) DO NOTHING RETURNING key"
  ).bind(key, String(message.from.id)).first();
  if (!inserted) return reply({ok: true, duplicate: true});
  const run = processTelegramUpdate(env, update).catch(() => {
    // Telegram has already been acknowledged; no bot tokens or message content are logged.
    console.error('telegram_background_delivery_failed');
  });
  if (ctx?.waitUntil) ctx.waitUntil(run);
  else await run;
  return reply({ok: true});
}

async function telegramApi(env, method, payload) {
  const response = await fetch('https://api.telegram.org/bot' + telegramToken(env) + '/' + method, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload || {}),
    redirect: 'manual',
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('Telegram ' + method + ' HTTP ' + response.status);
  const data = await response.json();
  if (data.ok !== true) throw new Error('Telegram ' + method + ' rejected request');
  return data.result;
}

// One-time bootstrap: callable only while a separate, temporary Worker secret exists.
// It does not reveal or transfer the bot token. It will not replace a foreign webhook.
export async function activateTelegramWebhook(request, env) {
  if (request.method !== 'POST') return reply({error:'Method not allowed'},405);
  const origin = new URL(request.url).origin;
  if (origin !== 'https://auru.space' || env.TRINITY_ENV !== 'production') {
    return reply({error:'Production-only operation'},403);
  }
  const setupKey = env.TRINITY_TELEGRAM_SETUP_KEY;
  const suppliedKey = request.headers.get('X-Trinity-Telegram-Setup');
  if (typeof setupKey !== 'string' || setupKey.length < 32 || !suppliedKey ||
      !await equal(setupKey, suppliedKey)) {
    return reply({error:'Not authorized'},401);
  }
  const status = telegramIntegrationStatus(env);
  if (!status.bot_token || !status.webhook_secret || !status.allowed_users ||
      !/^[a-zA-Z0-9_-]{32,256}$/.test(String(env.TELEGRAM_WEBHOOK_SECRET))) {
    return reply({error:'Telegram configuration incomplete'},503);
  }
  const webhookUrl = 'https://auru.space/api/telegram/webhook';
  let info;
  try {
    info = await telegramApi(env,'getWebhookInfo');
  } catch {
    return reply({error:'Telegram bot token could not be verified'},502);
  }
  if (info?.url && info.url !== webhookUrl) {
    // Refuse to steal the single active webhook from any other service.
    return reply({error:'An existing different webhook is configured',existing_webhook:info.url},409);
  }
  try {
    await telegramApi(env,'setWebhook',{url:webhookUrl,
      secret_token:env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates:['message'],drop_pending_updates:false,max_connections:10});
    const registered = await telegramApi(env,'getWebhookInfo');
    if (registered?.url !== webhookUrl) throw new Error('Webhook verification failed');
    const recipient=[...allowedIds(env.TELEGRAM_ALLOWED_USER_IDS)][0];
    let delivery_test=false;
    try {
      await sendTelegramMessage(env,recipient,'Trinity 11: Telegram AI je pripravená. Pošli /help, /gemini otázka alebo /openai otázka.');
      delivery_test=true;
    } catch { console.error('telegram_setup_delivery_failed'); }
    return reply({ok:true,registered:true,url:webhookUrl,delivery_test,pending_updates:registered?.pending_update_count||0});
  } catch {
    return reply({error:'Webhook registration or verification failed'},502);
  }
}
