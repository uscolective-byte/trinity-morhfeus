import knowledge,{syncMemory} from './knowledge-entry.js';
import {authenticate,checkOrigin,readJSON,secure,HttpError,rateLimit} from '../src/security.js';
import {readControl,assertRunning} from '../src/control.js';
export {TrinityAgent,ChatAgent,GuardianAgent,TrinityOperations} from '../src/index.js';
function unwrap(receipt){if(!receipt?.ok)throw new HttpError(receipt?.status||502,receipt?.error||'Integration worker failed');return receipt.result;}
export default {async fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/api/integrations/'))return knowledge.fetch(request,env,ctx);
 try{
  checkOrigin(request);const user=await authenticate(request,env);
  if(!['owner','admin'].includes(user.role))throw new HttpError(403,'Integrations require owner or admin access');
  await rateLimit(env,'integrations:'+user.id,5);
  let result;
  if(path==='/api/integrations/status'&&request.method==='GET'){
   if(!env.INTEGRATIONS_SERVICE)throw new HttpError(503,'Integration worker is not connected');
   result=await env.INTEGRATIONS_SERVICE.getStatus();
  }else if(request.method==='POST'&&path==='/api/integrations/firecrawl/scrape'){
   assertRunning(await readControl(env));
   if(!env.KNOWLEDGE_SERVICE)throw new HttpError(503,'Knowledge service is not connected');
   if(!env.INTEGRATIONS_SERVICE)throw new HttpError(503,'Integration worker is not connected');
   const input=await readJSON(request,5000);const doc=unwrap(await env.INTEGRATIONS_SERVICE.scrape(input));
   const saved=await env.KNOWLEDGE_SERVICE.importDocument(doc);await syncMemory(env,saved);
   result={stored:true,source_id:saved.id,hash:saved.hash,updated_at:saved.updated_at};
  }else if(request.method==='POST'&&path==='/api/integrations/firebase/publish'){
   assertRunning(await readControl(env));await readJSON(request,1000);
   const response=await knowledge.fetch(new Request(new URL('/api/health',request.url)),env,ctx);
   if(!response.ok)throw new HttpError(502,'Trinity health is unavailable');
   if(!env.INTEGRATIONS_SERVICE)throw new HttpError(503,'Integration worker is not connected');
   result=unwrap(await env.INTEGRATIONS_SERVICE.publishFirebase(await response.json()));
  }else throw new HttpError(404,'Unknown integration endpoint');
  return secure(Response.json(result));
 }catch(e){return secure(Response.json({error:e.status?e.message:'Integration failed'},{status:e.status||500}));}
}};
