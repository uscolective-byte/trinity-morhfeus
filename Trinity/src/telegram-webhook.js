import {equal, HttpError, rateLimit, readJSON} from './security.js';

export const TELEGRAM_WEBHOOK_PATH = '/api/integrations/telegram/webhook';
const TOKEN_FORMAT = /^\d{5,20}:[A-Za-z0-9_-]{30,100}$/;
const SECRET_FORMAT = /^[A-Za-z0-9_-]{24,256}$/;
const CHAT_ID_FORMAT = /^-?\d{1,20}$/;
const MAX_REPLY_CHARS = 3900;

function allowedChatIds(env) {
  const raw = String(env.TELEGRAM_ALLOWED_CHAT_IDS || env.TELEGRAM_CHAT_ID || '');
  return new Set(raw.split(',').map(value => value.trim()).filter(value => CHAT_ID_FORMAT.test(value)));
}

function getText(result) {
  if (typeof result === 'string') return result;
  const content = result?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(part => typeof part?.text === 'string' ? part.text : '').filter(Boolean).join('\n');
  if (typeof content?.text === 'string') return content.text;
  return 'Trinity nezískala textovú odpoveď od AI. Skús to znova.';
}

export async function sendTelegramWebhookReply(env, chatId, text, replyToMessageId) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!TOKEN_FORMAT.test(String(token || ''))) throw new HttpError(503, 'Telegram bot nie je nakonfigurovaný.');
  const payload = {
    chat_id: chatId,
    text: String(text || 'Trinity momentálne nemá odpoveď.').slice(0, MAX_REPLY_CHARS)
  };
  if (Number.isSafeInteger(replyToMessageId) && replyToMessageId > 0) {
    payload.reply_parameters = {message_id: replyToMessageId, allow_sending_without_reply: true};
  }
  // Never log the Bot API URL: it contains a credential.
  const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok !== true) throw new HttpError(502, 'Telegram nepotvrdil doručenie správy.');
  return {sent: true};
}

export async function processTelegramMessage(message, env, askAgent, sendReply = sendTelegramWebhookReply) {
  const chatId = String(message.chat.id);
  const raw = message.text.trim();
  const command = raw.split(/\s+/, 1)[0].toLowerCase().split('@')[0];
  let answer;
  if (command === '/start' || command === '/help') {
    answer = 'Trinity je pripojená k Telegramu. Napíš otázku, alebo použi /ask otázka. Príkazy: /ping, /status, /help. Tento kanál nepovoľuje zmeny kódu, spúšťanie príkazov ani prácu so secrets.';
  } else if (command === '/ping') {
    answer = 'Pong — Telegram webhook Trinity prijal správu.';
  } else if (command === '/status') {
    answer = 'Telegram webhook odpovedá. Stav AI modelu sa overí pri skutočnej otázke; nasadenie a ostatné integrácie tým nie sú overené.';
  } else if (raw.startsWith('/')) {
    if (command !== '/ask') answer = 'Neznámy príkaz. Použi /help.';
  }
  if (!answer) {
    const prompt = command === '/ask' ? raw.replace(/^\/ask(?:@[A-Za-z0-9_]+)?\s*/i, '').trim() : raw;
    if (!prompt) answer = 'Napíš otázku za /ask.';
    else {
      // Deliberately do not pass skill, tool or administrative privileges.
      const result = await askAgent(prompt, {
        userId: 'telegram:' + chatId,
        sessionId: 'telegram-chat-' + chatId,
        useTrinityAI: true,
        noCache: true,
        retries: 0,
        enableFallback: false,
        maxTokens: 1000
      });
      answer = getText(result);
    }
  }
  return sendReply(env, chatId, answer, message.message_id);
}

export async function handleTelegramWebhook(request, env, ctx, askAgent, sendReply = sendTelegramWebhookReply) {
  if (request.method !== 'POST') throw new HttpError(405, 'Telegram webhook vyžaduje POST.');
  const token = env.TELEGRAM_BOT_TOKEN;
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  const allowed = allowedChatIds(env);
  if (!TOKEN_FORMAT.test(String(token || '')) || !SECRET_FORMAT.test(String(secret || '')) || !allowed.size) {
    throw new HttpError(503, 'Telegram webhook nie je nakonfigurovaný.');
  }

  // Telegram sets this header only after setWebhook(secret_token=...) is configured.
  const supplied = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (!supplied || !await equal(supplied, secret)) throw new HttpError(403, 'Telegram webhook odmietol požiadavku.');

  const update = await readJSON(request, 32000);
  if (!Number.isSafeInteger(update?.update_id) || update.update_id < 0) throw new HttpError(400, 'Neplatná Telegram aktualizácia.');
  const message = update.message;
  if (!message || typeof message !== 'object' || typeof message.text !== 'string') return Response.json({ok: true, ignored: true});
  if (message.chat?.type !== 'private' || !Number.isSafeInteger(message.chat?.id) || message.from?.is_bot === true) {
    return Response.json({ok: true, ignored: true});
  }
  const chatId = String(message.chat.id);
  // Ignore unknown senders without revealing allowed chat IDs or retrying endlessly.
  if (!allowed.has(chatId)) return Response.json({ok: true, ignored: true});
  if (!message.text.trim() || message.text.length > 3500) return Response.json({ok: true, ignored: true});

  await rateLimit(env, 'tg:webhook:' + chatId, 30, 60);
  const work = processTelegramMessage(message, env, askAgent, sendReply).catch(async () => {
    // Do not log prompts, secrets or Telegram API URLs.
    console.error(JSON.stringify({event: 'telegram_reply_failed'}));
    try { await sendReply(env, chatId, 'Spracovanie správy zlyhalo. Skús to neskôr.', message.message_id); } catch {}
  });
  if (typeof ctx?.waitUntil === 'function') ctx.waitUntil(work);
  else await work;
  return Response.json({ok: true});
}
