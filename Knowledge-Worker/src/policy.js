export const catalog = Object.freeze({
  'cloudflare-workers': 'https://developers.cloudflare.com/workers/',
  'cloudflare-workflows': 'https://developers.cloudflare.com/workflows/',
  'cloudflare-agents': 'https://developers.cloudflare.com/agents/'
});
export function document(input) {
  if (!input || typeof input.source_id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(input.source_id)) throw new Error('Invalid source_id');
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200) throw new Error('Invalid title');
  if (typeof input.text !== 'string' || !input.text.trim() || new TextEncoder().encode(input.text).length > 100000) throw new Error('Text must contain 1–100000 bytes');
  return {source_id:input.source_id,title:input.title.trim(),text:input.text.trim()};
}
export function terms(query) {
  if (typeof query !== 'string' || query.length > 300) throw new Error('Invalid query');
  return [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) || [])].slice(0,8);
}
export function htmlText(html) {
  return html.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
    .replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
}
export async function download(sourceId, fetcher = fetch) {
  const url = catalog[sourceId];
  if (!Object.hasOwn(catalog,sourceId)) throw new Error('Unknown catalog source');
  const response = await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'text/html,text/plain'}});
  if (!response.ok) throw new Error('Source request failed');
  const type = response.headers.get('content-type') || '';
  if (!/^(text\/html|text\/plain)(;|$)/i.test(type)) throw new Error('Unsupported source format');
  const reader=response.body?.getReader(); if(!reader)throw new Error('Empty source');
  let size=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>256000){await reader.cancel();throw new Error('Source exceeds 256000 bytes');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const raw=new TextDecoder().decode(bytes);
  const text=/^text\/html/i.test(type)?htmlText(raw):raw.trim();
  return {...document({source_id:sourceId,title:sourceId,text}),url};
}
