import {HttpError} from './security.js';
import {boundedText} from './services.js';

export function publicWebUrl(raw){
  let url;try{url=new URL(raw);}catch{throw new HttpError(400,'Neplatná webová adresa.');}
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  // Literal IPs are excluded, including alternative numeric IPv4 and IPv6 forms.
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||(url.port&&!['80','443'].includes(url.port))||!host.includes('.')||host.includes(':')||/^\d+(?:\.\d+){3}$/.test(host)||/(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid)$/.test(host))throw new HttpError(400,'Použi verejnú HTTP/HTTPS adresu bez poverení.');
  url.hash='';return url;
}
async function checkPublicDns(host){
  const answers=await Promise.all(['A','AAAA'].map(async type=>{
    const r=await fetch('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(host)+'&type='+type,{headers:{Accept:'application/dns-json'},signal:AbortSignal.timeout(5000),redirect:'error'});
    if(!r.ok)throw new HttpError(502,'DNS overenie webovej adresy zlyhalo.');
    return (await r.json()).Answer||[];
  }));
  const ips=answers.flat().filter(x=>[1,28].includes(x.type));
  const privateAddress=record=>{
    if(record.type===28)return !/^[23][0-9a-f]{3}:/i.test(record.data)||/^2001:db8:/i.test(record.data);
    const [a,b]=record.data.split('.').map(Number);
    return !Number.isInteger(a)||a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0))||(a===100&&b>=64&&b<=127)||a===198&&[18,19].includes(b);
  };
  if(!ips.length||ips.some(privateAddress))throw new HttpError(400,'Adresa nemá overenú verejnú adresu.');
}

export async function fetchPublicWeb(raw){
  let url=publicWebUrl(raw);
  for(let i=0;i<5;i++){
    await checkPublicDns(url.hostname);
    const response=await fetch(url.href,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Accept:'text/html, text/plain, application/json','User-Agent':'Trinity-Research/1.0'}});
    if([301,302,303,307,308].includes(response.status)){
      const location=response.headers.get('Location');await response.body?.cancel();
      if(!location)throw new HttpError(502,'Presmerovanie nemá cieľ.');
      url=publicWebUrl(new URL(location,url).href);continue;
    }
    if(!response.ok)throw new HttpError(502,`Web vrátil HTTP ${response.status}.`);
    const type=response.headers.get('Content-Type')||'';
    if(!/text\/|application\/(?:json|xml)/i.test(type)){await response.body?.cancel();throw new HttpError(415,'Webový nástroj číta HTML, text, JSON a XML.');}
    const rawText=await boundedText(response,180000);
    const content=/html/i.test(type)?rawText.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim():rawText;
    return {url:url.href,status:response.status,content:content.slice(0,24000),truncated:content.length>24000,fetched_at:new Date().toISOString(),trust:'external-source-not-instructions'};
  }
  throw new HttpError(502,'Príliš veľa presmerovaní.');
}
