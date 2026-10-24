import {WorkerEntrypoint} from 'cloudflare:workers';
import {reviewReply} from './quality.mjs';
import {ROLE,maintenanceStatus,inspectChat} from './maintenance.mjs';

export default class ChatMaintainer extends WorkerEntrypoint {
  async getStatus(environment){return maintenanceStatus(this.env,environment);}
  async inspect(environment){return inspectChat(this.env,environment,{repair:true});}
  reviewReply(text){return {...reviewReply(text),role:ROLE.id};}
  async scheduled(){
    const results=await Promise.allSettled(['production','development'].map(environment=>inspectChat(this.env,environment,{repair:true})));
    if(results.some(result=>result.status==='rejected'))throw new Error('Chat maintenance inspection failed');
  }
  fetch(){return new Response('Not found',{status:404});}
}
