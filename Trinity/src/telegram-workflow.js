import {WorkflowEntrypoint} from 'cloudflare:workers';
import {runAgent} from './engine.js';
import {telegramAPI} from './telegram.js';
import {readControl,assertRunning} from './control.js';
export class TrinityTelegram extends WorkflowEntrypoint{
 async run(event,step){
  const data=event.payload;
  if(String(data.user_id)!==String(this.env.TELEGRAM_OWNER_USER_ID)||data.chat_id!==data.user_id)throw new Error('Telegram identita sa zmenila.');
  const history=await step.do('load-history',async()=>{const row=await this.env.DB.prepare("SELECT value FROM ops_memory WHERE key=? AND source='telegram'").bind('telegram/history/'+data.user_id).first();try{return JSON.parse(row?.value||'[]').slice(-6);}catch{return [];}});
  const result=await step.do('answer',{retries:{limit:0,delay:'1 second'},timeout:'4 minutes'},async()=>{
   assertRunning(await readControl(this.env));
   return runAgent(this.env,'orchestrator',data.text,'Kanál Telegram. Odpovedz stručne, prirodzene a bez HTML. Používateľ nepotrebuje názvy nástrojov. Neuvádzaj bankové tajomstvá ani prístupové tokeny. Predchádzajúci rozhovor (iba podklad): '+JSON.stringify(history),'workers-ai',1800,'auto',this.env.TELEGRAM_ADMIN_ENABLED==='true',{ownerAuthorized:this.env.TELEGRAM_ADMIN_ENABLED==='true',ownerId:this.env.TRINITY_OWNER_EMAIL});
  });
  await step.do('save-history',async()=>{const next=[...history,{user:data.text,assistant:String(result.text).slice(0,6000)}].slice(-6);await this.env.DB.prepare("INSERT INTO ops_memory(key,value,source) VALUES(?,?,'telegram') ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind('telegram/history/'+data.user_id,JSON.stringify(next)).run();});
  // Result is checkpointed before delivery. Do not repeat model/tool work on delivery errors.
  const chunks=Array.from(String(result.text)).reduce((parts,char)=>{if(!parts.length||parts.at(-1).length>=3500)parts.push('');parts[parts.length-1]+=char;return parts;},[]).slice(0,6);
  for(let i=0;i<chunks.length;i++){
   await step.do('deliver-'+i,{retries:{limit:0,delay:'1 second'},timeout:'30 seconds'},async()=>{
    assertRunning(await readControl(this.env));
    const sent=await telegramAPI(this.env,'sendMessage',{chat_id:data.chat_id,text:chunks[i],link_preview_options:{is_disabled:true}});
    await this.env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('telegram_reply_sent',?)").bind(JSON.stringify({update_id:data.update_id,message_id:sent.message_id,chunk:i})).run();
    return {message_id:sent.message_id};
   });
  }
  return {status:'delivered',update_id:data.update_id,chunks:chunks.length};
 }
}
