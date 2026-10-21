import {HttpError,readJSON,rateLimit} from './security.js';
import {readControl,assertRunning} from './control.js';
export function telegramStatus(env){
 const identity=/^[1-9][0-9]{0,15}$/.test(String(env.TELEGRAM_OWNER_USER_ID||''));
 return {configured:!!(env.TELEGRAM_BOT_TOKEN&&/^[A-Za-z0-9_-]{32,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET||'')&&identity&&env.TELEGRAM_WORKFLOW),identity_configured:identity,workflow:!!env.TELEGRAM_WORKFLOW,admin_enabled:env.TELEGRAM_ADMIN_ENABLED==='true',verification:'not_checked'};
}
export function authorizedTelegramMessage(env,update){
 const m=update?.message,id=String(env.TELEGRAM_OWNER_USER_ID||'');
 if(!/^[1-9][0-9]{0,15}$/.test(id))return null;
 if(!Number.isSafeInteger(update.update_id)||update.update_id<0||m?.chat?.type!=='private'||String(m.from?.id)!==id||String(m.chat.id)!==id||m.from?.is_bot)return null;
 if(typeof m.text!=='string'||!m.text.trim()||m.text.length>6000)return null;
 return {update_id:update.update_id,chat_id:id,user_id:id,text:m.text.trim()};
}
export async function telegramAPI(env,method,payload,fetcher=fetch){
 if(!/^[0-9]+:[A-Za-z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN||''))throw new HttpError(503,'Chýba platný Telegram bot token.');
 if(!['getMe','getWebhookInfo','setWebhook','sendMessage'].includes(method))throw new HttpError(400,'Nepovolená Telegram operácia.');
 let response,data;
 try{
  response=await fetcher('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000),redirect:'error'});
  data=await response.json();
 }catch{throw new HttpError(502,'Telegram je nedostupný alebo vrátil neplatnú odpoveď.');}
 if(!response.ok||data.ok!==true)throw new HttpError(502,'Telegram API odmietlo operáciu '+method+'.');
 return data.result;
}
export async function configureTelegramWebhook(env,origin,api=telegramAPI){
 if(!telegramStatus(env).configured)throw new HttpError(503,'Doplň Telegram bot token, webhook secret, owner user ID a workflow.');
 const expected=env.TRINITY_ENV==='production'?'https://auru.space':'https://auru.dev';
 if(origin!==expected)throw new HttpError(400,'Webhook možno nastaviť iba na kanonickej adrese tohto prostredia.');
 const bot=await api(env,'getMe',{});
 await api(env,'setWebhook',{url:origin+'/api/integrations/telegram/webhook',secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message'],max_connections:1,drop_pending_updates:false});
 const info=await api(env,'getWebhookInfo',{});
 if(info.url!==origin+'/api/integrations/telegram/webhook')throw new HttpError(502,'Telegram nepotvrdil očakávaný webhook.');
 return {configured:true,bot_username:bot.username,webhook:info.url,pending_updates:info.pending_update_count||0,end_to_end_verified:false};
}
export async function handleTelegramWebhook(request,env,dependencies={}){
 if(request.method!=='POST')throw new HttpError(405,'Použi POST.');
 if(!telegramStatus(env).configured)throw new HttpError(503,'Telegram nie je nakonfigurovaný.');
 if(request.headers.get('X-Telegram-Bot-Api-Secret-Token')!==env.TELEGRAM_WEBHOOK_SECRET)throw new HttpError(403,'Neplatné overenie webhooku.');
 const update=await readJSON(request,20000),message=authorizedTelegramMessage(env,update);
 if(!message)return Response.json({ok:true,ignored:true});
 await (dependencies.limit||rateLimit)(env,'telegram:'+message.user_id,12,60);
 assertRunning(await (dependencies.control||readControl)(env));
 const id='telegram-'+message.update_id;
 try{await env.TELEGRAM_WORKFLOW.create({id,params:message});}
 catch{
  try{const existing=await env.TELEGRAM_WORKFLOW.get(id);await existing.status();}
  catch{throw new HttpError(503,'Telegram úlohu sa nepodarilo uložiť.');}
 }
 return Response.json({ok:true,queued:true});
}
