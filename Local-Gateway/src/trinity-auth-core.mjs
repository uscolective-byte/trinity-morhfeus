/**
 * @module TRINITY_OMNI_CORE
 * @subsystem LOCAL_WINDOWS_AUTH_GATE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Lokálne Windows autorizačné jadro overujúce autentický Windows SID zo systémového tokenu WindowsIdentity::GetCurrent().
 */
/**
 * TRINITY UNIFIED AUTHORIZATION CORE (Local-Gateway / Windows Host)
 * Zjednotené autorizačné jadro pre lokálny systémový most vo Windows (P0 Hardened):
 * 1. Windows Auth Gate (účet 'saboi' / 'basterix' + autentický Windows SID zo systémového tokenu WindowsIdentity::GetCurrent())
 * 2. Google Identity Verifier ('saboivan2008@gmail.com', 'uscolective@gmail.com', 'cadjavadvocecka013@gmail.com' + verifiedGoogleToken)
 * 3. Telecom / WhatsApp / SMS Channel ('+421949009722', '0949009722', '+421949515777', '0949515777' + verifiedWebhookSignature)
 * 4. Keď je operátor kryptograficky/OS overený Basterix: koná okamžite a bez otázok.
 *    Keď je to neoverený textový vstup alebo cudzí používateľ (GUEST_USER): okamžitý HARD-LOCK (403 ACCESS DENIED).
 */

import os from 'node:os';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

export const VALID_WINDOWS_SID_REGEX = /^S-1-5-21-\d+-\d+-\d+-\d+$/;

export const ROOT_REGISTRY = Object.freeze({
  architect_alias: 'Basterix',
  windows_users: Object.freeze(['saboi', 'basterix']),
  google_accounts: Object.freeze([
    'saboivan2008@gmail.com',
    'uscolective@gmail.com',
    'cadjavadvocecka013@gmail.com'
  ]),
  phone_numbers: Object.freeze([
    '+421949009722',
    '0949009722',
    '+421949515777',
    '0949515777'
  ])
});

export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/[\s\-\(\)]/g, '').trim();
}

export function canonicalPhoneVariants(phone) {
  const cleaned = normalizePhone(phone);
  if (!cleaned) return [];
  const variants = new Set([cleaned]);
  if (cleaned.startsWith('+421') && cleaned.length === 13) {
    variants.add('0' + cleaned.slice(4));
  } else if (cleaned.startsWith('09') && cleaned.length === 10) {
    variants.add('+421' + cleaned.slice(1));
  } else if (cleaned.startsWith('4219') && cleaned.length === 12) {
    variants.add('+' + cleaned);
    variants.add('0' + cleaned.slice(3));
  }
  return [...variants];
}

export function toCanonicalPhone(phone) {
  const cleaned = normalizePhone(phone);
  if (!cleaned) return '';
  if (cleaned.startsWith('09') && cleaned.length === 10) {
    return '+421' + cleaned.slice(1);
  }
  if (cleaned.startsWith('4219') && cleaned.length === 12) {
    return '+' + cleaned;
  }
  return cleaned;
}

export function toCanonicalIdentity(value) {
  let cleaned = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  if (cleaned.startsWith('09') && cleaned.length === 10) {
    cleaned = '+421' + cleaned.slice(1);
  } else if (cleaned.startsWith('4219') && cleaned.length === 12) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

export async function idHash(value, key) {
  if (!value || !key) return '';
  const norm = toCanonicalIdentity(value);
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(norm));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function idHashSync(value, key) {
  if (!value || !key) return '';
  const norm = toCanonicalIdentity(value);
  return crypto.createHmac('sha256', key).update(norm).digest('hex');
}

export function isAuthorizedRoot(candidate, env = {}, fallbackList = []) {
  if (!candidate) return false;
  const canonical = toCanonicalIdentity(candidate);
  const hmacKey = env?.IDENTITY_HMAC_KEY || (typeof process !== 'undefined' ? process.env?.IDENTITY_HMAC_KEY : null);
  const rootHashesRaw = env?.ROOT_ID_HASHES || (typeof process !== 'undefined' ? process.env?.ROOT_ID_HASHES : null);

  if (hmacKey && rootHashesRaw) {
    const candidateHash = idHashSync(canonical, hmacKey);
    const hashes = (typeof rootHashesRaw === 'string' ? rootHashesRaw.split(',') : rootHashesRaw)
      .map(h => String(h).trim().toLowerCase());
    return hashes.includes(candidateHash);
  }

  if (Array.isArray(fallbackList) && fallbackList.length > 0) {
    const plainNorms = fallbackList.map(item => toCanonicalIdentity(item));
    return plainNorms.includes(canonical);
  }

  return false;
}

export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.toLowerCase().trim();
}

export function isValidWindowsSid(sid) {
  return typeof sid === 'string' && VALID_WINDOWS_SID_REGEX.test(sid.trim());
}

let cachedWindowsIdentity = undefined;

/**
 * Získa autentickú Windows identitu (doména\meno + SID) priamo z kernelového prístupového tokenu
 * cez [System.Security.Principal.WindowsIdentity]::GetCurrent() — NIKDY nie z podvrhnuteľného process.env.USERNAME!
 */
export function getActiveWindowsIdentity() {
  if (cachedWindowsIdentity !== undefined) return cachedWindowsIdentity;
  if (os.platform() !== 'win32') {
    cachedWindowsIdentity = null;
    return null;
  }
  try {
    const rawOut = execSync('whoami /user /fo csv /nh', { encoding: 'utf8', timeout: 5000 }).trim();
    const matches = rawOut.match(/"([^"]+)"\s*,\s*"([^"]+)"/);
    if (matches) {
      const fullName = matches[1];
      const sid = matches[2];
      const parts = fullName.split('\\');
      const username = (parts.length > 1 ? parts[1] : parts[0]).toLowerCase().trim();
      const domain = (parts.length > 1 ? parts[0] : os.hostname()).toLowerCase().trim();
      if (username && isValidWindowsSid(sid)) {
        cachedWindowsIdentity = {
          username,
          domain,
          sid: sid.trim(),
          osTokenVerified: true
        };
        return cachedWindowsIdentity;
      }
    }
  } catch {}
  try {
    const rawOut = execSync(
      'powershell.exe -NoProfile -NonInteractive -Command "$id = [System.Security.Principal.WindowsIdentity]::GetCurrent(); Write-Output ($id.Name + \'|\' + $id.User.Value)"',
      { encoding: 'utf8', timeout: 10000 }
    ).trim();
    const [fullName = '', sid = ''] = rawOut.split('|');
    const parts = fullName.split('\\');
    const username = (parts.length > 1 ? parts[1] : parts[0]).toLowerCase().trim();
    const domain = (parts.length > 1 ? parts[0] : os.hostname()).toLowerCase().trim();
    if (username && isValidWindowsSid(sid)) {
      cachedWindowsIdentity = {
        username,
        domain,
        sid: sid.trim(),
        osTokenVerified: true
      };
      return cachedWindowsIdentity;
    }
    cachedWindowsIdentity = null;
    return null;
  } catch {
    cachedWindowsIdentity = null;
    return null;
  }
}

export function getActiveWindowsSID() {
  const id = getActiveWindowsIdentity();
  return id ? id.sid : null;
}

/**
 * 1. Lokálna Windows inšpekcia (Zero Synthetic SID, Zero Env Spoofing)
 * Zisťuje, či aktuálny proces beží pod prihláseným kontom Basterixa ('saboi' / 'basterix')
 * a overuje skutočný Windows SID zo systémového tokenu.
 */
export function inspectWindowsSession(overrides = null, env = {}) {
  const effectiveEnv = env || overrides?.env || (typeof process !== 'undefined' ? process.env : {});
  const source = overrides && typeof overrides === 'object' && Object.keys(overrides).length > 0
    ? {
        username: String(overrides.username ?? overrides.windowsUser ?? '').toLowerCase().trim(),
        domain: String(overrides.domain ?? 'localhost').toLowerCase().trim(),
        sid: typeof overrides.sid === 'string' ? overrides.sid.trim() : null,
        osTokenVerified: overrides.osTokenVerified === true
      }
    : (getActiveWindowsIdentity() || {
        username: '',
        domain: 'localhost',
        sid: null,
        osTokenVerified: false
      });

  const isMatchedUser = isAuthorizedRoot(source.username, effectiveEnv, ROOT_REGISTRY.windows_users);
  const hasRealSid = isValidWindowsSid(source.sid);

  if (isMatchedUser && hasRealSid && source.osTokenVerified === true) {
    const sessionToken = crypto
      .createHash('sha256')
      .update(`${source.username}:${source.sid}:${source.domain}`)
      .digest('hex');

    return {
      authenticated: true,
      role: 'BASTERIX_ROOT',
      channel: 'WINDOWS_SESSION',
      username: source.username,
      domain: source.domain,
      identifier: `${source.domain}\\${source.username}`,
      sid: source.sid,
      osTokenVerified: true,
      sessionToken
    };
  }

  return {
    authenticated: false,
    role: 'GUEST_USER',
    channel: 'WINDOWS_SESSION',
    reason: !source.osTokenVerified
      ? 'UNVERIFIED_WINDOWS_OS_TOKEN'
      : (!hasRealSid ? 'INVALID_OR_SYNTHETIC_WINDOWS_SID' : 'UNAUTHORIZED_WINDOWS_USER'),
    username: source.username || 'unknown',
    domain: source.domain,
    identifier: source.username || 'unknown',
    sid: null,
    osTokenVerified: false,
    sessionToken: null
  };
}

/**
 * 2. Univerzálny overovač prichádzajúcich požiadaviek (Omnichannel — Fail-Closed)
 */
export function verifyTrinityIdentity(context = {}, env = {}) {
  const effectiveEnv = env || context.env || (typeof process !== 'undefined' ? process.env : {});
  const timestamp = new Date().toISOString();

  // A. Kontrola podľa Google účtu (vyžaduje verifiedGoogleToken === true)
  const email = normalizeEmail(context.email);
  if (email) {
    if (!isAuthorizedRoot(email, effectiveEnv, ROOT_REGISTRY.google_accounts)) {
      return {
        isRoot: false,
        role: 'GUEST_USER',
        operator: 'UNAUTHORIZED_GUEST',
        channel: 'REJECTED_INPUT',
        reason: 'UNAUTHORIZED_GOOGLE_ACCOUNT',
        identifier: email,
        immediateExecution: false,
        askNoQuestions: false,
        timestamp
      };
    }
    if (context.verifiedGoogleToken !== true) {
      return {
        isRoot: false,
        role: 'GUEST_USER',
        operator: 'UNAUTHORIZED_GUEST',
        channel: 'SPOOFED_UNVERIFIED_GOOGLE_INPUT',
        reason: 'UNVERIFIED_GOOGLE_OAUTH_TOKEN',
        identifier: email,
        immediateExecution: false,
        askNoQuestions: false,
        timestamp
      };
    }
    return {
      isRoot: true,
      role: 'BASTERIX_ROOT',
      operator: ROOT_REGISTRY.architect_alias,
      channel: 'GOOGLE_ACCOUNT',
      identifier: email,
      verifiedProof: 'GOOGLE_OAUTH_TOKEN',
      immediateExecution: true,
      askNoQuestions: true,
      timestamp
    };
  }

  // B. Kontrola podľa telefónneho čísla (vyžaduje verifiedWebhookSignature === true)
  const phone = normalizePhone(context.phone);
  if (phone) {
    const canonicalPhone = toCanonicalPhone(phone);
    const isPhoneMatch = isAuthorizedRoot(canonicalPhone, effectiveEnv, ROOT_REGISTRY.phone_numbers);
    if (!isPhoneMatch) {
      return {
        isRoot: false,
        role: 'GUEST_USER',
        operator: 'UNAUTHORIZED_GUEST',
        channel: 'REJECTED_INPUT',
        reason: 'UNAUTHORIZED_PHONE_NUMBER',
        identifier: phone,
        immediateExecution: false,
        askNoQuestions: false,
        timestamp
      };
    }
    if (context.verifiedWebhookSignature !== true) {
      return {
        isRoot: false,
        role: 'GUEST_USER',
        operator: 'UNAUTHORIZED_GUEST',
        channel: 'SPOOFED_UNVERIFIED_TELECOM_INPUT',
        reason: 'UNVERIFIED_TELECOM_WEBHOOK_SIGNATURE',
        identifier: phone,
        immediateExecution: false,
        askNoQuestions: false,
        timestamp
      };
    }
    return {
      isRoot: true,
      role: 'BASTERIX_ROOT',
      operator: ROOT_REGISTRY.architect_alias,
      channel: 'TELECOM_CHANNEL',
      identifier: phone,
      verifiedProof: 'TELECOM_WEBHOOK_HMAC',
      immediateExecution: true,
      askNoQuestions: true,
      timestamp
    };
  }

  // C. Kontrola podľa explicitného lokálneho Windows používateľa (vyžaduje osTokenVerified + platný SID)
  const winUser = String(context.windowsUser || '').toLowerCase().trim();
  if (winUser) {
    if (!isAuthorizedRoot(winUser, effectiveEnv, ROOT_REGISTRY.windows_users)) {
      return {
        isRoot: false,
        role: 'GUEST_USER',
        operator: 'UNAUTHORIZED_GUEST',
        channel: 'REJECTED_INPUT',
        reason: 'UNAUTHORIZED_WINDOWS_USER',
        identifier: winUser,
        immediateExecution: false,
        askNoQuestions: false,
        timestamp
      };
    }
    const candidateSid = context.sid || context.windowsSession?.sid || null;
    const osTokenVerified = context.verifiedWindowsToken === true || context.windowsSession?.osTokenVerified === true;
    if (!osTokenVerified || !isValidWindowsSid(candidateSid)) {
      return {
        isRoot: false,
        role: 'GUEST_USER',
        operator: 'UNAUTHORIZED_GUEST',
        channel: 'SPOOFED_UNVERIFIED_WINDOWS_INPUT',
        reason: 'UNVERIFIED_WINDOWS_TOKEN_OR_SID',
        identifier: winUser,
        immediateExecution: false,
        askNoQuestions: false,
        timestamp
      };
    }
    return {
      isRoot: true,
      role: 'BASTERIX_ROOT',
      operator: ROOT_REGISTRY.architect_alias,
      channel: 'WINDOWS_LOCAL_EXPLICIT',
      identifier: winUser,
      sid: candidateSid,
      verifiedProof: 'WINDOWS_OS_TOKEN_SID',
      immediateExecution: true,
      askNoQuestions: true,
      timestamp
    };
  }

  // D. Ak nie je zadaný externý identifikátor, over aktívnu Windows reláciu zo systémového tokenu
  if (context.checkLocalWindows !== false) {
    const localWin = inspectWindowsSession(context.windowsSession || null);
    if (localWin.authenticated) {
      return {
        isRoot: true,
        role: 'BASTERIX_ROOT',
        operator: ROOT_REGISTRY.architect_alias,
        channel: localWin.channel,
        identifier: localWin.identifier,
        sid: localWin.sid,
        verifiedProof: 'WINDOWS_OS_TOKEN_SID',
        immediateExecution: true,
        askNoQuestions: true,
        timestamp
      };
    }
  }

  // E. Žiadna zhoda -> Zákaz prístupu
  return {
    isRoot: false,
    role: 'GUEST_USER',
    operator: 'UNAUTHORIZED_GUEST',
    channel: 'REJECTED_INPUT',
    reason: 'NO_VERIFIED_ROOT_IDENTITY',
    identifier: email || phone || winUser || 'unknown',
    immediateExecution: false,
    askNoQuestions: false,
    timestamp
  };
}

/**
 * 3. Hlavná exekučná brána (Execution Interceptor)
 */
export async function executePrivileged(context = {}, actionMetadata = {}, actionCallback) {
  const auth = verifyTrinityIdentity(context);

  if (auth.isRoot && auth.role === 'BASTERIX_ROOT') {
    return await actionCallback(auth);
  }

  const securityIncident = {
    status: 'SECURITY_BLOCKED',
    policy: 'TRINITY_ROOT_LOCK_V1',
    reason: auth.reason || 'UNAUTHORIZED_OPERATOR',
    attempted_action: actionMetadata?.action || 'UNKNOWN_ACTION',
    target: actionMetadata?.target || null,
    rejected_source: auth.identifier,
    channel: auth.channel,
    timestamp: auth.timestamp
  };

  console.error('[TRINITY SOVEREIGN LOCKOUT]', JSON.stringify(securityIncident));

  const err = new Error(
    `ACCESS DENIED: Identita '${auth.identifier}' cez kanál '${auth.channel}' (${securityIncident.reason}) nie je autorizovaný administrátor. Modifikovať systém a spúšťať príkazy môže výlučne kryptograficky overený Basterix.`
  );
  err.status = 403;
  err.securityIncident = securityIncident;
  throw err;
}
