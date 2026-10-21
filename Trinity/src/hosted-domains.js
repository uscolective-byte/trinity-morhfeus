import {z} from 'zod';
import {HttpError} from './security.js';
import {getDomain,domainNameSchema} from './domains.js';
import {cloudflareAccount,cloudflareRequest} from './infrastructure.js';

export const hostedDomainInput=z.object({
 site_id:z.string().uuid(),
 domain:domainNameSchema,
 hostname:domainNameSchema
}).strict();

// Only sites created by Trinity may be attached; this never accepts arbitrary Worker code.
export async function attachHostedDomain(env,input,dependencies={}){
 const data=hostedDomainInput.parse(input),request=dependencies.request||cloudflareRequest,lookup=dependencies.lookup||getDomain;
 const [row,domain]=await Promise.all([
  env.DB.prepare("SELECT value FROM ops_memory WHERE key=? AND source='hosting'").bind('hosting/'+data.site_id).first(),
  lookup(env,data.domain)
 ]);
 if(!row)throw new HttpError(404,'Nasadený web neexistuje.');
 const site=JSON.parse(row.value);
 if(site.id!==data.site_id||!/^trinity-site-[a-f0-9-]{18}$/.test(site.worker))throw new HttpError(409,'Neplatný záznam hostingu.');
 if(!domain?.zone_id)throw new HttpError(409,'Najprv synchronizuj doménu s Cloudflare zónou.');
 if(data.hostname!==domain.domain_name&&!data.hostname.endsWith('.'+domain.domain_name))throw new HttpError(400,'Názov webu musí patriť pod vybranú doménu.');
 const zone=(await request(env,'/zones/'+encodeURIComponent(domain.zone_id))).result;
 if(zone?.status!=='active'||zone.name!==domain.domain_name||zone.account?.id!==cloudflareAccount(env))throw new HttpError(409,'Zóna nie je aktívna v účte Trinity.');
 const dns=await request(env,'/zones/'+encodeURIComponent(domain.zone_id)+'/dns_records?name='+encodeURIComponent(data.hostname));
 if(!Array.isArray(dns.result))throw new HttpError(502,'Neplatná odpoveď DNS.');
 if(dns.result.length)throw new HttpError(409,'Názov už má DNS záznam. Trinity ho automaticky neprepíše.');
 // Cloudflare rejects conflicting DNS; no delete or overwrite is attempted.
 const result=(await request(env,'/accounts/'+cloudflareAccount(env)+'/workers/domains','PUT',{
  hostname:data.hostname,service:site.worker,enabled:true,zone_id:domain.zone_id,zone_name:domain.domain_name
 })).result;
 if(!result?.id||result.hostname!==data.hostname||result.service!==site.worker)throw new HttpError(502,'Cloudflare nepotvrdil očakávané prepojenie. Skontroluj domény v účte pred opakovaním.');
 const receipt={id:result.id,site_id:site.id,hostname:result.hostname,worker:site.worker,zone_id:domain.zone_id,status:'attached',verification:'pending',visibility:site.visibility,created_at:new Date().toISOString()};
 await env.DB.prepare("INSERT INTO ops_memory(key,value,source) VALUES(?,?,'hosting-domain') ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind('hosting-domain/'+result.id,JSON.stringify(receipt)).run();
 await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('hosting_domain_attached',?)").bind(JSON.stringify(receipt)).run();
 return receipt;
}
