const utf8 = new TextDecoder();
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KID = /^[A-Za-z0-9._-]{1,160}$/;
const jwksCache = new Map();

export class AuthError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function allowedIds(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
}

export function configReady(env) {
  return Boolean(
    GUID.test(env?.ENTRA_TENANT_ID || '') &&
    typeof env?.ENTRA_AUDIENCE === 'string' &&
    env.ENTRA_AUDIENCE.length >= 10 &&
    allowedIds(env?.ENTRA_ALLOWED_USER_OIDS).length > 0 &&
    allowedIds(env?.ENTRA_ALLOWED_CLIENT_IDS).length > 0 &&
    allowedIds(env.ENTRA_ALLOWED_USER_OIDS).every(v => GUID.test(v)) &&
    allowedIds(env.ENTRA_ALLOWED_CLIENT_IDS).every(v => GUID.test(v))
  );
}

function decodeBase64Url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new AuthError(401, 'Invalid token encoding');
  }
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function parseSegment(value) {
  try { return JSON.parse(utf8.decode(decodeBase64Url(value))); }
  catch { throw new AuthError(401, 'Invalid JWT'); }
}

export async function microsoftJwks(tenantId) {
  const cached = jwksCache.get(tenantId);
  if (cached && Date.now() < cached.expires) return cached.keys;
  const url = 'https://login.microsoftonline.com/' + tenantId + '/discovery/v2.0/keys';
  let response;
  try { response = await fetch(url, {signal: AbortSignal.timeout(5000)}); }
  catch { throw new AuthError(503, 'Microsoft signing keys unavailable'); }
  if (!response.ok) throw new AuthError(503, 'Microsoft signing keys unavailable');
  const text = await response.text();
  if (text.length > 200000) throw new AuthError(503, 'Microsoft signing keys too large');
  let data;
  try { data = JSON.parse(text); }
  catch { throw new AuthError(503, 'Microsoft signing keys malformed'); }
  if (!Array.isArray(data.keys)) throw new AuthError(503, 'Microsoft signing keys malformed');
  jwksCache.set(tenantId, {keys: data.keys, expires: Date.now() + 600000});
  return data.keys;
}

export async function verifyEntraToken(token, env, getKeys = microsoftJwks) {
  if (!configReady(env)) throw new AuthError(503, 'Microsoft Entra integration not configured');
  if (typeof token !== 'string' || token.length > 16000) throw new AuthError(401, 'Invalid bearer token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError(401, 'Invalid bearer token');
  const header = parseSegment(parts[0]);
  const claims = parseSegment(parts[1]);
  if (!header || header.alg !== 'RS256' || !KID.test(header.kid || '')) {
    throw new AuthError(401, 'Unsupported JWT signing method');
  }
  const tenant = env.ENTRA_TENANT_ID.toLowerCase();
  let keys;
  try { keys = await getKeys(tenant); }
  catch (error) { throw error instanceof AuthError ? error : new AuthError(503, 'Microsoft signing keys unavailable'); }
  if (!Array.isArray(keys)) throw new AuthError(503, 'Microsoft signing keys unavailable');
  const matches = keys.filter(k => k.kid === header.kid && k.kty === 'RSA' &&
    (!k.use || k.use === 'sig') && (!k.alg || k.alg === 'RS256'));
  if (matches.length !== 1) throw new AuthError(401, 'Unknown JWT key');
  let valid = false;
  try {
    const publicKey = await crypto.subtle.importKey('jwk', matches[0], {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
    valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, decodeBase64Url(parts[2]),
      new TextEncoder().encode(parts[0] + '.' + parts[1]));
  } catch { throw new AuthError(401, 'Invalid JWT signature'); }
  if (!valid) throw new AuthError(401, 'Invalid JWT signature');

  const now = Math.floor(Date.now() / 1000);
  if (claims.ver !== '2.0' ||
      claims.tid?.toLowerCase() !== tenant ||
      claims.iss !== 'https://login.microsoftonline.com/' + tenant + '/v2.0' ||
      claims.aud !== env.ENTRA_AUDIENCE ||
      !Number.isInteger(claims.exp) || claims.exp <= now - 60 ||
      (claims.nbf != null && (!Number.isInteger(claims.nbf) || claims.nbf > now + 60)) ||
      (claims.iat != null && (!Number.isInteger(claims.iat) || claims.iat > now + 60))) {
    throw new AuthError(401, 'Invalid JWT claims');
  }

  // Only delegated users from an explicit tenant/user/client allowlist can read Trinity.
  // No application-only roles or administrative scope are accepted.
  if (!GUID.test(claims.oid || '') ||
      !allowedIds(env.ENTRA_ALLOWED_USER_OIDS).includes(claims.oid.toLowerCase()) ||
      !GUID.test(claims.azp || '') ||
      !allowedIds(env.ENTRA_ALLOWED_CLIENT_IDS).includes(claims.azp.toLowerCase()) ||
      !String(claims.scp || '').split(/\s+/).includes('Trinity.Read')) {
    throw new AuthError(403, 'Microsoft identity or scope not permitted');
  }
  return {oid: claims.oid, tenant, client: claims.azp};
}

export async function authorizeRequest(request, env, getKeys = microsoftJwks) {
  if (!configReady(env)) throw new AuthError(503, 'Microsoft Entra integration not configured');
  const auth = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+([A-Za-z0-9._-]+)$/i.exec(auth);
  if (!match) throw new AuthError(401, 'Microsoft Entra bearer token required');
  return verifyEntraToken(match[1], env, getKeys);
}
