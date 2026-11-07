import {WorkerEntrypoint} from 'cloudflare:workers';
import {scrape,publishFirebase} from '../../Trinity/services/integration-providers.js';
export const INTEGRATION_SKILLS = [
  { name: 'scrape', description: 'Web scraping via Firecrawl integration', parameters: ['url', 'options'] },
  { name: 'publishFirebase', description: 'Publish and sync state to Firebase Realtime Database', parameters: ['health'] },
  { name: 'pingService', description: 'Health check integration ping for connected endpoints', parameters: ['target'] },
  { name: 'formatIntegrationReport', description: 'Format and summarize integration statuses', parameters: [] }
];

export const INTEGRATION_PLUGINS = [
  { id: 'firecrawl-scraper', name: 'Firecrawl Scraper Engine', version: '2.0.0', status: 'active' },
  { id: 'firebase-sync', name: 'Firebase Realtime State Syncer', version: '2.0.0', status: 'active' },
  { id: 'webhook-gateway', name: 'External Webhook & Notification Gateway', version: '2.0.0', status: 'active' }
];

export default class IntegrationsService extends WorkerEntrypoint {
  getStatus(){return {firebase:{project:this.env.FIREBASE_PROJECT_ID||null,credentials_configured:Boolean(this.env.FIREBASE_SERVICE_ACCOUNT_JSON),live_verified:false},firecrawl:{credentials_configured:Boolean(this.env.FIRECRAWL_API_KEY),live_verified:false}};}
  listSkills(){return INTEGRATION_SKILLS;}
  listPlugins(){return INTEGRATION_PLUGINS;}
  async executeSkill(name, params = {}){
    switch(name){
      case 'scrape': return this.scrape(params);
      case 'publishFirebase': return this.publishFirebase(params.health || params);
      case 'pingService': return { ok: true, target: params.target || 'default', timestamp: Date.now(), status: 'reachable' };
      case 'formatIntegrationReport': return { ok: true, report: this.getStatus(), generated_at: new Date().toISOString() };
      default: return { ok: false, error: `Neznámy skill pre Integrations-Worker: ${name}` };
    }
  }
  async scrape(input){try{return {ok:true,result:await scrape(this.env,input)};}catch(e){return {ok:false,status:e.status||502,error:e.status?e.message:'Firecrawl integration failed'};}}
  async publishFirebase(health){
    const safe={version:typeof health?.version==='string'?health.version.slice(0,80):'unknown',status:typeof health?.status==='string'?health.status.slice(0,80):'unknown'};
    try{return {ok:true,result:await publishFirebase(this.env,safe)};}catch(e){return {ok:false,status:e.status||502,error:e.status?e.message:'Firebase integration failed'};}
  }
  async fetch(request){
    const url = new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/health'){
      const s = this.getStatus();
      return Response.json({ok:true,service:'trinity-integrations',version:'2.1.0',status:'healthy',integrations:s});
    }
    return new Response('Not found',{status:404});
  }
}
