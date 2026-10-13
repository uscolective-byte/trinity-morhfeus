import {WorkerEntrypoint} from 'cloudflare:workers';
import {scrape,publishFirebase} from '../../Trinity/services/integration-providers.js';
export default class IntegrationsService extends WorkerEntrypoint {
 getStatus(){return {firebase:{project:this.env.FIREBASE_PROJECT_ID||null,credentials_configured:Boolean(this.env.FIREBASE_SERVICE_ACCOUNT_JSON),live_verified:false},firecrawl:{credentials_configured:Boolean(this.env.FIRECRAWL_API_KEY),live_verified:false}};}
 async scrape(input){try{return {ok:true,result:await scrape(this.env,input)};}catch(e){return {ok:false,status:e.status||502,error:e.status?e.message:'Firecrawl integration failed'};}}
 async publishFirebase(health){
  const safe={version:typeof health?.version==='string'?health.version.slice(0,80):'unknown',status:typeof health?.status==='string'?health.status.slice(0,80):'unknown'};
  try{return {ok:true,result:await publishFirebase(this.env,safe)};}catch(e){return {ok:false,status:e.status||502,error:e.status?e.message:'Firebase integration failed'};}
 }
 fetch(){return new Response('Not found',{status:404});}
}
