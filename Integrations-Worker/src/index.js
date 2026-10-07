import {WorkerEntrypoint} from 'cloudflare:workers';
import {scrape,publishFirebase} from '../../Trinity/services/integration-providers.js';
export default class IntegrationsService extends WorkerEntrypoint {
 getStatus(){return {firebase:{project:this.env.FIREBASE_PROJECT_ID||null,credentials_configured:Boolean(this.env.FIREBASE_SERVICE_ACCOUNT_JSON),live_verified:false},firecrawl:{credentials_configured:Boolean(this.env.FIRECRAWL_API_KEY),live_verified:false}};}
 scrape(input){return scrape(this.env,input);}
 publishFirebase(health){
  const safe={version:typeof health?.version==='string'?health.version.slice(0,80):'unknown',status:typeof health?.status==='string'?health.status.slice(0,80):'unknown'};
  return publishFirebase(this.env,safe);
 }
 fetch(){return new Response('Not found',{status:404});}
}
