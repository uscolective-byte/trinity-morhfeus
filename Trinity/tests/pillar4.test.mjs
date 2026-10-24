import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  listUserPasskeys,
  deleteUserPasskey,
  base64UrlEncode,
  base64UrlDecode,
  getRelyingPartyId
} from '../src/webauthn.js';
import {
  categorizeAction,
  determineSeverity,
  extractActor,
  generateEventSummary,
  queryAuditEvents,
  exportAuditEvents,
  recordAuditEvent
} from '../src/audit-log.js';

function createMockD1() {
  const tables = {
    ops_passkey_challenges: [],
    user_passkeys: [],
    ops_events: [],
    ops_sessions: [],
    ops_users: [
      { email: 'admin@auru.space', role: 'admin', status: 'active' }
    ]
  };

  return {
    tables,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM ops_passkey_challenges WHERE challenge_hash = ?')) {
                const [hash, type, now] = args;
                const idx = tables.ops_passkey_challenges.findIndex(
                  (c) => c.challenge_hash === hash && c.type === type && c.expires_at > now
                );
                if (idx !== -1) {
                  const item = tables.ops_passkey_challenges[idx];
                  if (sql.includes('DELETE FROM')) {
                    tables.ops_passkey_challenges.splice(idx, 1);
                  }
                  return item;
                }
                return null;
              }
              if (sql.includes('FROM user_passkeys WHERE credential_id = ?')) {
                const [credId] = args;
                return tables.user_passkeys.find((p) => p.credential_id === credId) || null;
              }
              if (sql.includes('FROM user_passkeys WHERE id = ? AND user_email = ?')) {
                const [id, email] = args;
                return tables.user_passkeys.find((p) => p.id === id && p.user_email === email) || null;
              }
              if (sql.includes('FROM ops_users WHERE email = ?')) {
                const [email] = args;
                return tables.ops_users.find((u) => u.email === email) || null;
              }
              return null;
            },
            async all() {
              if (sql.includes('user_passkeys') && sql.includes('user_email = ?')) {
                const [email] = args;
                const results = tables.user_passkeys.filter((p) => p.user_email === email);
                return { results };
              }
              if (sql.includes('FROM ops_events')) {
                let results = [...tables.ops_events].reverse();
                if (sql.includes('action LIKE ?')) {
                  const likeStr = args[0].replace(/%/g, '');
                  results = results.filter((e) => e.action.includes(likeStr));
                }
                return { results };
              }
              return { results: [] };
            },
            async run() {
              if (sql.includes('INSERT INTO ops_passkey_challenges')) {
                const [challenge_hash, user_email, type, expires_at] = args;
                tables.ops_passkey_challenges.push({
                  challenge_hash,
                  user_email,
                  type,
                  expires_at,
                  created_at: new Date().toISOString()
                });
                return { success: true };
              }
              if (sql.includes('INSERT INTO user_passkeys')) {
                const [id, user_email, credential_id, public_key, friendly_name, transports] = args;
                tables.user_passkeys.push({
                  id,
                  user_email,
                  credential_id,
                  public_key,
                  counter: 0,
                  friendly_name,
                  transports,
                  created_at: new Date().toISOString(),
                  last_used_at: new Date().toISOString()
                });
                return { success: true };
              }
              if (sql.includes('UPDATE user_passkeys SET counter = ?')) {
                const [counter, id] = args;
                const item = tables.user_passkeys.find((p) => p.id === id);
                if (item) item.counter = counter;
                return { success: true };
              }
              if (sql.includes('DELETE FROM user_passkeys WHERE id = ?')) {
                const [id] = args;
                const idx = tables.user_passkeys.findIndex((p) => p.id === id);
                if (idx !== -1) tables.user_passkeys.splice(idx, 1);
                return { success: true };
              }
              if (sql.includes('INSERT INTO ops_events')) {
                if (sql.includes('job_id')) {
                  const [job_id, action, details] = args;
                  tables.ops_events.push({
                    id: tables.ops_events.length + 1,
                    job_id,
                    action,
                    details,
                    created_at: new Date().toISOString()
                  });
                } else {
                  const [action, details] = args;
                  tables.ops_events.push({
                    id: tables.ops_events.length + 1,
                    action,
                    details,
                    created_at: new Date().toISOString()
                  });
                }
                return { success: true };
              }
              if (sql.includes('INSERT INTO ops_sessions')) {
                const [token_hash, expires_at, email] = args;
                tables.ops_sessions.push({ token_hash, expires_at, email });
                return { success: true };
              }
              if (sql.includes('DELETE FROM ops_passkey_challenges') || sql.includes('DELETE FROM ops_sessions')) {
                return { success: true };
              }
              return { success: true };
            }
          };
        }
      };
    }
  };
}

test('Pillar 4: WebAuthn Passkey registration and authentication flow', async () => {
  const db = createMockD1();
  const env = {
    DB: db,
    TRINITY_OWNER_EMAIL: 'admin@auru.space',
    TRINITY_ADMIN_EMAILS: 'admin@auru.space'
  };
  const request = new Request('https://auru.space/api/auth/passkey/register-options', {
    method: 'POST'
  });

  // 1. Generate Registration Options
  const regOptions = await generateRegistrationOptions(request, env, 'admin@auru.space');
  assert.ok(regOptions.challenge);
  assert.equal(regOptions.rp.id, 'auru.space');
  assert.equal(regOptions.user.name, 'admin@auru.space');
  assert.equal(db.tables.ops_passkey_challenges.length, 1);

  // 2. Verify Registration Response
  const mockClientDataJSON = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        type: 'webauthn.create',
        challenge: regOptions.challenge,
        origin: 'https://auru.space'
      })
    )
  );

  const regResponse = await verifyRegistrationResponse(
    request,
    env,
    {
      id: 'cred_test_12345',
      response: {
        clientDataJSON: mockClientDataJSON,
        attestationObject: 'mock_attestation_bytes',
        transports: ['internal']
      },
      friendlyName: 'MacBook TouchID',
      userEmail: 'admin@auru.space'
    },
    'admin@auru.space'
  );

  assert.equal(regResponse.ok, true);
  assert.equal(db.tables.user_passkeys.length, 1);
  assert.equal(db.tables.user_passkeys[0].credential_id, 'cred_test_12345');
  assert.equal(db.tables.user_passkeys[0].friendly_name, 'MacBook TouchID');

  // 3. List Passkeys
  const passkeys = await listUserPasskeys(env, 'admin@auru.space');
  assert.equal(passkeys.length, 1);
  assert.equal(passkeys[0].friendly_name, 'MacBook TouchID');

  // 4. Generate Authentication Options
  const authOptions = await generateAuthenticationOptions(request, env, 'admin@auru.space');
  assert.ok(authOptions.challenge);
  assert.equal(authOptions.rpId, 'auru.space');
  assert.ok(authOptions.allowCredentials.length >= 1);

  // 5. Verify Authentication Response (Login)
  const mockAuthClientDataJSON = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        type: 'webauthn.get',
        challenge: authOptions.challenge,
        origin: 'https://auru.space'
      })
    )
  );

  const authResponse = await verifyAuthenticationResponse(request, env, {
    id: 'cred_test_12345',
    response: {
      clientDataJSON: mockAuthClientDataJSON,
      authenticatorData: 'mock_auth_data',
      signature: 'mock_signature'
    }
  });

  assert.equal(authResponse.status, 200);
  const authJson = await authResponse.json();
  assert.equal(authJson.ok, true);
  assert.equal(authJson.user.email, 'admin@auru.space');
  assert.ok(authResponse.headers.get('Set-Cookie').includes('trinity_session='));

  // 6. Delete Passkey
  const delResult = await deleteUserPasskey(env, 'admin@auru.space', db.tables.user_passkeys[0].id);
  assert.equal(delResult.ok, true);
  assert.equal(db.tables.user_passkeys.length, 0);
});

test('Pillar 4: Audit Trail categorization, severity and query engine', async () => {
  const db = createMockD1();
  const env = { DB: db };

  // Seed events
  await recordAuditEvent(env, {
    action: 'domain_dns_created',
    details: { type: 'A', name: 'app', content: '1.2.3.4', by: 'admin@auru.space' }
  });
  await recordAuditEvent(env, {
    action: 'invoice_created',
    details: { invoice_number: 'INV-2026-001', amount_eur: 450, client_name: 'Tech s.r.o.' }
  });
  await recordAuditEvent(env, {
    action: 'emergency_stop_enabled',
    details: { by: 'admin@auru.space', reason: 'Preventative check' }
  });
  await recordAuditEvent(env, {
    action: 'passkey_login',
    details: { email: 'admin@auru.space', friendly_name: 'Windows Hello' }
  });

  assert.equal(db.tables.ops_events.length, 4);

  // 1. Query all
  const allEvents = await queryAuditEvents(env, { limit: 10 });
  assert.equal(allEvents.length, 4);

  // 2. Filter by category
  const domainEvents = await queryAuditEvents(env, { category: 'domains' });
  assert.equal(domainEvents.length, 1);
  assert.equal(domainEvents[0].category, 'domains');
  assert.match(domainEvents[0].summary, /DNS záznam vytvorený/);

  // 3. Filter by severity
  const criticalEvents = await queryAuditEvents(env, { severity: 'critical' });
  assert.equal(criticalEvents.length, 1);
  assert.equal(criticalEvents[0].action, 'emergency_stop_enabled');

  // 4. Search keyword
  const searchResults = await queryAuditEvents(env, { search: 'INV-2026-001' });
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].action, 'invoice_created');

  // 5. Export CSV & JSON
  const csvExport = await exportAuditEvents(env, 'csv');
  assert.match(csvExport.contentType, /text\/csv/);
  assert.match(csvExport.data, /Timestamp,Category,Severity/);
  assert.match(csvExport.data, /domain_dns_created/);

  const jsonExport = await exportAuditEvents(env, 'json');
  assert.match(jsonExport.contentType, /application\/json/);
  const parsedJson = JSON.parse(jsonExport.data);
  assert.equal(parsedJson.length, 4);
});
