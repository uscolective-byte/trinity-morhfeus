import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeFastChatInput,
  evaluateSafeArithmetic,
  matchFastChatEdge,
  handleFastChatEdge
} from '../src/fast-chat.js';
import chatInferenceWorker, {
  createStreamingSanitizer,
  sliceContextSafely,
  CIRCUIT_BREAKER_CONFIG
} from '../services/chat-inference.js';
import { recordAuditLog, listAuditLogs } from '../src/audit-ledger.js';
import {
  verifyBridgeSecret,
  createDesktopCommanderHandler
} from '../../scripts/desktop-commander-bridge/bridge.js';
import { runPreDeployCheck } from '../../scripts/pre-deploy-check.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const trinityDir = path.resolve(__dirname, '..');

function parseJsonc(raw) {
  return JSON.parse(raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
}

test('Module 1: Hermetická konfigurácia Wrangler (Staging vs Production)', () => {
  const config = parseJsonc(fs.readFileSync(path.join(trinityDir, 'wrangler.jsonc'), 'utf8'));
  const prod = config.env.production;
  const staging = config.env.staging;

  assert.equal(prod.vars.ENVIRONMENT, 'production');
  assert.equal(prod.vars.STRICT_MODE, 'true');
  assert.equal(prod.vars.DEBUG_LOGGING, 'false');
  assert.equal(prod.vars.ENABLE_EXPERIMENTAL_MODELS, 'false');

  assert.equal(staging.vars.ENVIRONMENT, 'staging');
  assert.equal(staging.vars.STRICT_MODE, 'false');
  assert.equal(staging.vars.DEBUG_LOGGING, 'true');
  assert.equal(staging.vars.ENABLE_EXPERIMENTAL_MODELS, 'true');

  assert.equal(prod.d1_databases.find((d) => d.binding === 'DB')?.database_name, 'trinity-v03');
  assert.equal(staging.d1_databases.find((d) => d.binding === 'DB')?.database_name, 'trinity-development');

  assert.ok(prod.kv_namespaces.some((k) => k.binding === 'TRINITY_KV_PROD'));
  assert.ok(staging.kv_namespaces.some((k) => k.binding === 'TRINITY_KV_STAGING'));

  for (const binding of ['PROFILE_SERVICE', 'CORE_SERVICE', 'DISPATCHER_SERVICE', 'AI_INFERENCE_SERVICE']) {
    assert.ok(prod.services.some((s) => s.binding === binding), `Prod missing ${binding}`);
    assert.ok(staging.services.some((s) => s.binding === binding), `Staging missing ${binding}`);
  }
});

test('Module 2: Fast-Chat Router, NFD Normalizácia, Safe Arithmetic & X-Trinity-Route', async () => {
  assert.equal(normalizeFastChatInput('  Kto je Majiteľ?!  '), 'kto je majitel');
  assert.equal(normalizeFastChatInput('Aké mám domény?'), 'ake mam domeny');

  assert.equal(evaluateSafeArithmetic('5+5'), 10);
  assert.equal(evaluateSafeArithmetic('12 * 8'), 96);
  assert.equal(evaluateSafeArithmetic('(10 + 5) * 2'), 30);
  assert.equal(evaluateSafeArithmetic('10 / 0'), null);
  assert.equal(evaluateSafeArithmetic('process.exit(1)'), null);

  const ownerMatch = matchFastChatEdge('Kto je majiteľ?');
  assert.ok(ownerMatch);
  assert.equal(ownerMatch.category, 'identity_ring0');
  assert.match(ownerMatch.reply, /Ivan Sabo \(Basterix/);

  const domainMatch = matchFastChatEdge('Aké mám domény?');
  assert.ok(domainMatch);
  assert.equal(domainMatch.category, 'system_fleet_domains');
  assert.match(domainMatch.reply, /47/);
  assert.match(domainMatch.reply, /auru\.space/);
  assert.match(domainMatch.reply, /auru\.dev/);

  const mathRes = await handleFastChatEdge('12*8');
  assert.ok(mathRes);
  assert.equal(mathRes.status, 200);
  assert.equal(mathRes.headers.get('X-Trinity-Route'), 'fast-chat-edge');
  const mathBody = await mathRes.json();
  assert.equal(mathBody.result, 96);
});

test('Module 3: System Instruction Pinning, 3-Tier Circuit Breaker & SSE Leak Filter', async () => {
  // 1. System Instruction Pinning at index 0
  const messages = [
    { role: 'system', content: 'Osobnosť Trinity Ring 0' },
    ...Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `Správa ${i + 1}` }))
  ];
  const sliced = sliceContextSafely(messages, 40000, 5);
  assert.equal(sliced[0].role, 'system');
  assert.equal(sliced[0].content, 'Osobnosť Trinity Ring 0');
  assert.equal(sliced.length, 5);

  // 2. Stateful Circuit Breaker: 3 failures on Tier 1 in 60s -> skips Tier 1 on 4th call
  let tier1Calls = 0;
  let tier2Calls = 0;
  const mockEnv = {
    AI: {
      async run(model) {
        if (model === '@cf/meta/llama-3.3-70b-instruct-fp8-fast') {
          tier1Calls++;
          throw new Error('504 Gateway Timeout');
        }
        if (model === '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b') {
          tier2Calls++;
          return { response: 'Odpoveď z Tier 2' };
        }
        return { response: 'Odpoveď z Tier 3' };
      }
    }
  };

  const makeReq = (text) =>
    new Request('https://auru.space/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: text }], stream: false })
    });

  assert.equal(CIRCUIT_BREAKER_CONFIG.FAILURE_THRESHOLD, 3);
  for (let i = 0; i < 3; i++) {
    const res = await chatInferenceWorker.fetch(makeReq(`Test ${i + 1}`), mockEnv);
    const body = await res.json();
    assert.equal(body.model_used, '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b');
  }
  assert.equal(tier1Calls, 3);

  // 4th call: Circuit breaker is OPEN for Tier 1, so Tier 1 is not even called!
  const fourthRes = await chatInferenceWorker.fetch(makeReq('Test 4'), mockEnv);
  const fourthBody = await fourthRes.json();
  assert.equal(fourthBody.model_used, '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b');
  assert.equal(tier1Calls, 3, 'Tier 1 must be skipped while circuit breaker is open');
  assert.equal(tier2Calls, 4);

  // 3. Sliding-window SSE Leak Filter across chunk boundaries
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const sseLines = [
    `data: ${JSON.stringify({ response: 'Čistá odpoveď pre Basterixa.' })}\n\n`,
    `data: ${JSON.stringify({ response: 'Únik INTERNAL_API_' })}\n\n`,
    `data: ${JSON.stringify({ response: 'SECRET v druhom chunku' })}\n\n`,
    `data: [DONE]\n\n`
  ];
  const readable = new ReadableStream({
    start(controller) {
      for (const c of sseLines) controller.enqueue(encoder.encode(c));
      controller.close();
    }
  });
  const filteredStream = readable.pipeThrough(createStreamingSanitizer());
  const reader = filteredStream.getReader();
  let output = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }
  output += decoder.decode();
  assert.match(output, /Čistá odpoveď pre Basterixa/);
  assert.ok(!output.includes('SECRET v druhom chunku'));
});

test('Module 4: Asynchrónny D1 Audit Ledger (ctx.waitUntil & audit_logs)', async () => {
  const sql = fs.readFileSync(path.join(trinityDir, 'migrations', '0057_audit_logs_ledger.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS audit_logs/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs\(timestamp\)/i);

  const rows = [];
  let waitedPromise = null;
  const mockEnv = {
    ENVIRONMENT: 'production',
    DB: {
      prepare(query) {
        return {
          bind(...args) {
            return {
              async run() {
                if (query.startsWith('INSERT INTO audit_logs')) {
                  rows.push({
                    id: args[0],
                    actor: args[1],
                    environment: args[2],
                    action: args[3],
                    payload: args[4],
                    timestamp: args[5]
                  });
                }
                return { success: true };
              },
              async all() {
                return { results: rows.slice(0, args[0]) };
              }
            };
          },
          async run() {
            return { success: true };
          }
        };
      }
    }
  };
  const mockCtx = {
    waitUntil(promise) {
      waitedPromise = promise;
    }
  };

  const receipt = recordAuditLog(mockEnv, mockCtx, {
    actor: 'Basterix',
    action: 'DOMAIN_ISOLATION_LOCK',
    payload: { prod: 'auru.space', staging: 'auru.dev' }
  });
  assert.equal(receipt.dispatched, true);
  assert.ok(waitedPromise);
  await waitedPromise;

  const stored = await listAuditLogs(mockEnv, 10);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].actor, 'Basterix');
  assert.equal(stored[0].action, 'DOMAIN_ISOLATION_LOCK');
});

test('Module 5 & 6: Desktop Commander Bridge X-Trinity-Bridge-Secret & Pre-Deploy Check', async () => {
  assert.equal(verifyBridgeSecret('top-secret-ring0', 'top-secret-ring0'), true);
  assert.equal(verifyBridgeSecret('wrong', 'top-secret-ring0'), false);

  const handler = createDesktopCommanderHandler({ secret: 'top-secret-ring0' });

  // Unauthorized request
  let statusCode = 0;
  let responseBody = '';
  await handler(
    { method: 'GET', url: '/health', headers: {} },
    {
      writeHead(code) { statusCode = code; },
      end(body) { responseBody = body; }
    }
  );
  assert.equal(statusCode, 401);

  // Authorized request
  await handler(
    { method: 'GET', url: '/health', headers: { 'x-trinity-bridge-secret': 'top-secret-ring0' } },
    {
      writeHead(code) { statusCode = code; },
      end(body) { responseBody = body; }
    }
  );
  assert.equal(statusCode, 200);
  const parsed = JSON.parse(responseBody);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.desktop_commander_status, 'online');

  // Pre-deploy check verification
  const checkResult = runPreDeployCheck();
  assert.equal(checkResult.ok, true);
  assert.equal(checkResult.production_d1, 'trinity-v03');
  assert.equal(checkResult.staging_d1, 'trinity-development');
});

test('Module 7: TAP Crypto Runtime (RSASSA-PKCS1-v1_5), ProfileMaker (#47) & Jericho123 Oracle/Vaults (#26)', async () => {
  const { TapKeyManager, TapTokenEngine, validateProfileInput } = await import('../../packages/contracts/src/tap.js');
  const tapProfileWorker = (await import('../../services/trinity-profile/src/index.js')).default;
  const jerichoWorker = (await import('../../services/jericho123/src/index.js')).default;

  // 1. Direct TAP KeyPair + JWT Sign & Verify
  const pair = await TapKeyManager.generateKeyPair();
  const pkcs8 = await TapKeyManager.exportKeyPkcs8(pair.privateKey);
  const spki = await TapKeyManager.exportKeySpki(pair.publicKey);
  const importedPriv = await TapKeyManager.importPrivateKey(pkcs8);
  const importedPub = await TapKeyManager.importPublicKey(spki);

  const jwt = await TapTokenEngine.sign({ sub: 'usr-1', usr: 'Basterix', rol: 'ring0_owner' }, importedPriv);
  const verifiedClaims = await TapTokenEngine.verify(jwt, importedPub);
  assert.equal(verifiedClaims.usr, 'Basterix');
  assert.equal(verifiedClaims.rol, 'ring0_owner');
  assert.equal(verifiedClaims.iss, 'trinity-ring0');
  assert.equal(verifiedClaims.aud, 'aura-fleet');

  assert.equal(validateProfileInput({ username: 'Basterix', email: 'saboivan2008@gmail.com', role: 'ring0_owner', permissions: ['RING0_ALL'] }), true);

  // 2. ProfileMaker (Worker #47) POST /profiles/create & POST /profiles/verify
  const kvStore = new Map();
  const dbProfiles = [];
  const dbVaults = [];
  const mockEnv = {
    ENVIRONMENT: 'staging',
    TRINITY_KV: {
      async get(k, opts) {
        const val = kvStore.get(k) ?? null;
        if (val && opts?.type === 'json') return JSON.parse(val);
        return val;
      },
      async put(k, v) {
        kvStore.set(k, v);
      }
    },
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async run() {
                if (sql.includes('INSERT INTO profiles')) dbProfiles.push(args);
                if (sql.includes('INSERT INTO tetrakis_vaults')) dbVaults.push(args);
                return { success: true };
              },
              async all() {
                return { results: [] };
              }
            };
          },
          async run() {
            return { success: true };
          }
        };
      },
      async batch(stmts) {
        for (const s of stmts) await s.run();
      }
    },
    customFetcher: async (url) => {
      const u = String(url);
      if (u.includes('binance.com')) {
        return new Response(JSON.stringify([
          { symbol: 'BTCUSDT', price: '92000.50' },
          { symbol: 'ETHUSDT', price: '3100.25' },
          { symbol: 'SOLUSDT', price: '195.80' }
        ]), { status: 200 });
      }
      if (u.includes('BTC-USD')) return new Response(JSON.stringify({ data: { amount: '92100.50' } }), { status: 200 });
      if (u.includes('ETH-USD')) return new Response(JSON.stringify({ data: { amount: '3110.25' } }), { status: 200 });
      if (u.includes('SOL-USD')) return new Response(JSON.stringify({ data: { amount: '196.20' } }), { status: 200 });
      return new Response('{}', { status: 404 });
    }
  };

  const createRes = await tapProfileWorker.fetch(
    new Request('https://aura.dev/profiles/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Basterix',
        email: 'saboivan2008@gmail.com',
        role: 'ring0_owner',
        permissions: ['RING0_ALL', 'OVERRIDE_KILLSWITCH']
      })
    }),
    mockEnv
  );
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.success, true);
  assert.equal(created.profile.role, 'ring0_owner');
  assert.ok(created.profile.permissions.includes('RING0_ALL'));
  assert.ok(created.token);

  const verifyRes = await tapProfileWorker.fetch(
    new Request('https://aura.dev/profiles/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${created.token}` }
    }),
    mockEnv
  );
  assert.equal(verifyRes.status, 200);
  const verifyBody = await verifyRes.json();
  assert.equal(verifyBody.valid, true);
  assert.equal(verifyBody.claims.usr, 'Basterix');
  assert.equal(verifyBody.claims.rol, 'ring0_owner');

  // 3. Jericho123 Consensus Crypto Oracle & Tetrakis Vault Deposit
  const oracleRes = await jerichoWorker.fetch(new Request('https://aura.dev/crypto/oracle'), mockEnv);
  assert.equal(oracleRes.status, 200);
  const oracleBody = await oracleRes.json();
  assert.equal(oracleBody.source, 'live_consensus');
  assert.equal(oracleBody.BTC, 92050.5);
  assert.equal(oracleBody.ETH, 3105.25);
  assert.equal(oracleBody.SOL, 196);
  assert.equal(oracleBody.TETRAKIS, 1.042);
  assert.equal(oracleBody.sources_count, 2);

  const depositRes = await jerichoWorker.fetch(
    new Request('https://aura.dev/crypto/tetrakis/vault/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: '0xBasterixSovereignVault',
        amount: 1000,
        profile_id: created.profile.id
      })
    }),
    mockEnv
  );
  assert.equal(depositRes.status, 200);
  const depositBody = await depositRes.json();
  assert.equal(depositBody.success, true);
  assert.equal(depositBody.deposited, 1000);
  assert.equal(dbVaults.length, 1);
});

test('Module 8: 6-Cluster 47-Worker Architecture & Worker #01 (trinity-gateway) Ring 0 TAP Gatekeeper', async () => {
  const { TapKeyManager, TapTokenEngine, verifyTapToken } = await import('../../packages/contracts/src/tap.js');
  const gatewayWorker = (await import('../../services/trinity-gateway/src/index.js')).default;
  const { getFleetClusterSummary } = await import('../src/fleet-clusters.js');

  // 1. Verify 6 clusters and 47 unique workers
  const clusterSummary = getFleetClusterSummary();
  assert.equal(clusterSummary.total_clusters, 6);
  assert.equal(clusterSummary.total_workers, 47);
  const workerNames = new Set(clusterSummary.clusters.flatMap((c) => c.workers.map((w) => w.name)));
  assert.equal(workerNames.size, 47);

  // 2. Verify TAP keypair + verifyTapToken
  const pair = await TapKeyManager.generateKeyPair();
  const pubB64 = await TapKeyManager.exportKeySpki(pair.publicKey);
  const validToken = await TapTokenEngine.sign({ sub: 'basterix-ring0', usr: 'Basterix', rol: 'ring0_owner' }, pair.privateKey);

  const checkOk = await verifyTapToken(validToken, pubB64);
  assert.equal(checkOk.valid, true);
  assert.equal(checkOk.payload.sub, 'basterix-ring0');

  const checkBad = await verifyTapToken(validToken + 'tampered', pubB64);
  assert.equal(checkBad.valid, false);

  // 3. Test Worker #01 (services/trinity-gateway/src/index.js)
  const auditEntries = [];
  let waitedAudit = null;
  const mockGatewayEnv = {
    ENVIRONMENT: 'production',
    TAP_PUBLIC_KEY: pubB64,
    AUDIT_DB: {
      prepare() {
        return {
          bind(...args) {
            return {
              async run() {
                auditEntries.push(args);
                return { success: true };
              }
            };
          }
        };
      }
    },
    INFERENCE_SERVICE: {
      async fetch() {
        return Response.json({ ok: true, service: 'trinity-chat-inference' });
      }
    },
    PROFILE_SERVICE: {
      async fetch() {
        return Response.json({ ok: true, service: 'trinity-profile' });
      }
    },
    JERICHO_SERVICE: {
      async fetch() {
        return Response.json({ ok: true, service: 'jericho123' });
      }
    }
  };
  const mockCtx = {
    waitUntil(p) {
      waitedAudit = p;
    }
  };

  // Health & Ping
  const pingRes = await gatewayWorker.fetch(new Request('https://aura.space/v1/ping'), mockGatewayEnv, mockCtx);
  assert.equal(pingRes.status, 200);
  const pingBody = await pingRes.json();
  assert.equal(pingBody.status, 'ONLINE');
  assert.equal(pingBody.worker, 'trinity-gateway');
  assert.equal(pingBody.ring, 0);

  // Missing token -> 401
  const unauthRes = await gatewayWorker.fetch(new Request('https://aura.space/api/chat', { method: 'POST' }), mockGatewayEnv, mockCtx);
  assert.equal(unauthRes.status, 401);

  // Invalid token -> 403
  const forbidRes = await gatewayWorker.fetch(
    new Request('https://aura.space/api/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}corrupt` }
    }),
    mockGatewayEnv,
    mockCtx
  );
  assert.equal(forbidRes.status, 403);

  // Valid Ring 0 TAP token -> 200 Service Binding route + non-blocking audit
  const chatRes = await gatewayWorker.fetch(
    new Request('https://aura.space/api/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${validToken}` }
    }),
    mockGatewayEnv,
    mockCtx
  );
  assert.equal(chatRes.status, 200);
  const chatBody = await chatRes.json();
  assert.equal(chatBody.service, 'trinity-chat-inference');
  await waitedAudit;
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0][3], 'basterix-ring0');
});

test('Module 9: DEV MODE (Zero Verification / Open Access) handleFastChat, executeInferenceCascade & /chat', async () => {
  const { handleFastChat } = await import('../src/fast-chat.js');
  const { executeInferenceCascade } = await import('../src/inference-cascade.js');
  const trinityWorker = (await import('../src/dev-gateway.js')).default;

  // 1. Direct handleFastChat
  const fastHit = handleFastChat('kto si?', { ENVIRONMENT: 'staging' });
  assert.equal(fastHit.handled, true);
  assert.match(fastHit.response, /Ivan Sabo \(Basterix/);

  // 2. Direct executeInferenceCascade SSE stream with pinned Ring 0 prompt
  const stream = await executeInferenceCascade(
    [{ role: 'user', content: 'Vysvetli architektúru' }],
    {
      AI: {
        async run(_model, payload) {
          assert.equal(payload.messages[0].role, 'system');
          assert.match(payload.messages[0].content, /Ivan Sabo \(Basterix/);
          return { response: 'Architektúra Trinity beží na Cloudflare Edge.' };
        }
      }
    }
  );
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let sseText = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sseText += dec.decode(value, { stream: true });
  }
  assert.match(sseText, /Architektúra Trinity beží na Cloudflare Edge/);

  // 3. Zero-verification POST /chat on Trinity index.js (Fast-Edge)
  const fastChatHttp = await trinityWorker.fetch(
    new Request('https://auru.dev/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '5+5' })
    }),
    { ENVIRONMENT: 'staging', STRICT_MODE: 'false' }
  );
  assert.equal(fastChatHttp.status, 200);
  assert.equal(fastChatHttp.headers.get('Access-Control-Allow-Origin'), '*');
  const fastChatBody = await fastChatHttp.json();
  assert.equal(fastChatBody.mode, 'fast-edge');
  assert.equal(fastChatBody.reply, 'Výsledok výpočtu: 10');

  // 4. Zero-verification POST /api/chat on Trinity index.js (SSE stream)
  const cascadeHttp = await trinityWorker.fetch(
    new Request('https://auru.dev/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Aký je plán?' }] })
    }),
    {
      ENVIRONMENT: 'staging',
      STRICT_MODE: 'false',
      AI: {
        async run() {
          return { response: 'Plán je 6 klastrov a 47 workerov.' };
        }
      }
    }
  );
  assert.equal(cascadeHttp.status, 200);
  assert.equal(cascadeHttp.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(cascadeHttp.headers.get('Content-Type') || '', /text\/event-stream/);
  const streamOut = await cascadeHttp.text();
  assert.match(streamOut, /Plán je 6 klastrov a 47 workerov/);
});

test('Module 10: Sovereign Monolith Tool Engine (execute_d1_sql, cloudflare_fleet_control, crypto_oracle_query, kv_memory_store)', async () => {
  const {
    PINNED_SYSTEM_PROMPT,
    TRINITY_TOOL_DEFINITIONS,
    handleFastEdgeRoute,
    executeTool,
    runInferenceCascade
  } = await import('../src/sovereign-monolith.js');
  const devGateway = (await import('../src/dev-gateway.js')).default;

  assert.equal(PINNED_SYSTEM_PROMPT.role, 'system');
  assert.match(PINNED_SYSTEM_PROMPT.content, /NULOVÁ FABRIKÁCIA A SIMULÁCIA/);
  assert.equal(TRINITY_TOOL_DEFINITIONS.length, 4);

  // 1. handleFastEdgeRoute
  assert.equal(handleFastEdgeRoute('12 * 8').text, 'Výsledok výpočtu: 96');
  assert.equal(handleFastEdgeRoute('kto je majiteľ?').handled, true);

  // 2. execute_d1_sql
  const kvMap = new Map();
  const mockEnv = {
    ENVIRONMENT: 'staging',
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async all() {
                return { results: [{ sql, params }], meta: { duration: 1 } };
              }
            };
          },
          async all() {
            return { results: [{ sql }], meta: { duration: 1 } };
          }
        };
      }
    },
    TRINITY_KV: {
      async get(k) { return kvMap.get(k) ?? null; },
      async put(k, v) { kvMap.set(k, v); },
      async delete(k) { kvMap.delete(k); }
    },
    customFetcher: async () =>
      new Response(
        JSON.stringify([
          { symbol: 'BTCUSDT', price: '93000.00' },
          { symbol: 'ETHUSDT', price: '3200.00' },
          { symbol: 'SOLUSDT', price: '200.00' }
        ]),
        { status: 200 }
      ),
    AI: {
      async run(_model, payload) {
        assert.equal(payload.messages[0].role, 'system');
        assert.equal(payload.tools.length, 4);
        return { response: 'Kaskáda s nástrojmi úspešná.' };
      }
    }
  };

  const d1Res = await executeTool('execute_d1_sql', { sql: 'SELECT * FROM profiles WHERE username = ?1', params: ['Basterix'] }, mockEnv);
  assert.equal(d1Res.status, 'SUCCESS');
  assert.equal(d1Res.rowCount, 1);

  // 3. cloudflare_fleet_control
  const cfRes = await executeTool('cloudflare_fleet_control', { worker_name: 'trinity-profile', operation: 'check_health' }, mockEnv);
  assert.equal(cfRes.status, 'SIMULATED_LOCAL');
  assert.equal(cfRes.worker, 'trinity-profile');

  // 4. crypto_oracle_query & GET /api/crypto/prices
  const pricesHttp = await devGateway.fetch(new Request('https://aura.dev/api/crypto/prices'), mockEnv);
  assert.equal(pricesHttp.status, 200);
  const pricesBody = await pricesHttp.json();
  assert.equal(pricesBody.oracle, 'jericho-edge');
  assert.equal(pricesBody.BTC_USD, 93000);
  assert.equal(pricesBody.TETRAKIS_USD, 1.042);

  // 5. kv_memory_store via POST /api/tools/execute
  const kvPutHttp = await devGateway.fetch(
    new Request('https://aura.dev/api/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'kv_memory_store',
        arguments: { action: 'put', key: 'ring0_state', value: 'LOCKED_ACTIVE', ttl_seconds: 60 }
      })
    }),
    mockEnv
  );
  assert.equal(kvPutHttp.status, 200);
  assert.equal((await kvPutHttp.json()).status, 'STORED');
  assert.equal(kvMap.get('ring0_state'), 'LOCKED_ACTIVE');

  // 6. runInferenceCascade with tools
  const stream = await runInferenceCascade([{ role: 'user', content: 'Skontroluj D1' }], mockEnv);
  const text = await new Response(stream).text();
  assert.match(text, /Kaskáda s nástrojmi úspešná/);
});




