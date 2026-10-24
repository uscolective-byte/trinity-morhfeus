import bundledCatalog from '../config/revolut-pro-products.json' with {type:'json'};
import {z} from 'zod';
import {HttpError} from './security.js';

const CONFIG_KEY='payments:revolut-pro:products:v1';
const PAYPAL_CONFIG_KEY='payments:paypal:products:v1';
const COMMERCE_ACCOUNTS_KEY='payments:commerce:accounts:v1';
const productId=z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);

export function normalizeRevolutInput(raw){
 const val=String(raw||'').trim();
 if(!val)return '';
 if(/^@[a-zA-Z0-9_.-]{2,60}$/.test(val))return `https://revolut.me/${val.slice(1)}`;
 if(/^[a-zA-Z0-9_.-]{2,60}$/.test(val)&&!val.includes('.')&&!val.includes('/'))return `https://revolut.me/${val}`;
 if(/^(?:www\.)?revolut\.me\/[a-zA-Z0-9_.-]+/i.test(val))return `https://${val.replace(/^www\./i,'')}`;
 return val;
}

export function normalizePaypalInput(raw,amountEur=null,itemName=''){
 const val=String(raw||'').trim();
 if(!val)return '';
 // 1. Personal PayPal email address -> official PayPal Standard _xclick checkout link
 if(!/[:/]/.test(val)&&/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val)){
  const params=new URLSearchParams({
   cmd:'_xclick',
   business:val,
   currency_code:'EUR'
  });
  if(amountEur&&Number(amountEur)>0)params.set('amount',Number(amountEur).toFixed(2));
  if(itemName)params.set('item_name',String(itemName).slice(0,120));
  return `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
 }
 // 2. Personal @handle or plain username -> PayPal.me link
 if(/^@?[a-zA-Z0-9_.-]{2,60}$/.test(val)&&!val.includes('/')){
  const handle=val.replace(/^@/,'');
  if(amountEur&&Number(amountEur)>0){
   const cleanAmt=Number.isInteger(Number(amountEur))?String(Number(amountEur)):Number(amountEur).toFixed(2);
   return `https://www.paypal.com/paypalme/${handle}/${cleanAmt}`;
  }
  return `https://paypal.me/${handle}`;
 }
 // 3. paypal.me/handle without https://
 if(/^(?:www\.)?paypal\.me\/[a-zA-Z0-9_.-]+/i.test(val)){
  const base=`https://${val}`;
  if(amountEur&&Number(amountEur)>0&&!/\/\d+(\.\d+)?[a-zA-Z]*$/.test(val)){
   const cleanAmt=Number.isInteger(Number(amountEur))?String(Number(amountEur)):Number(amountEur).toFixed(2);
   return `${base.replace(/\/$/,'')}/${cleanAmt}`;
  }
  return base;
 }
 // 4. Full https://paypal.me/handle or https://www.paypal.com/paypalme/handle -> append amount if needed
 try{
  const u=new URL(val);
  if(['paypal.me','www.paypal.me','paypal.com','www.paypal.com'].includes(u.hostname)){
   if(amountEur&&Number(amountEur)>0){
    const cleanAmt=Number.isInteger(Number(amountEur))?String(Number(amountEur)):Number(amountEur).toFixed(2);
    if((u.hostname.includes('paypal.me')&&u.pathname.split('/').filter(Boolean).length===1)||(u.pathname.startsWith('/paypalme/')&&u.pathname.split('/').filter(Boolean).length===2)){
     return `${u.origin}${u.pathname.replace(/\/$/,'')}/${cleanAmt}`;
    }
    if(u.pathname==='/cgi-bin/webscr'&&u.searchParams.get('business')){
     u.searchParams.set('amount',Number(amountEur).toFixed(2));
     if(itemName)u.searchParams.set('item_name',String(itemName).slice(0,120));
     return u.href;
    }
   }
  }
 }catch{}
 return val;
}

export const proPaymentUrl=z.preprocess(v=>typeof v==='string'?normalizeRevolutInput(v):v,z.string().max(2048).url().refine(value=>{
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&u.pathname!=='/'&&['checkout.revolut.com','pay.revolut.com','revolut.me'].includes(u.hostname);
 }catch{return false;}
},'Použi platobný odkaz alebo @meno z Revolut (revolut.me alebo pay.revolut.com).').transform(value=>new URL(value).href));

export const paypalPaymentUrl=z.preprocess(v=>typeof v==='string'?normalizePaypalInput(v):v,z.string().max(2048).url().refine(value=>{
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&u.pathname!=='/'&&['paypal.com','www.paypal.com','paypal.me','www.paypal.me'].includes(u.hostname);
 }catch{return false;}
},'Zadaj svoj PayPal e-mail, PayPal.me meno (@meno) alebo PayPal HTTPS odkaz.').transform(value=>new URL(value).href));

export const proProductSchema=z.object({
 id:productId,
 name:z.string().trim().min(1).max(120),
 description:z.string().trim().max(1000).default(''),
 amount_cents:z.number().int().min(100).max(1000000),
 currency:z.literal('EUR'),
 payment_url:proPaymentUrl,
 active:z.boolean().default(true),
 expires_at:z.string().datetime({offset:true}).nullable().default(null)
}).strict();

export const paypalProductSchema=z.object({
 id:productId,
 name:z.string().trim().min(1).max(120),
 description:z.string().trim().max(1000).default(''),
 amount_cents:z.number().int().min(100).max(1000000),
 currency:z.literal('EUR'),
 payment_url:paypalPaymentUrl,
 active:z.boolean().default(true),
 expires_at:z.string().datetime({offset:true}).nullable().default(null)
}).strict();

export const proCatalogSchema=z.object({products:z.array(proProductSchema).max(20)}).strict().superRefine((data,ctx)=>{
 if(new Set(data.products.map(p=>p.id)).size!==data.products.length)ctx.addIssue({code:'custom',path:['products'],message:'ID produktov sa nesmú opakovať.'});
});

export const paypalCatalogSchema=z.object({products:z.array(paypalProductSchema).max(20)}).strict().superRefine((data,ctx)=>{
 if(new Set(data.products.map(p=>p.id)).size!==data.products.length)ctx.addIssue({code:'custom',path:['products'],message:'ID produktov sa nesmú opakovať.'});
});

export const commerceAccountsSchema=z.object({
 business_name:z.string().trim().max(120).default(''),
 account_type:z.enum(['personal','business']).optional().default('personal'),
 paypal_identifier:z.string().trim().max(240).optional().default(''),
 revolut_url:z.union([proPaymentUrl,z.literal('')]).default(''),
 paypal_url:z.union([paypalPaymentUrl,z.literal('')]).default(''),
 default_currency:z.literal('EUR').default('EUR'),
 note:z.string().trim().max(500).default(''),
 auto_generate_offers:z.boolean().optional()
}).strict();

const DEFAULT_PAYPAL_PACKAGES=[
 {id:'web-na-kluc',name:'Tvorba moderného webu na kľúč (AI Studio + Cloudflare)',description:'Kompletný responzívny web na mieru, nasadenie na Cloudflare a základné SEO.',amount_cents:49000},
 {id:'domena-rezervacia',name:'Prenájom alebo rezervácia prémiovej domény',description:'Mesačný prenájom alebo rezervácia domény vrátane kompletného nastavenia DNS.',amount_cents:4900},
 {id:'ai-automatizacia',name:'AI automatizácia a integrácia na mieru',description:'Návrh, implementácia a nasadenie AI asistenta alebo automatizovaného workflowu.',amount_cents:79000},
 {id:'web-audit-seo',name:'Rýchlostný, bezpečnostný a SEO audit webu',description:'Hĺbková kontrola webu, PDF report s dôkazmi a návrh okamžitých zlepšení.',amount_cents:19000}
];

function escapeHtml(s){
 return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderCheckoutPageHtml(product,accounts){
 const eur=(Number(product.amount_cents||0)/100).toFixed(2);
 const seller=accounts?.business_name||'Trinity PayPal Checkout';
 const isPersonal=(accounts?.account_type||'personal')==='personal';
 const note=accounts?.note||'Bezpečná okamžitá platba cez PayPal v EUR (účet alebo platobná karta).';
 return `<!doctype html><html lang="sk"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(product.name)} · ${eur} € | PayPal Platba</title>
<style>
  :root{color-scheme:dark;--bg:#070d19;--card:#0f172a;--line:rgba(148,163,184,0.18);--ink:#f8fafc;--muted:#94a3b8;--pp-blue:#0070ba;--pp-gold:#ffc439}
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:radial-gradient(circle at top,#0f2447 0%,var(--bg) 65%);color:var(--ink)}
  .checkout-card{width:100%;max-width:480px;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:28px;box-shadow:0 24px 60px rgba(0,0,0,0.55);display:grid;gap:18px}
  .badge-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
  .pill{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 10px;border-radius:999px;background:rgba(0,112,186,0.2);color:#38bdf8;border:1px solid rgba(56,189,248,0.3)}
  .seller{font-size:13px;color:var(--muted)}
  h1{margin:0;font-size:21px;line-height:1.3}
  .desc{margin:0;font-size:14px;color:var(--muted);line-height:1.55}
  .price-box{padding:18px;border-radius:16px;background:rgba(15,23,42,0.75);border:1px solid var(--line);display:flex;align-items:baseline;justify-content:space-between}
  .price-box span{font-size:13px;color:var(--muted)}
  .price-box strong{font-size:32px;font-variant-numeric:tabular-nums;color:#fff}
  .pp-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:15px 20px;border-radius:999px;background:var(--pp-gold);color:#003087;font-weight:800;font-size:16px;text-decoration:none;box-shadow:0 8px 24px rgba(255,196,57,0.28);transition:transform .12s ease}
  .pp-btn:hover{transform:translateY(-1px)}
  .pp-direct{display:flex;align-items:center;justify-content:center;width:100%;padding:12px 18px;border-radius:999px;background:rgba(56,189,248,0.12);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);font-weight:600;font-size:13.5px;text-decoration:none}
  .meta{font-size:12px;color:var(--muted);text-align:center;line-height:1.5;border-top:1px solid var(--line);padding-top:14px}
</style></head><body>
<main class="checkout-card">
  <div class="badge-row">
    <span class="pill">💳 ${product.provider==='paypal'?'PayPal Checkout':'Revolut Checkout'}</span>
    <span class="seller">${escapeHtml(seller)} (${isPersonal?'Osobný účet':'Obchodný účet'})</span>
  </div>
  <h1>${escapeHtml(product.name)}</h1>
  ${product.description?`<p class="desc">${escapeHtml(product.description)}</p>`:''}
  <div class="price-box"><span>Suma na úhradu</span><strong>${eur} €</strong></div>
  <a class="pp-btn" href="${escapeHtml(product.payment_url)}" rel="noopener noreferrer">💙 Zaplatiť ${eur} € cez PayPal</a>
  <a class="pp-direct" href="${escapeHtml(product.payment_url)}" rel="noopener noreferrer">Otvoriť priamy platobný odkaz ↗</a>
  <div class="meta">${escapeHtml(note)}<br>ID ponuky: <code>${escapeHtml(product.id)}</code></div>
</main></body></html>`;
}

async function catalog(env){
 const stored=env.Mastermind?await env.Mastermind.get(CONFIG_KEY):null;
 const raw=stored??env.REVOLUT_PRO_PRODUCTS_JSON??JSON.stringify(bundledCatalog);
 try{return proCatalogSchema.parse(JSON.parse(raw));}catch{throw new HttpError(503,'Neplatná konfigurácia Revolut Pro produktov.');}
}

async function paypalCatalog(env){
 const stored=env.Mastermind?await env.Mastermind.get(PAYPAL_CONFIG_KEY):null;
 const raw=stored??env.PAYPAL_PRODUCTS_JSON??JSON.stringify({products:[]});
 try{return paypalCatalogSchema.parse(JSON.parse(raw));}catch{throw new HttpError(503,'Neplatná konfigurácia PayPal produktov.');}
}

async function commerceAccounts(env){
 const stored=env.Mastermind?await env.Mastermind.get(COMMERCE_ACCOUNTS_KEY):null;
 if(!stored){
  if(env.TRINITY_OWNER_EMAIL||env.TRINITY_ENV){
   return commerceAccountsSchema.parse({
    business_name:'Ivan Sabo · Basterix',
    account_type:'personal',
    paypal_identifier:'saboivan2008@gmail.com',
    paypal_url:'saboivan2008@gmail.com',
    revolut_url:'https://revolut.me/isabo91',
    default_currency:'EUR',
    note:'Oficiálna platobná brána vlastníka systému Basterix (Ivan Sabo · RevTag: isabo91 · PayPal: saboivan2008@gmail.com).'
   });
  }
  return commerceAccountsSchema.parse({});
 }
 try{return commerceAccountsSchema.parse(JSON.parse(stored));}catch{return commerceAccountsSchema.parse({});}
}

function available(product){return product.active&&(!product.expires_at||Date.parse(product.expires_at)>Date.now());}
function publicProduct(product,provider='revolut-pro'){
 const prefix=provider==='paypal'?'/pay/paypal/':'/pay/revolut-pro/';
 return {id:product.id,provider,name:product.name,description:product.description,amount_cents:product.amount_cents,currency:product.currency,checkout_path:prefix+product.id};
}

export async function revolutProStatus(env){
 const data=await catalog(env);
 return {provider:'revolut-pro',mode:'live-payment-links',configured:data.products.some(available),bank_account_connected:false,automatic_payment_verification:false,payment_status:'not_checked',products:data.products};
}

export async function configureRevolutPro(env,ownerId,input){
 const data=proCatalogSchema.parse(input);
 if(!env.Mastermind)throw new HttpError(503,'Úložisko konfigurácie Revolut Pro nie je pripojené.');
 // Saving public checkout links does not grant account access or payment authority.
 await env.Mastermind.put(CONFIG_KEY,JSON.stringify(data),{metadata:{owner_id:ownerId,updated_at:new Date().toISOString()}});
 return {...await revolutProStatus(env),saved:true};
}

export async function paypalStatus(env){
 const data=await paypalCatalog(env);
 return {provider:'paypal',mode:'live-payment-links',configured:data.products.some(available),bank_account_connected:false,automatic_payment_verification:false,payment_status:'not_checked',products:data.products};
}

export async function configurePaypal(env,ownerId,input){
 const data=paypalCatalogSchema.parse(input);
 if(!env.Mastermind)throw new HttpError(503,'Úložisko konfigurácie PayPal nie je pripojené.');
 await env.Mastermind.put(PAYPAL_CONFIG_KEY,JSON.stringify(data),{metadata:{owner_id:ownerId,updated_at:new Date().toISOString()}});
 return {...await paypalStatus(env),saved:true};
}

export async function commerceStatus(env){
 const [revolut,paypal,accounts]=await Promise.all([revolutProStatus(env),paypalStatus(env),commerceAccounts(env)]);
 const activeRevolut=revolut.products.filter(available);
 const activePaypal=paypal.products.filter(available);
 const allProducts=[...paypal.products.map(p=>({...p,provider:'paypal',checkout_path:'/pay/paypal/'+p.id,hosted_checkout_path:'/pay/checkout/'+p.id})),...revolut.products.map(p=>({...p,provider:'revolut-pro',checkout_path:'/pay/revolut-pro/'+p.id,hosted_checkout_path:'/pay/checkout/'+p.id}))];
 const activeProducts=[...activeRevolut,...activePaypal];
 const totalCatalogCents=activeProducts.reduce((sum,p)=>sum+(Number(p.amount_cents)||0),0);
 const providersReady=[];
 if(revolut.configured||accounts.revolut_url)providersReady.push('revolut-pro');
 if(paypal.configured||accounts.paypal_url)providersReady.push('paypal');
 return {
  mode:'live-payment-links',
  configured:providersReady.length>0,
  bank_account_connected:false,
  automatic_payment_verification:false,
  payment_status:'not_checked',
  accounts,
  revolut,
  paypal,
  products:allProducts,
  summary:{
   total_products:allProducts.length,
   active_products:activeProducts.length,
   total_catalog_cents:totalCatalogCents,
   total_catalog_eur:Number((totalCatalogCents/100).toFixed(2)),
   providers_ready:providersReady
  }
 };
}

export async function configureCommerceAccounts(env,ownerId,input){
 const raw={...(input||{})};
 if(raw.paypal_identifier&&!raw.paypal_url)raw.paypal_url=raw.paypal_identifier;
 if(!raw.paypal_identifier&&raw.paypal_url)raw.paypal_identifier=String(raw.paypal_url).trim();
 const autoGen=Boolean(raw.auto_generate_offers);
 const data=commerceAccountsSchema.parse(raw);
 if(!env.Mastermind)throw new HttpError(503,'Úložisko obchodného profilu nie je pripojené.');
 const toStore={...data};
 delete toStore.auto_generate_offers;
 await env.Mastermind.put(COMMERCE_ACCOUNTS_KEY,JSON.stringify(toStore),{metadata:{owner_id:ownerId,updated_at:new Date().toISOString()}});
 if(autoGen&&(data.paypal_identifier||data.paypal_url)){
  const basePaypal=data.paypal_identifier||data.paypal_url;
  const current=await paypalCatalog(env);
  const existingMap=new Map(current.products.map(p=>[p.id,p]));
  for(const pkg of DEFAULT_PAYPAL_PACKAGES){
   const eur=pkg.amount_cents/100;
   const autoUrl=normalizePaypalInput(basePaypal,eur,pkg.name);
   const validated=paypalProductSchema.parse({
    id:pkg.id,
    name:pkg.name,
    description:pkg.description,
    amount_cents:pkg.amount_cents,
    currency:'EUR',
    payment_url:autoUrl,
    active:true,
    expires_at:null
   });
   existingMap.set(pkg.id,validated);
  }
  await configurePaypal(env,ownerId,{products:Array.from(existingMap.values()).slice(0,20)});
 }
 if(autoGen&&data.revolut_url){
  const currentRev=await catalog(env);
  const existingRevMap=new Map(currentRev.products.map(p=>[p.id,p]));
  for(const pkg of DEFAULT_PAYPAL_PACKAGES){
   const autoUrl=normalizeRevolutInput(data.revolut_url);
   const validated=proProductSchema.parse({
    id:pkg.id,
    name:pkg.name,
    description:pkg.description,
    amount_cents:pkg.amount_cents,
    currency:'EUR',
    payment_url:autoUrl,
    active:true,
    expires_at:null
   });
   existingRevMap.set(pkg.id,validated);
  }
  await configureRevolutPro(env,ownerId,{products:Array.from(existingRevMap.values()).slice(0,20)});
 }
 return {...await commerceStatus(env),saved:true};
}

export async function upsertCommerceProduct(env,ownerId,input){
 const provider=input?.provider==='paypal'?'paypal':'revolut-pro';
 const rawProduct={...(input?.product||input||{})};
 const accounts=await commerceAccounts(env);
 const amountEur=Number(rawProduct.amount_cents||0)/100;
 if(provider==='paypal'){
  const baseSource=String(rawProduct.payment_url||'').trim()||accounts.paypal_identifier||accounts.paypal_url;
  if(baseSource){
   rawProduct.payment_url=normalizePaypalInput(baseSource,amountEur,rawProduct.name||'');
  }
 }else if(!String(rawProduct.payment_url||'').trim()&&accounts.revolut_url){
  rawProduct.payment_url=normalizeRevolutInput(accounts.revolut_url);
 }
 const parsed=provider==='paypal'?paypalProductSchema.parse(rawProduct):proProductSchema.parse(rawProduct);
 const current=provider==='paypal'?await paypalCatalog(env):await catalog(env);
 const nextProducts=current.products.filter(p=>p.id!==parsed.id);
 nextProducts.push(parsed);
 if(provider==='paypal'){
  await configurePaypal(env,ownerId,{products:nextProducts});
 }else{
  await configureRevolutPro(env,ownerId,{products:nextProducts});
 }
 return {...await commerceStatus(env),saved:true,provider,updated_product_id:parsed.id};
}

export async function deleteCommerceProduct(env,ownerId,provider,id){
 const normProvider=provider==='paypal'?'paypal':'revolut-pro';
 const validId=productId.parse(String(id||'').trim());
 const current=normProvider==='paypal'?await paypalCatalog(env):await catalog(env);
 const nextProducts=current.products.filter(p=>p.id!==validId);
 if(normProvider==='paypal'){
  await configurePaypal(env,ownerId,{products:nextProducts});
 }else{
  await configureRevolutPro(env,ownerId,{products:nextProducts});
 }
 return {...await commerceStatus(env),deleted:true,provider:normProvider,deleted_product_id:validId};
}

export async function handleRevolutProPublic(request,env){
 const url=new URL(request.url),path=url.pathname;
 const checkout=path.match(/^\/pay\/revolut-pro\/([a-z0-9][a-z0-9_-]{0,79})$/);
 const listing=path==='/api/payments/revolut-pro';
 if(!checkout&&!listing)return null;
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
 const data=await catalog(env);
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'};
 if(listing)return Response.json({provider:'revolut-pro',mode:'live-payment-links',products:data.products.filter(available).map(p=>publicProduct(p,'revolut-pro')),payment_status:'not_checked',automatic_payment_verification:false},{headers});
 const product=data.products.find(p=>p.id===checkout[1]&&available(p));
 if(!product)throw new HttpError(404,'Platobný odkaz nie je dostupný.');
 // The destination is owner-configured and validated; a URL query cannot replace it.
 return new Response(null,{status:302,headers:{...headers,Location:product.payment_url}});
}

export async function handlePaypalPublic(request,env){
 const url=new URL(request.url),path=url.pathname;
 const checkout=path.match(/^\/pay\/paypal\/([a-z0-9][a-z0-9_-]{0,79})$/);
 const hostedCheckout=path.match(/^\/pay\/checkout\/([a-z0-9][a-z0-9_-]{0,79})$/);
 const listing=path==='/api/payments/paypal';
 if(!checkout&&!hostedCheckout&&!listing)return null;
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
 const data=await paypalCatalog(env);
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'};
 if(listing)return Response.json({provider:'paypal',mode:'live-payment-links',products:data.products.filter(available).map(p=>publicProduct(p,'paypal')),payment_status:'not_checked',automatic_payment_verification:false},{headers});
 const targetId=(checkout||hostedCheckout)[1];
 let product=data.products.find(p=>p.id===targetId&&available(p));
 if(!product&&hostedCheckout){
  const revData=await catalog(env);
  product=revData.products.find(p=>p.id===targetId&&available(p));
  if(product)product={...product,provider:'revolut-pro'};
 }else if(product){
  product={...product,provider:'paypal'};
 }
 if(!product)throw new HttpError(404,'Platobný odkaz PayPal nie je dostupný.');
 if(hostedCheckout||url.searchParams.get('page')==='1'){
  const accounts=await commerceAccounts(env);
  return new Response(renderCheckoutPageHtml(product,accounts),{
   status:200,
   headers:{...headers,'Content-Type':'text/html; charset=utf-8'}
  });
 }
 return new Response(null,{status:302,headers:{...headers,Location:product.payment_url}});
}

export async function handleCommercePublic(request,env){
 const rev=await handleRevolutProPublic(request,env);
 if(rev)return rev;
 const pp=await handlePaypalPublic(request,env);
 if(pp)return pp;
 const url=new URL(request.url),path=url.pathname;
 if(path!=='/api/payments/catalog')return null;
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
 const [revData,ppData,accounts]=await Promise.all([catalog(env),paypalCatalog(env),commerceAccounts(env)]);
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'};
 const products=[
  ...revData.products.filter(available).map(p=>publicProduct(p,'revolut-pro')),
  ...ppData.products.filter(available).map(p=>publicProduct(p,'paypal'))
 ];
 return Response.json({
  mode:'live-payment-links',
  bank_account_connected:false,
  automatic_payment_verification:false,
  payment_status:'not_checked',
  business_name:accounts.business_name||'',
  providers:{
   revolut_pro:revData.products.some(available)||Boolean(accounts.revolut_url),
   paypal:ppData.products.some(available)||Boolean(accounts.paypal_url)
  },
  products
 },{headers});
}
