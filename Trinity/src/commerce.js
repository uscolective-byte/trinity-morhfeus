import {z} from 'zod';
export function revolutPaymentLink(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!['checkout.revolut.com','revolut.me'].includes(url.hostname))throw new Error('Použi platobný odkaz vytvorený v aplikácii Revolut Pro.');
 if(url.hostname==='checkout.revolut.com'&&!/^\/payment-link\/[a-zA-Z0-9-]+\/?$/.test(url.pathname))throw new Error('Neplatný Revolut platobný odkaz.');
 if(url.hostname==='revolut.me'&&!/^\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname))throw new Error('Neplatný Revolut odkaz.');
 return url.href;
}
export const offerInput=z.object({title:z.string().trim().min(3).max(120),deliverable:z.string().trim().min(10).max(3000),amount_cents:z.number().int().positive().max(10000000),currency:z.enum(['EUR','USD','GBP','CZK']).default('EUR'),payment_link:z.string().max(1500).transform(revolutPaymentLink)}).strict();
export const leadInput=z.object({company:z.string().trim().min(2).max(150),source_url:z.string().url().max(1500).refine(value=>{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}),need:z.string().trim().min(10).max(2000)}).strict();
async function save(env,ownerId,kind,data){
 const item={id:crypto.randomUUID(),...data,status:kind==='offer'?'draft':'unverified',created_at:new Date().toISOString(),payment_verified:false,sent:false};
 await env.DB.prepare("INSERT INTO ops_memory(key,value,source) VALUES(?,?,'commerce')").bind('commerce/'+ownerId+'/'+kind+'/'+item.id,JSON.stringify(item)).run();
 await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('commerce_draft_created',?)").bind(JSON.stringify({owner_id:ownerId,id:item.id,kind})).run();
 return item;
}
export const createSalesOffer=(env,ownerId,input)=>save(env,ownerId,'offer',offerInput.parse(input));
export const saveSalesLead=(env,ownerId,input)=>save(env,ownerId,'lead',leadInput.parse(input));
export async function salesPipeline(env,ownerId){
 const prefix='commerce/'+ownerId+'/';
 const rows=await env.DB.prepare("SELECT key,value FROM ops_memory WHERE source='commerce' AND substr(key,1,?)=? ORDER BY updated_at DESC LIMIT 100").bind(prefix.length,prefix).all();
 return {items:(rows.results||[]).map(row=>({kind:row.key.startsWith(prefix+'offer/')?'offer':'lead',...JSON.parse(row.value)})),revolut:{revtag:env.REVOLUT_REVTAG||null,bank_connected:false,automatic_payment_verification:false,mode:'owner-provided-payment-links'},trading:{paper_only:true,live_orders:false}};
}
