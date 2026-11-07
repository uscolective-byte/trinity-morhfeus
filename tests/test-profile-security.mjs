#!/usr/bin/env node
/**
 * ============================================================================
 * TRINITY SOVEREIGN IDENTITY & PROFILE ENGINE (Worker #47)
 * ADVERSARIAL SECURITY TEST SUITE & ATTACK REPRODUCTION HARNESS
 * ============================================================================
 * Target: trinity-profile/src/index.ts
 * Subsystem: Sovereign Identity & Profile Engine
 * 
 * Verifies:
 *  1. Direct unauthenticated role elevation denial on POST /api/profile/create.
 *  2. Elimination of hardcoded email bypass (saboivan2008@gmail.com).
 *  3. Header forgery defenses (CF-Access-Client-Id require paired secret).
 *  4. Prefix-only Bearer token forgery defenses (trn_live_ requires crypto check).
 *  5. Cryptographic hash privacy (apiKeyHash never leaked in GET endpoints).
 *  6. Malformed JSON handling & stack trace suppression.
 *  7. POST /api/profile/update rejection or stripping of protected fields:
 *     - role, apiKeyHash, email, status, ttkBalance, createdAt.
 *  8. Neutralization of second-order privilege escalation via user API keys.
 *  9. KV cache poisoning & desynchronization immunity:
 *     - D1 is the authoritative source-of-truth for verifyAdminAuthorization.
 *     - Artificially modified KV saying role="superadmin" when D1 says
 *       role="user" fails closed and denies admin access.
 * 10. Legitimate authorized admin updates via X-Admin-Secret.
 * 11. Legitimate admin operations via verified D1 admin API keys.
 * 12. Account suspension enforcement via TRINITY_OPS_KEY (fails closed).
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Dynamically resolve esbuild
let buildFn;
try {
  const esbuildPath = path.join(ROOT_DIR, 'Trinity/node_modules/esbuild/lib/main.js');
  const esbuild = await import(`file://${esbuildPath}`);
  buildFn = esbuild.build;
} catch {
  const esbuild = await import('esbuild');
  buildFn = esbuild.build;
}

const bundleOut = path.join(tmpdir(), `trinity-profile-bundled-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
await buildFn({
  entryPoints: [path.join(ROOT_DIR, 'trinity-profile/src/index.ts')],
  bundle: true,
  outfile: bundleOut,
  platform: 'neutral',
  target: 'es2022',
  format: 'esm',
  packages: 'external'
});

const mod = await import(`file://${bundleOut.replace(/\\/g, '/')}?t=${Date.now()}`);
const handler = mod.default;

console.log(`========================================================================`);
console.log(`🔒 COMPREHENSIVE ADVERSARIAL SECURITY SUITE: trinity-profile (Worker 47)`);
console.log(`========================================================================\n`);

// High-fidelity D1 Mock simulating user_profiles persistence and queries
function createMockDB() {
  return {
    profiles: new Map(),
    prepare(query) {
      return {
        bind(...args) {
          return {
            async run() {
              if (query.includes('INSERT OR REPLACE INTO user_profiles')) {
                const id = args[0];
                mockDB.profiles.set(id, {
                  id: args[0], email: args[1], display_name: args[2], alias: args[3],
                  avatar_url: args[4], role: args[5], organization: args[6],
                  wallet_address: args[7], ttk_balance: args[8], preferences_json: args[9],
                  api_key_hash: args[10], status: args[11], created_at: args[12],
                  updated_at: args[13], last_login_at: args[14]
                });
              } else if (query.includes('UPDATE user_profiles')) {
                const id = args[args.length - 1];
                const p = mockDB.profiles.get(id);
                if (p) {
                  if (query.includes('role = COALESCE(?, role)')) {
                    if (args[0] !== null) p.display_name = args[0];
                    if (args[1] !== null) p.alias = args[1];
                    if (args[2] !== null) p.avatar_url = args[2];
                    if (args[3] !== null) p.role = args[3];
                    if (args[4] !== null) p.status = args[4];
                    if (args[5] !== null) p.organization = args[5];
                    if (args[6] !== null) p.wallet_address = args[6];
                    if (args[7] !== null) p.preferences_json = args[7];
                    p.updated_at = args[8];
                  } else {
                    if (args[0] !== null) p.display_name = args[0];
                    if (args[1] !== null) p.alias = args[1];
                    if (args[2] !== null) p.avatar_url = args[2];
                    if (args[3] !== null) p.organization = args[3];
                    if (args[4] !== null) p.wallet_address = args[4];
                    if (args[5] !== null) p.preferences_json = args[5];
                    p.updated_at = args[6];
                  }
                }
              }
              return { success: true };
            },
            async first() {
              if (query.includes('SELECT') && query.includes('WHERE id = ?')) {
                const p = mockDB.profiles.get(args[0]);
                if (!p) return null;
                if (query.includes('SELECT role, status FROM') || query.includes('SELECT role FROM') || query.includes('SELECT role, email, status FROM')) {
                  return { role: p.role, email: p.email, status: p.status };
                }
                return p;
              }
              if (query.includes('SELECT') && query.includes('WHERE email = ?')) {
                for (const p of mockDB.profiles.values()) {
                  if (p.email === args[0]) return p;
                }
                return null;
              }
              return null;
            }
          };
        },
        async run() { return { success: true }; }
      };
    }
  };
}

function createMockKV() {
  return {
    store: new Map(),
    async get(k) { return this.store.get(k) || null; },
    async put(k, v) { this.store.set(k, v); },
    async delete(k) { this.store.delete(k); }
  };
}

const mockDB = createMockDB();
const mockKV = createMockKV();

const env = {
  DB: mockDB,
  TRINITY_KV: mockKV,
  TOKEN_SALT: 'secret_salt_12345',
  ADMIN_SECRET: 'master_superadmin_secret_987654321',
  TRINITY_OPS_KEY: 'ops_master_key_1234567890'
};

const ctx = {
  waitUntil() {},
  passThroughOnException() {}
};

const findings = [];

// ============================================================================
// TEST 1: Unauthenticated registration attempting superadmin role escalation
// ============================================================================
{
  const req = new Request('http://localhost/api/profile/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'hacker@example.com',
      displayName: 'Hacker',
      role: 'superadmin'
    })
  });
  const res = await handler.fetch(req, env, ctx);
  const data = await res.json();
  if (data.profile?.role === 'superadmin') {
    findings.push({ severity: 'CRITICAL', test: 1, desc: 'Unauthenticated caller successfully registered as superadmin!' });
  } else if (data.profile?.role === 'user') {
    console.log('✅ TEST 1 PASS: Unauthenticated superadmin escalation denied (downgraded to "user").');
  } else {
    findings.push({ severity: 'HIGH', test: 1, desc: `Unexpected role assigned: ${data.profile?.role}` });
  }
}

// ============================================================================
// TEST 2: Email bypass regression check (saboivan2008@gmail.com)
// ============================================================================
{
  const req = new Request('http://localhost/api/profile/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'saboivan2008@gmail.com',
      displayName: 'Ivan',
      role: 'superadmin'
    })
  });
  const res = await handler.fetch(req, env, ctx);
  const data = await res.json();
  if (data.profile?.role === 'superadmin') {
    findings.push({ severity: 'HIGH', test: 2, desc: 'Hardcoded email bypass still grants superadmin role!' });
  } else {
    console.log('✅ TEST 2 PASS: Hardcoded email saboivan2008@gmail.com correctly denied superadmin without valid secret.');
  }
}

// ============================================================================
// TEST 3: Forged CF-Access-Client-Id header escalation
// ============================================================================
{
  const req = new Request('http://localhost/api/profile/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Access-Client-Id': 'attacker-forged-header'
    },
    body: JSON.stringify({
      email: 'cf_spoofer@example.com',
      displayName: 'CF Spoofer',
      role: 'superadmin'
    })
  });
  const res = await handler.fetch(req, env, ctx);
  const data = await res.json();
  if (data.profile?.role === 'superadmin') {
    findings.push({ severity: 'HIGH', test: 3, desc: 'Forged CF-Access-Client-Id header granted superadmin without valid secret!' });
  } else {
    console.log('✅ TEST 3 PASS: Forged CF-Access-Client-Id rejected.');
  }
}

// ============================================================================
// TEST 4: Forged prefix-only Bearer token (Bearer trn_live_fake)
// ============================================================================
{
  const req = new Request('http://localhost/api/profile/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer trn_live_fake_token_123'
    },
    body: JSON.stringify({
      email: 'token_forger@example.com',
      displayName: 'Token Forger',
      role: 'superadmin'
    })
  });
  const res = await handler.fetch(req, env, ctx);
  const data = await res.json();
  if (data.profile?.role === 'superadmin') {
    findings.push({ severity: 'HIGH', test: 4, desc: 'Arbitrary Bearer token granted superadmin without cryptographic verification!' });
  } else {
    console.log('✅ TEST 4 PASS: Arbitrary Bearer token rejected.');
  }
}

// ============================================================================
// TEST 5: Secret API key leakage in GET /api/profile/:id
// ============================================================================
{
  const req = new Request('http://localhost/api/profile?email=hacker@example.com', { method: 'GET' });
  const res = await handler.fetch(req, env, ctx);
  const data = await res.json();
  if (data.apiKeyHash) {
    findings.push({ severity: 'CRITICAL', test: 5, desc: 'GET /api/profile leaked apiKeyHash!' });
  } else {
    console.log('✅ TEST 5 PASS: GET /api/profile does not leak apiKeyHash.');
  }
}

// ============================================================================
// TEST 6: Invalid JSON error handling & stack trace suppression
// ============================================================================
{
  const req = new Request('http://localhost/api/profile/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'MALFORMED_JSON_STRING'
  });
  const res = await handler.fetch(req, env, ctx);
  if (res.status !== 500 && res.status !== 400) {
    findings.push({ severity: 'MEDIUM', test: 6, desc: `Invalid JSON returned unexpected status ${res.status}` });
  }
  const bodyText = await res.text();
  if (bodyText.includes('at eval') || bodyText.includes('trinity-profile/src')) {
    findings.push({ severity: 'HIGH', test: 6, desc: 'Stack trace leaked in error response!' });
  } else {
    console.log('✅ TEST 6 PASS: Malformed JSON handled without leaking stack traces.');
  }
}

// ============================================================================
// Setup User for State-Mutation Tests (Tests 7 - 12)
// ============================================================================
let victimUser;
let victimApiKey;
{
  const regRes = await handler.fetch(new Request('http://localhost/api/profile/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice_victim@example.com', displayName: 'Alice Victim' })
  }), env, ctx);
  const data = await regRes.json();
  victimUser = data.profile;
  victimApiKey = data.secretApiKey;
  assert.equal(victimUser.role, 'user');
}

// ============================================================================
// TEST 7: POST /api/profile/update rejection or stripping of protected fields
// ============================================================================
{
  const updateRes = await handler.fetch(new Request('http://localhost/api/profile/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: victimUser.id,
      displayName: 'Alice Updated',
      role: 'superadmin',
      apiKeyHash: 'poisoned_hash_value_123',
      email: 'hacked_alice@evil.com',
      status: 'SUSPENDED'
    })
  }), env, ctx);

  if (updateRes.status === 403 || updateRes.status === 400) {
    console.log(`✅ TEST 7 PASS: Unprivileged update rejected with HTTP ${updateRes.status}.`);
  } else if (updateRes.status === 200) {
    const kvCached = JSON.parse(await mockKV.get(`profile:${victimUser.id}`));
    const dbUser = mockDB.profiles.get(victimUser.id);

    let failed = false;
    if (kvCached.role === 'superadmin') {
      findings.push({ severity: 'CRITICAL', test: 7, desc: 'VULNERABILITY: POST /api/profile/update allowed unprivileged caller to overwrite role="superadmin" in KV cache!' });
      failed = true;
    }
    if (kvCached.apiKeyHash === 'poisoned_hash_value_123') {
      findings.push({ severity: 'CRITICAL', test: 7, desc: 'VULNERABILITY: POST /api/profile/update allowed unprivileged caller to overwrite apiKeyHash in KV cache!' });
      failed = true;
    }
    if (kvCached.email === 'hacked_alice@evil.com') {
      findings.push({ severity: 'HIGH', test: 7, desc: 'VULNERABILITY: POST /api/profile/update allowed unprivileged caller to alter email in KV cache!' });
      failed = true;
    }
    if (kvCached.status === 'SUSPENDED') {
      findings.push({ severity: 'HIGH', test: 7, desc: 'VULNERABILITY: POST /api/profile/update allowed unprivileged caller to change account status to SUSPENDED!' });
      failed = true;
    }
    if (dbUser.role !== 'user' || dbUser.status !== 'ACTIVE') {
      findings.push({ severity: 'CRITICAL', test: 7, desc: 'VULNERABILITY: D1 record modified protected fields by unprivileged caller!' });
      failed = true;
    }

    if (!failed) {
      console.log('✅ TEST 7 PASS: Unprivileged update sanitized/stripped; role, apiKeyHash, email, and status preserved in KV & D1.');
    }
  } else {
    findings.push({ severity: 'MEDIUM', test: 7, desc: `Unexpected response status ${updateRes.status} from /api/profile/update` });
  }
}

// ============================================================================
// TEST 8: Neutralization of second-order privilege escalation
// ============================================================================
{
  const escalRes = await handler.fetch(new Request('http://localhost/api/profile/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${victimApiKey}`
    },
    body: JSON.stringify({
      email: 'attacker_target@example.com',
      displayName: 'Attacker Target',
      role: 'superadmin'
    })
  }), env, ctx);
  const data = await escalRes.json();
  if (data.profile?.role === 'superadmin') {
    findings.push({ severity: 'CRITICAL', test: 8, desc: 'CRITICAL EXPLOIT: Attacker utilized unauthenticated profile update to achieve superadmin authorization via Bearer key!' });
  } else if (data.profile?.role === 'user') {
    console.log('✅ TEST 8 PASS: Second-order escalation neutralized (user API key cannot authorize admin creation).');
  } else {
    findings.push({ severity: 'MEDIUM', test: 8, desc: `Unexpected role assigned during escalation check: ${data.profile?.role}` });
  }
}

// ============================================================================
// TEST 9: KV Cache Poisoning & Desynchronization Immunity
// ============================================================================
{
  // Artificially poison KV cache directly
  const kvCached = JSON.parse(await mockKV.get(`profile:${victimUser.id}`));
  kvCached.role = 'superadmin';
  await mockKV.put(`profile:${victimUser.id}`, JSON.stringify(kvCached));

  // Ensure D1 database strictly asserts role = "user"
  const dbUser = mockDB.profiles.get(victimUser.id);
  assert.equal(dbUser.role, 'user', 'D1 baseline role must be "user"');

  // Attempt privileged action using victimApiKey
  const poisonRes = await handler.fetch(new Request('http://localhost/api/profile/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${victimApiKey}`
    },
    body: JSON.stringify({
      email: 'poison_target@example.com',
      displayName: 'Poison Target',
      role: 'superadmin'
    })
  }), env, ctx);
  const poisonData = await poisonRes.json();

  if (poisonData.profile?.role === 'superadmin') {
    findings.push({ severity: 'CRITICAL', test: 9, desc: 'CRITICAL VULNERABILITY: verifyAdminAuthorization trusted poisoned KV cache over D1 authoritative record!' });
  } else if (poisonData.profile?.role === 'user') {
    console.log('✅ TEST 9 PASS: KV cache poisoning neutralized; verifyAdminAuthorization strictly validated role against D1.');
  } else {
    findings.push({ severity: 'MEDIUM', test: 9, desc: `Unexpected role assigned: ${poisonData.profile?.role}` });
  }
}

// ============================================================================
// TEST 10: Authorized admin update via X-Admin-Secret
// ============================================================================
{
  const adminUpdateRes = await handler.fetch(new Request('http://localhost/api/profile/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': env.ADMIN_SECRET
    },
    body: JSON.stringify({
      id: victimUser.id,
      role: 'admin',
      organization: 'Trinity Core Operations'
    })
  }), env, ctx);

  if (adminUpdateRes.status !== 200) {
    findings.push({ severity: 'HIGH', test: 10, desc: `Authorized admin update failed with status ${adminUpdateRes.status}` });
  } else {
    const kvAdminCached = JSON.parse(await mockKV.get(`profile:${victimUser.id}`));
    const dbAdminUser = mockDB.profiles.get(victimUser.id);

    if (kvAdminCached.role !== 'admin' || dbAdminUser.role !== 'admin') {
      findings.push({
        severity: 'HIGH',
        test: 10,
        desc: `Authorized admin update failed to promote role: KV=${kvAdminCached.role}, D1=${dbAdminUser.role}`
      });
    } else {
      console.log('✅ TEST 10 PASS: Authorized admin update with X-Admin-Secret successfully promoted role in both D1 and KV.');
    }
  }
}

// ============================================================================
// TEST 11: Authorized admin operations via legitimately promoted admin API key
// ============================================================================
{
  const adminOpRes = await handler.fetch(new Request('http://localhost/api/profile/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${victimApiKey}`
    },
    body: JSON.stringify({
      email: 'new_operator@example.com',
      displayName: 'New Operator',
      role: 'operator'
    })
  }), env, ctx);
  const data = await adminOpRes.json();

  if (data.profile?.role !== 'operator') {
    findings.push({ severity: 'HIGH', test: 11, desc: `Legitimately promoted admin could not create operator account: role=${data.profile?.role}` });
  } else {
    console.log('✅ TEST 11 PASS: Legitimately promoted admin key successfully authorized admin operation.');
  }
}

// ============================================================================
// TEST 12: Account suspension enforcement via TRINITY_OPS_KEY
// ============================================================================
{
  const suspendRes = await handler.fetch(new Request('http://localhost/api/profile/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.TRINITY_OPS_KEY}`
    },
    body: JSON.stringify({
      id: victimUser.id,
      status: 'SUSPENDED'
    })
  }), env, ctx);

  if (suspendRes.status !== 200) {
    findings.push({ severity: 'HIGH', test: 12, desc: `Ops key suspension update failed with status ${suspendRes.status}` });
  } else {
    const dbUser = mockDB.profiles.get(victimUser.id);
    const kvUser = JSON.parse(await mockKV.get(`profile:${victimUser.id}`));

    if (dbUser.status !== 'SUSPENDED' || kvUser.status !== 'SUSPENDED') {
      findings.push({ severity: 'HIGH', test: 12, desc: `Suspension status not propagated: D1=${dbUser.status}, KV=${kvUser.status}` });
    } else {
      // Confirm that suspended admin key now FAILS CLOSED
      const suspendedOpRes = await handler.fetch(new Request('http://localhost/api/profile/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${victimApiKey}`
        },
        body: JSON.stringify({
          email: 'blocked_user@example.com',
          displayName: 'Blocked',
          role: 'admin'
        })
      }), env, ctx);
      const data = await suspendedOpRes.json();

      if (data.profile?.role === 'admin') {
        findings.push({ severity: 'CRITICAL', test: 12, desc: 'Suspended admin key was still permitted to create admin accounts!' });
      } else {
        console.log('✅ TEST 12 PASS: Account suspension via Ops Key enforced; suspended admin key fails closed.');
      }
    }
  }
}

// ============================================================================
// SUMMARY REPORT
// ============================================================================
console.log(`\n================== ADVERSARIAL SECURITY SUMMARY ==================`);
console.log(`Total Findings: ${findings.length}`);
for (const f of findings) {
  console.log(`[${f.severity}] [TEST ${f.test}] ${f.desc}`);
}

if (findings.length > 0) {
  process.exitCode = 1;
} else {
  console.log('🎉 ALL 12 ADVERSARIAL SECURITY TESTS PASSED DETERMINISTICALLY!');
}
