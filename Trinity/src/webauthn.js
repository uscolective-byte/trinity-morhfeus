// src/webauthn.js: Passkey / Biometric WebAuthn Authentication & Credential Management

import { hash, HttpError, issueSession, isOwnerEmail } from './security.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function base64UrlEncode(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...arr))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function base64UrlDecode(str) {
  const normalized = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function randomChallenge() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function getRelyingPartyId(request) {
  try {
    const url = new URL(request.url);
    const host = url.hostname;
    // For localhost / 127.0.0.1 or domain names
    if (host === 'localhost' || host === '127.0.0.1') return 'localhost';
    // auru.space or auru.dev or subdomains
    if (host.endsWith('auru.space')) return 'auru.space';
    if (host.endsWith('auru.dev')) return 'auru.dev';
    return host;
  } catch {
    return 'auru.space';
  }
}

/**
 * 1. Generovanie registračných možností (WebAuthn create challenge)
 */
export async function generateRegistrationOptions(request, env, userEmail) {
  const email = String(userEmail || env.TRINITY_OWNER_EMAIL || 'admin@auru.space').trim().toLowerCase();
  const rpId = getRelyingPartyId(request);
  const challenge = randomChallenge();
  const challengeHash = await hash(challenge);
  const expiresAt = Date.now() + 5 * 60_000;

  // Cleanup & store challenge
  await env.DB.prepare('DELETE FROM ops_passkey_challenges WHERE expires_at <= ?').bind(Date.now()).run();
  await env.DB.prepare(
    'INSERT INTO ops_passkey_challenges(challenge_hash, user_email, type, expires_at) VALUES(?, ?, ?, ?)'
  ).bind(challengeHash, email, 'registration', expiresAt).run();

  // Existing credentials to exclude (prevent re-registering same key)
  const existing = (await env.DB.prepare(
    'SELECT credential_id, transports FROM user_passkeys WHERE user_email = ?'
  ).bind(email).all()).results || [];

  const excludeCredentials = existing.map((cred) => ({
    id: cred.credential_id,
    type: 'public-key',
    transports: cred.transports ? JSON.parse(cred.transports) : ['internal', 'hybrid']
  }));

  return {
    challenge,
    rp: {
      name: 'Trinity Operations Center',
      id: rpId
    },
    user: {
      id: base64UrlEncode(textEncoder.encode(email)),
      name: email,
      displayName: email.split('@')[0] || 'Trinity Administrator'
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },  // ES256
      { alg: -257, type: 'public-key' }, // RS256
      { alg: -8, type: 'public-key' }   // Ed25519
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // TouchID, Windows Hello, FaceID
      residentKey: 'preferred',
      requireResidentKey: false,
      userVerification: 'preferred'
    },
    timeout: 60000,
    attestation: 'none',
    excludeCredentials
  };
}

/**
 * 2. Overenie a uloženie nového Passkey (WebAuthn registration verification)
 */
export async function verifyRegistrationResponse(request, env, body, currentUserEmail = null) {
  if (!body || !body.id || !body.response) {
    throw new HttpError(400, 'Neplatný payload registrácie Passkey.');
  }

  const { id: credentialId, response, friendlyName, userEmail } = body;
  const email = String(currentUserEmail || userEmail || env.TRINITY_OWNER_EMAIL || 'admin@auru.space').trim().toLowerCase();

  // Parse clientDataJSON
  let clientData;
  try {
    const rawClientData = base64UrlDecode(response.clientDataJSON);
    clientData = JSON.parse(textDecoder.decode(rawClientData));
  } catch (err) {
    throw new HttpError(400, 'Neplatný clientDataJSON.');
  }

  if (clientData.type !== 'webauthn.create') {
    throw new HttpError(400, 'Nesprávny typ WebAuthn operácie.');
  }

  // Verify challenge
  const challengeHash = await hash(clientData.challenge);
  const challengeRow = await env.DB.prepare(
    'DELETE FROM ops_passkey_challenges WHERE challenge_hash = ? AND type = ? AND expires_at > ? RETURNING user_email'
  ).bind(challengeHash, 'registration', Date.now()).first();

  if (!challengeRow) {
    throw new HttpError(401, 'Registračná výzva (challenge) vypršala alebo je neplatná.');
  }

  const passkeyId = crypto.randomUUID();
  const publicKey = response.publicKey || response.attestationObject || credentialId;
  const transports = JSON.stringify(response.transports || ['internal', 'hybrid']);
  const name = friendlyName || 'TouchID / Windows Hello';

  // Save credential
  await env.DB.prepare(`
    INSERT INTO user_passkeys (id, user_email, credential_id, public_key, counter, friendly_name, transports, created_at, last_used_at)
    VALUES (?, ?, ?, ?, 0, ?, ?, datetime('now'), datetime('now'))
  `).bind(passkeyId, email, credentialId, String(publicKey).slice(0, 1000), name, transports).run();

  // Log audit
  await env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('passkey_registered', ?)").bind(
    JSON.stringify({
      id: passkeyId,
      email,
      credential_id: credentialId,
      friendly_name: name,
      rp_id: getRelyingPartyId(request),
      at: Date.now()
    })
  ).run();

  return {
    ok: true,
    message: 'Passkey bol úspešne zaregistrovaný pre biometrické prihlásenie.',
    passkey: {
      id: passkeyId,
      credential_id: credentialId,
      friendly_name: name,
      user_email: email
    }
  };
}

/**
 * 3. Generovanie autentifikačných možností (WebAuthn get challenge)
 */
export async function generateAuthenticationOptions(request, env, userEmail = null) {
  const rpId = getRelyingPartyId(request);
  const challenge = randomChallenge();
  const challengeHash = await hash(challenge);
  const expiresAt = Date.now() + 5 * 60_000;

  // Cleanup expired & insert
  await env.DB.prepare('DELETE FROM ops_passkey_challenges WHERE expires_at <= ?').bind(Date.now()).run();
  await env.DB.prepare(
    'INSERT INTO ops_passkey_challenges(challenge_hash, user_email, type, expires_at) VALUES(?, ?, ?, ?)'
  ).bind(challengeHash, userEmail || null, 'authentication', expiresAt).run();

  let allowCredentials = [];
  if (userEmail) {
    const email = String(userEmail).trim().toLowerCase();
    const rows = (await env.DB.prepare(
      'SELECT credential_id, transports FROM user_passkeys WHERE user_email = ?'
    ).bind(email).all()).results || [];

    allowCredentials = rows.map((r) => ({
      id: r.credential_id,
      type: 'public-key',
      transports: r.transports ? JSON.parse(r.transports) : ['internal', 'hybrid']
    }));
  }

  return {
    challenge,
    rpId,
    timeout: 60000,
    userVerification: 'preferred',
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined
  };
}

/**
 * 4. Overenie biometrického prihlásenia a vydanie Trinity relácie
 */
export async function verifyAuthenticationResponse(request, env, body) {
  if (!body || !body.id || !body.response) {
    throw new HttpError(400, 'Neplatný payload biometrického prihlásenia.');
  }

  const { id: credentialId, response } = body;

  // Parse clientDataJSON
  let clientData;
  try {
    const rawClientData = base64UrlDecode(response.clientDataJSON);
    clientData = JSON.parse(textDecoder.decode(rawClientData));
  } catch {
    throw new HttpError(400, 'Neplatný clientDataJSON.');
  }

  if (clientData.type !== 'webauthn.get') {
    throw new HttpError(400, 'Nesprávny typ WebAuthn operácie.');
  }

  // Verify challenge
  const challengeHash = await hash(clientData.challenge);
  const challengeRow = await env.DB.prepare(
    'DELETE FROM ops_passkey_challenges WHERE challenge_hash = ? AND type = ? AND expires_at > ? RETURNING user_email'
  ).bind(challengeHash, 'authentication', Date.now()).first();

  if (!challengeRow) {
    throw new HttpError(401, 'Autentifikačná výzva (challenge) vypršala alebo už bola použitá.');
  }

  // Find passkey in DB
  const passkey = await env.DB.prepare(
    'SELECT id, user_email, credential_id, counter, friendly_name FROM user_passkeys WHERE credential_id = ?'
  ).bind(credentialId).first();

  if (!passkey) {
    throw new HttpError(401, 'Biometrický kľúč (Passkey) nie je registrovaný v systéme.');
  }

  // Update counter and last_used_at
  const nextCounter = (passkey.counter || 0) + 1;
  await env.DB.prepare(
    "UPDATE user_passkeys SET counter = ?, last_used_at = datetime('now') WHERE id = ?"
  ).bind(nextCounter, passkey.id).run();

  // Ensure user in ops_users
  const user = await env.DB.prepare('SELECT role, status FROM ops_users WHERE email = ?').bind(passkey.user_email).first();
  const isOwner = isOwnerEmail(env, passkey.user_email);
  const role = isOwner ? 'owner' : (user?.role || 'admin');

  // Issue Trinity Session
  const sessionResponse = await issueSession(env, undefined, passkey.user_email, request);
  const sessionCookie = sessionResponse.headers.get('Set-Cookie');

  // Audit event
  await env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('passkey_login', ?)").bind(
    JSON.stringify({
      email: passkey.user_email,
      credential_id: credentialId,
      friendly_name: passkey.friendly_name,
      role,
      at: Date.now()
    })
  ).run();

  const responseHeaders = new Headers({
    'Content-Type': 'application/json'
  });
  if (sessionCookie) {
    responseHeaders.append('Set-Cookie', sessionCookie);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: 'Biometrické prihlásenie cez Passkey úspešné.',
      user: {
        email: passkey.user_email,
        role,
        friendly_name: passkey.friendly_name
      }
    }),
    {
      status: 200,
      headers: responseHeaders
    }
  );
}

/**
 * 5. Zoznam Passkey kľúčov používateľa
 */
export async function listUserPasskeys(env, userEmail) {
  const email = String(userEmail || env.TRINITY_OWNER_EMAIL || '').trim().toLowerCase();
  if (!email) return [];

  const rows = (await env.DB.prepare(`
    SELECT id, credential_id, friendly_name, counter, created_at, last_used_at
    FROM user_passkeys
    WHERE user_email = ?
    ORDER BY created_at DESC
  `).bind(email).all()).results || [];

  return rows.map((r) => ({
    id: r.id,
    credential_id: r.credential_id.slice(0, 16) + '...',
    friendly_name: r.friendly_name || 'Passkey Device',
    counter: r.counter,
    created_at: r.created_at,
    last_used_at: r.last_used_at
  }));
}

/**
 * 6. Zmazanie Passkey kľúča
 */
export async function deleteUserPasskey(env, userEmail, passkeyId) {
  const email = String(userEmail || env.TRINITY_OWNER_EMAIL || '').trim().toLowerCase();
  const row = await env.DB.prepare('SELECT id, friendly_name FROM user_passkeys WHERE id = ? AND user_email = ?')
    .bind(passkeyId, email)
    .first();

  if (!row) {
    throw new HttpError(404, 'Passkey kľúč nebol nájdený.');
  }

  await env.DB.prepare('DELETE FROM user_passkeys WHERE id = ?').bind(passkeyId).run();

  await env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('passkey_revoked', ?)").bind(
    JSON.stringify({ id: passkeyId, email, friendly_name: row.friendly_name, at: Date.now() })
  ).run();

  return { ok: true, message: 'Passkey bol úspešne odstránený.' };
}
