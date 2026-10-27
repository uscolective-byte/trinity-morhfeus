/**
 * Opt-in, read-only WordPress REST connector foundation.
 *
 * WPWriter's ChatGPT plugin session is NOT a Trinity API credential.
 * No admin login, installation, writing, publishing or plugin execution happens here.
 */
export class WordPressConnectorError extends Error {
  constructor(code, message) { super(message); this.name='WordPressConnectorError'; this.code=code; }
}

export const WORDPRESS_CAPABILITY = Object.freeze({
  id: 'wordpress-rest',
  label: 'WordPress (verejné REST dáta)',
  mode: 'read_only',
  status: 'requires_site_configuration',
  tools: ['wordpress_site_info', 'wordpress_list_public_posts'],
  mutations_supported: false,
  wpwriter_session_shared: false
});

function approvedOrigins(env) {
  return String(env?.TRINITY_WORDPRESS_ALLOWED_SITES || '')
    .split(',').map(s=>s.trim()).filter(Boolean)
    .map(s => validateSiteUrl(s).origin);
}

export function validateSiteUrl(input) {
  if(typeof input !== 'string' || input.includes('%')) throw new WordPressConnectorError('invalid_url','Kódované alebo neplatné URL nie sú povolené.');
  let url;
  try { url = new URL(input); }
  catch { throw new WordPressConnectorError('invalid_url','Neplatná URL WordPress stránky.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search ||
      url.hash || url.port || url.hostname.endsWith('.') ||
      !/^[a-z0-9.-]+$/i.test(url.hostname)) {
    throw new WordPressConnectorError('invalid_url','Povolená je iba čistá HTTPS adresa bez prihlasovacích údajov, portu a parametrov.');
  }
  if (url.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) ||
      url.hostname === '[::1]' || !url.hostname.includes('.')) {
    throw new WordPressConnectorError('invalid_url','Lokálne adresy a IP adresy nie sú povolené.');
  }
  if (url.pathname.includes('%') || url.pathname.includes('..') ||
      !/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(url.pathname.endsWith('/')?url.pathname:url.pathname+'/')) {
    throw new WordPressConnectorError('invalid_url','Neplatná cesta WordPress inštalácie.');
  }
  const basePath=url.pathname.endsWith('/')?url.pathname:url.pathname+'/';
  return {origin:url.origin, baseUrl:url.origin+basePath};
}

function configuredSite(env,input) {
  const site=validateSiteUrl(input);
  const allowed=approvedOrigins(env);
  if (!allowed.length) throw new WordPressConnectorError('not_configured','Nie je nastavený zoznam TRINITY_WORDPRESS_ALLOWED_SITES.');
  if (!allowed.includes(site.origin)) throw new WordPressConnectorError('not_allowed','WordPress stránka nie je v povolenom zozname.');
  return site;
}

async function readBoundedJson(response) {
  const limit=65536;
  const reader=response.body?.getReader();
  if (!reader) throw new WordPressConnectorError('invalid_response','Odpoveď WordPressu je prázdna.');
  let bytes=0;const parts=[];
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done) break;
      bytes+=value.byteLength;
      if(bytes>limit) throw new WordPressConnectorError('response_too_large','WordPress odpoveď prekročila povolenú veľkosť.');
      parts.push(value);
    }
  } finally { await reader.cancel().catch(()=>{}); }
  const all=new Uint8Array(bytes);let offset=0;
  for(const part of parts){all.set(part,offset);offset+=part.byteLength;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));}
  catch {throw new WordPressConnectorError('invalid_response','WordPress nevrátil platný JSON.');}
}

async function requestPublicJson(site,pathname,fetcher) {
  const url=new URL(pathname,site.baseUrl);
  // The request path is fixed by the connector, never supplied as a user URL.
  let response;
  try {
    response=await fetcher(url.toString(),{
      method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),
      headers:{Accept:'application/json','User-Agent':'Trinity-WordPress-ReadOnly/1.0'}
    });
  } catch {
    throw new WordPressConnectorError('network_error','WordPress nie je dostupný alebo odmietol spojenie.');
  }
  if (!response.ok) {
    await response.body?.cancel().catch(()=>{});
    throw new WordPressConnectorError('http_error',`WordPress REST vrátil HTTP ${response.status}.`);
  }
  return readBoundedJson(response);
}

export function wordpressConnectionStatus(env) {
  const configured=String(env?.TRINITY_WORDPRESS_ALLOWED_SITES||'').trim().length>0;
  return {
    ...WORDPRESS_CAPABILITY,
    status:configured?'configured_unverified':'needs_configuration',
    configured,
    live_verified:false,
    note:'WPWriter v ChatGPT neudeľuje Trinity oprávnenia. Verejné čítanie nevyžaduje WordPress heslo.'
  };
}

export async function wordpressSiteInfo(env,siteUrl,fetcher=fetch) {
  const site=configuredSite(env,siteUrl);
  const data=await requestPublicJson(site,'wp-json/',fetcher);
  return {
    status:'completed',site:site.baseUrl,
    title:typeof data.name==='string'?data.name.slice(0,200):'',
    description:typeof data.description==='string'?data.description.slice(0,500):'',
    api_name:typeof data.namespaces?.[0]==='string'?data.namespaces[0]:null,
    source:'live_wordpress_rest',public_data_only:true
  };
}

export async function wordpressListPublicPosts(env,siteUrl,{limit=5}={},fetcher=fetch) {
  const site=configuredSite(env,siteUrl);
  if (!Number.isInteger(limit)||limit<1||limit>20)
    throw new WordPressConnectorError('invalid_limit','Počet článkov musí byť 1 až 20.');
  const data=await requestPublicJson(site,`wp-json/wp/v2/posts?per_page=${limit}&_fields=id,date,link,slug,status,title`,fetcher);
  if (!Array.isArray(data)) throw new WordPressConnectorError('invalid_response','WordPress nevrátil zoznam článkov.');
  return {
    status:'completed',site:site.baseUrl,source:'live_wordpress_rest',public_data_only:true,
    posts:data.slice(0,limit).filter(p=>p&&p.status==='publish').map(p=>({
      id:p.id,slug:p.slug,link:p.link,date:p.date,
      title:typeof p.title?.rendered==='string'?p.title.rendered.slice(0,300):''
    }))
  };
}
