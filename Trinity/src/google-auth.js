import {equal,hash,HttpError,issueSession} from './security.js';

let cachedJwks=null,cachedJwksUntil=0;
const textEncoder=new TextEncoder();
const base64UrlEncode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
function base64UrlDecode(value){const normalized=value.replace(/-/g,'+').replace(/_/g,'/');const binary=atob(normalized+'='.repeat((4-normalized.length%4)%4));return Uint8Array.from(binary,char=>char.charCodeAt(0));}
function randomToken(){return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));}
function adminEmails(env){return new Set((env.TRINITY_ADMIN_EMAILS||'').split(',').map(email=>email.trim().toLowerCase()).filter(Boolean));}
export function isGoogleAdminEmail(env,email){return adminEmails(env).has(String(email||'').trim().toLowerCase());}
export function googleOAuthConfigured(env){
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_REDIRECT_URI||adminEmails(env).size===0)return false;
  try{const url=new URL(env.GOOGLE_REDIRECT_URI);return url.protocol==='https:'||url.hostname==='localhost'||url.hostname==='127.0.0.1';}catch{return false;}
}
export const googleAuthRequired=env=>env.TRINITY_AUTH_MODE==='google';

async function signingKeys(force=false){
  if(!force&&cachedJwks&&cachedJwksUntil>Date.now())return cachedJwks;
  const response=await fetch('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new HttpError(502,'Google podpisovacie kľúče nie sú dostupné.');
  const data=await response.json();if(!Array.isArray(data.keys))throw new HttpError(502,'Google vrátil neplatný zoznam kľúčov.');
  cachedJwks=data.keys;cachedJwksUntil=Date.now()+Math.min(Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1]||3600),3600)*1000;return cachedJwks;
}

export async function verifyGoogleIdToken(token,{clientId,nonce},getKeys=signingKeys){
  if(typeof token!=='string'||token.length>16000)throw new HttpError(401,'Google prihlasovací token je neplatný.');
  const parts=token.split('.');if(parts.length!==3)throw new HttpError(401,'Google prihlasovací token je neplatný.');
  let header,claims;try{header=JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));claims=JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));}catch{throw new HttpError(401,'Google prihlasovací token je neplatný.');}
  if(header.alg!=='RS256'||typeof header.kid!=='string')throw new HttpError(401,'Google podpis tokenu nie je podporovaný.');
  let keys=await getKeys();let jwk=keys.find(key=>key.kid===header.kid&&key.kty==='RSA');
  if(!jwk){keys=await getKeys(true);jwk=keys.find(key=>key.kid===header.kid&&key.kty==='RSA');}
  if(!jwk)throw new HttpError(401,'Google podpisový kľúč nebol nájdený.');
  let valid=false;try{const publicKey=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);valid=await crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},publicKey,base64UrlDecode(parts[2]),textEncoder.encode(`${parts[0]}.${parts[1]}`));}catch{valid=false;}
  if(!valid)throw new HttpError(401,'Google token podpis nie je platný.');
  const now=Math.floor(Date.now()/1000),audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||!audiences.includes(clientId)||(audiences.length>1&&claims.azp!==clientId)||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+60||claims.nonce!==nonce||claims.email_verified!==true||typeof claims.email!=='string'||typeof claims.sub!=='string')throw new HttpError(401,'Google účet alebo overenie e-mailu nie je platné.');
  return {email:claims.email.trim().toLowerCase(),sub:claims.sub,name:typeof claims.name==='string'?claims.name.slice(0,160):claims.email};
}

function redirect(path,cookies=[]){const response=new Response(null,{status:303,headers:{Location:path,'Cache-Control':'no-store'}});for(const cookie of cookies)response.headers.append('Set-Cookie',cookie);return response;}
const clearStateCookie='trinity_google_state=; Path=/api/auth/google/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

export async function beginGoogleLogin(env){
  if(!googleOAuthConfigured(env))throw new HttpError(503,'Google OAuth ešte nie je nakonfigurované.');
  const state=randomToken(),nonce=randomToken(),verifier=randomToken(),challenge=base64UrlEncode(new Uint8Array(await crypto.subtle.digest('SHA-256',textEncoder.encode(verifier))));
  const now=Date.now();await env.DB.prepare('DELETE FROM ops_oauth_states WHERE expires_at<=?').bind(now).run();
  await env.DB.prepare('INSERT INTO ops_oauth_states(state_hash,nonce,code_verifier,expires_at) VALUES(?,?,?,?)').bind(await hash(state),nonce,verifier,now+10*60_000).run();
  const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [key,value] of Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:env.GOOGLE_REDIRECT_URI,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}))target.searchParams.set(key,value);
  return redirect(target.toString(),[`trinity_google_state=${state}; Path=/api/auth/google/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`]);
}

export async function finishGoogleLogin(request,env){
  if(!googleOAuthConfigured(env))throw new HttpError(503,'Google OAuth ešte nie je nakonfigurované.');
  const url=new URL(request.url),state=url.searchParams.get('state'),code=url.searchParams.get('code');
  if(url.searchParams.has('error')||!state||!code)throw new HttpError(401,'Prihlásenie cez Google bolo zrušené alebo je neplatné.');
  const cookieState=request.headers.get('Cookie')?.match(/(?:^|;\s*)trinity_google_state=([A-Za-z0-9_-]{40,})/)?.[1];
  if(!cookieState||!await equal(state,cookieState))throw new HttpError(401,'Google prihlasovacia relácia sa nezhoduje. Skús to znovu.');
  const transaction=await env.DB.prepare('DELETE FROM ops_oauth_states WHERE state_hash=? AND expires_at>? RETURNING nonce,code_verifier').bind(await hash(state),Date.now()).first();
  if(!transaction)throw new HttpError(401,'Google prihlasovacia relácia vypršala alebo už bola použitá.');
  const form=new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:env.GOOGLE_REDIRECT_URI,grant_type:'authorization_code',code_verifier:transaction.code_verifier});
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form,signal:AbortSignal.timeout(15000)});
  if(!tokenResponse.ok)throw new HttpError(401,'Google prihlasovací kód sa nepodarilo overiť.');
  const tokens=await tokenResponse.json();const identity=await verifyGoogleIdToken(tokens.id_token,{clientId:env.GOOGLE_CLIENT_ID,nonce:transaction.nonce});
  const isAdmin=isGoogleAdminEmail(env,identity.email),now=Date.now();
  await env.DB.prepare(`INSERT INTO ops_users(email,google_sub,display_name,role,status) VALUES(?,?,?,?,?)
    ON CONFLICT(email) DO UPDATE SET google_sub=excluded.google_sub,display_name=excluded.display_name,
    role=excluded.role,
    status=CASE WHEN excluded.role='admin' THEN 'active' ELSE ops_users.status END,updated_at=datetime('now')`)
    .bind(identity.email,identity.sub,identity.name,isAdmin?'admin':'user',isAdmin?'active':'pending').run();
  const user=await env.DB.prepare('SELECT role,status FROM ops_users WHERE email=?').bind(identity.email).first();
  if(!user||user.status!=='active')return redirect(user?.status==='pending'?'/?auth=pending':'/?auth=denied',[clearStateCookie]);
  const session=await issueSession(env,undefined,identity.email),sessionCookie=session.headers.get('Set-Cookie');
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('google_login',?)").bind(JSON.stringify({email:identity.email,role:user.role,at:now})).run();
  return redirect('/?auth=success',[clearStateCookie,sessionCookie]);
}
