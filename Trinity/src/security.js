import { timingSafeEqual } from 'node:crypto';
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export async function hash(value) {
  return Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex');
}
export async function equal(a, b) { return timingSafeEqual(Buffer.from(await hash(a)), Buffer.from(await hash(b))); }
export async function validKey(token, env) {
  token=typeof token==='string'?token.trim():token;
  if (!token || token.length > 2048) return false;
  for (const secret of [env.TRINITY_OPS_KEY, env.TRINITY_SESSION_SECRET]) {
    if (typeof secret === 'string' && secret.length >= 8 && await equal(token, secret)) return true;
  }
  return false;
}
export async function issueSession(env,until=Date.now()+43200000,email=null){
  const token=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const expires=Math.min(Date.now()+43200000,until);
  if(email)await env.DB.prepare('INSERT INTO ops_sessions(token_hash,expires_at,email) VALUES(?,?,?)').bind(await hash(token),expires,email.trim().toLowerCase()).run();
  else await env.DB.prepare('INSERT INTO ops_sessions(token_hash,expires_at) VALUES(?,?)').bind(await hash(token),expires).run();
  await env.DB.prepare('DELETE FROM ops_sessions WHERE expires_at < ?').bind(Date.now()).run();
  return Response.json({ok:true},{headers:{'Set-Cookie':`trinity_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(0,Math.floor((expires-Date.now())/1000))}`}});
}
export async function allowDevConnection(request,env){
  const ip=request.headers.get('CF-Connecting-IP');
  if(!ip||!env.TRINITY_DEV_IP||!env.TRINITY_DEV_UNTIL||Date.parse(env.TRINITY_DEV_UNTIL)<Date.now()||!Number.isFinite(Date.parse(env.TRINITY_DEV_UNTIL)))return false;
  return equal(ip,env.TRINITY_DEV_IP);
}
export async function authenticate(request, env) {
  const googleOnly=env.TRINITY_AUTH_MODE==='google';
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') || request.headers.get('X-Trinity-Token');
  if (!googleOnly&&await validKey(token, env)) return { id: (await hash(token)).slice(0, 24),email:env.TRINITY_OWNER_EMAIL||null,role:'owner',owner:true };
  const session = request.headers.get('Cookie')?.match(/(?:^|;\s*)trinity_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (session) {
    const digest = await hash(session);
    if(googleOnly){
      const row=await env.DB.prepare(`SELECT s.expires_at,s.email,u.role,u.status FROM ops_sessions s
        LEFT JOIN ops_users u ON lower(u.email)=lower(s.email) WHERE s.token_hash=?`).bind(digest).first();
      if(row&&row.expires_at>Date.now()&&row.email&&row.status==='active')return {id:digest.slice(0,24),email:row.email,role:row.role};
    }else{
      const row = await env.DB.prepare('SELECT expires_at,email FROM ops_sessions WHERE token_hash = ?').bind(digest).first();
      if (row && row.expires_at > Date.now()) {
        const owner=Boolean(row.email&&env.TRINITY_OWNER_EMAIL&&row.email.toLowerCase()===env.TRINITY_OWNER_EMAIL.toLowerCase());
        return { id: digest.slice(0, 24),email:row.email||null,role:owner?'owner':null,owner };
      }
    }
  }
  throw new HttpError(401, 'Prihlás sa do Trinity.');
}
export function checkOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, 'Cudzí pôvod požiadavky je zakázaný.');
}
export async function readJSON(request, limit = 24000) {
  if (!request.headers.get('Content-Type')?.includes('application/json')) throw new HttpError(415, 'Vyžaduje sa JSON.');
  if (Number(request.headers.get('Content-Length') || 0) > limit) throw new HttpError(413, 'Požiadavka je príliš veľká.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Chýba obsah požiadavky.');
  let size = 0, chunks = [];
  while (true) {
    const {value, done} = await reader.read(); if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new HttpError(413, 'Požiadavka je príliš veľká.'); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'Neplatný JSON.'); }
}
export async function rateLimit(env, key, maximum, seconds = 60) {
  const window = Math.floor(Date.now() / (seconds * 1000));
  const row = await env.DB.prepare(`INSERT INTO ops_limits(key, window, count) VALUES (?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET window=excluded.window,
    count=CASE WHEN ops_limits.window=excluded.window THEN ops_limits.count+1 ELSE 1 END RETURNING count`)
    .bind(key, window).first();
  if (row.count > maximum) throw new HttpError(429, 'Príliš veľa požiadaviek. Skús to neskôr.');
}
export function secure(response) {
  const out = new Response(response.body, response);
  out.headers.set('X-Content-Type-Options','nosniff');
  out.headers.set('Referrer-Policy','no-referrer');
  out.headers.set('X-Frame-Options','DENY');
  out.headers.set('Cache-Control','no-store');
  return out;
}
