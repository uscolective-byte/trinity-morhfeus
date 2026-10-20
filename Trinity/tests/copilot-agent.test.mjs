import {test} from 'node:test';
import assert from 'node:assert/strict';
import {skills, skillRegistry} from '../src/skillRegistry.js';
import {copilotPluginRegistry, BUILTIN_COPILOT_PLUGINS} from '../src/copilot-plugins.js';
import {TrinityCopilotAgent} from '../src/copilot-agent.js';

// Mock D1 databáza pre testy
function createMockDB() {
  const auditLogs = [];
  const events = [];
  const sessions = new Map();
  const limits = new Map();
  const genericTables = new Map();

  return {
    auditLogs,
    events,
    sessions,
    limits,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args;
          return this;
        },
        async first() {
          if (sql.includes('FROM copilot_sessions WHERE session_id=?')) {
            const sid = this._params[0];
            return sessions.has(sid) ? { history: sessions.get(sid) } : null;
          }
          if (sql.includes('FROM ops_limits WHERE key=?')) {
            const key = this._params[0];
            return limits.has(key) ? { count: limits.get(key) } : null;
          }
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          if (sql.includes('INSERT INTO audit')) {
            auditLogs.push({
              level: this._params[0],
              message: this._params[1],
              details: this._params[2]
            });
            return { success: true };
          }
          if (sql.includes('INSERT INTO ops_events')) {
            events.push({
              action: this._params[0],
              details: this._params[1]
            });
            return { success: true };
          }
          if (sql.includes('INSERT INTO copilot_sessions')) {
            sessions.set(this._params[0], this._params[1]);
            return { success: true };
          }
          if (sql.includes('DELETE FROM copilot_sessions')) {
            sessions.delete(this._params[0]);
            return { success: true };
          }
          if (sql.includes('INSERT INTO ops_limits')) {
            const key = this._params[0];
            const current = limits.get(key) || 0;
            limits.set(key, current + 1);
            return { success: true };
          }
          return { success: true };
        }
      };
    }
  };
}

// Mock KV úložisko
function createMockKV() {
  const store = new Map();
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    }
  };
}

// ─────────────────────────────────────────────────────────────
// 1️⃣ CORE SKILLS TESTY
// ─────────────────────────────────────────────────────────────

test('Core Skill: validateInput overí dotaz a parametre', () => {
  // Platný vstup
  const res = skills.validateInput('Ahoj Trinity', { maxResults: 5 });
  assert.equal(res.valid, true);
  assert.equal(res.query, 'Ahoj Trinity');

  // Prázdny alebo neplatný vstup
  assert.throws(() => skills.validateInput(''), /non-empty string/);
  assert.throws(() => skills.validateInput('   '), /non-empty string/);
  assert.throws(() => skills.validateInput(null), /non-empty string/);
  assert.throws(() => skills.validateInput(123), /non-empty string/);
  assert.throws(() => skills.validateInput('test', { maxResults: -1 }), /positive number/);
  assert.throws(() => skills.validateInput('test', { timeoutMs: 100 }), /at least 500ms/);
});

test('Core Skill: withTimeout zabráni nekonečnému čakaniu a rešpektuje signal', async () => {
  // Úspešná rýchla funkcia
  const fast = await skills.withTimeout(async () => 'hotovo', 1000);
  assert.equal(fast, 'hotovo');

  // Funkcia, ktorá prekročí timeout
  await assert.rejects(
    skills.withTimeout(new Promise(r => setTimeout(r, 200)), 50),
    /timed out after 50ms/
  );

  // Externý abort signal
  const extController = new AbortController();
  setTimeout(() => extController.abort(), 20);
  await assert.rejects(
    skills.withTimeout(new Promise(r => setTimeout(r, 500)), 1000, extController.signal),
    /aborted/
  );
});

test('Core Skill: checkHttpStatus zachytáva 4xx a 5xx chyby', async () => {
  const okResp = new Response('OK', { status: 200 });
  assert.equal(await skills.checkHttpStatus(okResp), okResp);

  const notFoundResp = new Response('Not Found', { status: 404 });
  await assert.rejects(skills.checkHttpStatus(notFoundResp), /HTTP 404: Not Found/);

  const errorResp = new Response('Server Error', { status: 503 });
  await assert.rejects(skills.checkHttpStatus(errorResp), /HTTP 503: Server Error/);
});

test('Core Skill: checkResponseStructure overuje prítomnosť požadovaných polí', () => {
  const data = { response: 'Ahoj', status: 'ok', count: 1 };
  assert.equal(skills.checkResponseStructure(data, ['response', 'status']), data);

  assert.throws(() => skills.checkResponseStructure(null), /expected an object/);
  assert.throws(() => skills.checkResponseStructure(data, ['missingField']), /Missing required response field: 'missingField'/);
});

test('Core Skill: logAudit zaznamenáva logy do konzoly aj D1 audit tabuľky', async () => {
  const mockDB = createMockDB();
  const env = { DB: mockDB };

  const logged = await skills.logAudit(env, 'info', 'Operácia úspešná', { step: 1 });
  assert.equal(logged.logged, true);
  assert.equal(mockDB.auditLogs.length, 1);
  assert.equal(mockDB.auditLogs[0].level, 'info');
  assert.equal(mockDB.auditLogs[0].message, 'Operácia úspešná');
  assert.match(mockDB.auditLogs[0].details, /"step":1/);
});

test('Core Skill: withRetry opakuje požiadavku s exponenciálnym backoffom', async () => {
  let attempts = 0;
  const flakeyFn = async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error('HTTP 503 Service Unavailable');
    }
    return 'uspech';
  };

  const res = await skills.withRetry(flakeyFn, [], 3, 10);
  assert.equal(res, 'uspech');
  assert.equal(attempts, 3);

  // Trvalá chyba 404 sa neopakuje
  let fatalAttempts = 0;
  const fatalFn = async () => {
    fatalAttempts++;
    throw new Error('HTTP 404 Not Found');
  };
  await assert.rejects(skills.withRetry(fatalFn, [], 3, 10), /HTTP 404/);
  assert.equal(fatalAttempts, 1);
});

test('Core Skill: circuitBreaker chráni backend pred preťažením', async () => {
  const env = { CB_STATE: createMockKV() };
  const serviceKey = 'test-service-' + Date.now();

  // Reset do čistého stavu
  await skills.circuitBreaker.reset(serviceKey, env);

  // 1. Zlyhanie pod prahom
  let fails = 0;
  const failFn = async () => {
    fails++;
    throw new Error('Chyba backendu');
  };

  for (let i = 0; i < 2; i++) {
    await assert.rejects(
      skills.circuitBreaker.execute(serviceKey, failFn, env, { threshold: 2, cooldownMs: 200 }),
      /Chyba backendu/
    );
  }

  // Teraz je circuit breaker OPEN
  await assert.rejects(
    skills.circuitBreaker.execute(serviceKey, async () => 'ok', env, { threshold: 2, cooldownMs: 200 }),
    /Circuit-breaker is OPEN/
  );

  // Po cooldown timeout sa prepne na HALF_OPEN a po úspechu na CLOSED
  await new Promise(r => setTimeout(r, 220));
  const recovered = await skills.circuitBreaker.execute(serviceKey, async () => 'obnovene', env, { threshold: 2, cooldownMs: 200 });
  assert.equal(recovered, 'obnovene');
});

test('Core Skill: rateLimiter obmedzuje počet požiadaviek za časové okno', async () => {
  const env = { RATE_LIMIT: createMockKV() };
  const key = 'test-user-' + Date.now();

  const r1 = await skills.rateLimiter(key, env, { limit: 2, windowSeconds: 60 });
  assert.equal(r1.allowed, true);
  const r2 = await skills.rateLimiter(key, env, { limit: 2, windowSeconds: 60 });
  assert.equal(r2.allowed, true);

  // 3. požiadavka prekročí limit 2
  await assert.rejects(
    skills.rateLimiter(key, env, { limit: 2, windowSeconds: 60 }),
    /Rate limit exceeded/
  );
});

test('Core Skill: cacheGet a cachePut pracujú s KV a in-memory zálohou', async () => {
  const env = { CACHE: createMockKV() };
  const key = 'cache:test:' + Date.now();

  assert.equal(await skills.cacheGet(key, env), null);
  await skills.cachePut(key, { odpoved: 'vyborná' }, env, 60);

  const cached = await skills.cacheGet(key, env);
  assert.deepEqual(cached, { odpoved: 'vyborná' });
});

test('Core Skill: recordMetrics zapisuje metriky', () => {
  const metricLog = [];
  const env = {
    METRICS: {
      increment(name, val) { metricLog.push({ name, val, type: 'increment' }); },
      timing(name, ms) { metricLog.push({ name, ms, type: 'timing' }); }
    }
  };

  skills.recordMetrics(env, 'agent.success', 1);
  skills.recordMetrics(env, 'agent.latency', 120, 'timing');

  assert.equal(metricLog.length, 2);
  assert.equal(metricLog[0].name, 'agent.success');
  assert.equal(metricLog[1].ms, 120);
});

// ─────────────────────────────────────────────────────────────
// 2️⃣ INTEGRATION SKILLS TESTY
// ─────────────────────────────────────────────────────────────

test('Integration Skill: callPowerPlatform spracuje Copilot Studio odpoveď', async () => {
  // Mock režim
  const mockResult = await skills.callPowerPlatform('Ako optimalizovať proces?', {}, { mock: true });
  assert.ok(Array.isArray(mockResult.conversations));
  assert.match(mockResult.conversations[0].reply, /Power Platform Demo/);

  // Test chýbajúcej URL
  await assert.rejects(
    skills.callPowerPlatform('Dotaz bez URL', {}),
    /POWER_PLATFORM_URL nie je nakonfigurovaná/
  );
});

test('Integration Skill: analyzeText analyzuje štatistiku textu, entity a sentiment', () => {
  const text = 'Výborná správa! Trinity projekt bol úspešne dokončený dňa 2026-10-18. Napíš na ivan@example.com alebo pozri https://auru.space pre detaily.';
  const res = skills.analyzeText(text);

  assert.ok(res.words > 10);
  assert.ok(res.characters > 50);
  assert.equal(res.sentences, 3);
  assert.deepEqual(res.entities.emails, ['ivan@example.com']);
  assert.deepEqual(res.entities.urls, ['https://auru.space']);
  assert.deepEqual(res.entities.dates, ['2026-10-18']);
  assert.equal(res.sentiment.label, 'positive');
  assert.ok(res.sentiment.positive_signals > 0);
});

test('Integration Skill: calculate a statistics vykonávajú presnú matematiku', () => {
  assert.equal(skills.calculate('add', [10, 20, 30]), 60);
  assert.equal(skills.calculate('subtract', [50, 20, 10]), 20);
  assert.equal(skills.calculate('multiply', [2, 3, 4]), 24);
  assert.equal(skills.calculate('divide', [100, 4]), 25);
  assert.throws(() => skills.calculate('divide', [10, 0]), /Delenie nulou/);

  const stats = skills.statistics([10, 20, 30, 40, 50], 50);
  assert.equal(stats.mean, 30);
  assert.equal(stats.median, 30);
  assert.equal(stats.min, 10);
  assert.equal(stats.max, 50);
});

test('Integration Skill: pcRunScript overuje SHA-256 a podporuje mock beh', async () => {
  const res = await skills.pcRunScript('node -v', {}, { mock: true });
  assert.equal(res.success, true);
  assert.equal(res.command, 'node -v');
  assert.match(res.sha256, /^[a-f0-9]{64}$/);
});

// ─────────────────────────────────────────────────────────────
// 3️⃣ USER SKILLS TESTY
// ─────────────────────────────────────────────────────────────

test('User Skill: dialogManagement ukladá a načítava históriu konverzácie', async () => {
  const mockDB = createMockDB();
  const env = { DB: mockDB };
  const sessionId = 'session-test-' + Date.now();

  assert.deepEqual(await skills.dialogManagement.getContext(sessionId, env), []);

  await skills.dialogManagement.saveContext(sessionId, [
    { role: 'user', content: 'Otázka 1' },
    { role: 'assistant', content: 'Odpoveď 1' }
  ], env);

  const loaded = await skills.dialogManagement.getContext(sessionId, env);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].content, 'Otázka 1');

  await skills.dialogManagement.clearSession(sessionId, env);
  assert.deepEqual(await skills.dialogManagement.getContext(sessionId, env), []);
});

test('User Skill: detectLanguage rozpoznáva jazyky a nastavuje direktívu', () => {
  assert.equal(skills.detectLanguage('Ahoj Trinity, ako sa máš dnes?'), 'sk');
  assert.equal(skills.detectLanguage('What is the current system status and memory state?'), 'en');
  assert.equal(skills.detectLanguage('Wie ist der aktuelle Zustand des Systems?'), 'de');

  const multi = skills.multilingualSupport('Ahoj', 'en');
  assert.match(multi.directive, /Answer naturally, clearly and fluently in language code: en/);
});

test('User Skill: fallbackHandler vracia nápomocnú odpoveď a návrhy otázok', () => {
  const fbSk = skills.fallbackHandler('Ako nakonfigurovať cloud?', new Error('Timeout backendu'));
  assert.equal(fbSk.type, 'fallback');
  assert.match(fbSk.content, /Prepáč/);
  assert.equal(fbSk.suggestions.length, 3);

  const fbEn = skills.fallbackHandler('How to setup the cloud?', new Error('Service down'));
  assert.match(fbEn.content, /I apologize/);
  assert.equal(fbEn.suggestions.length, 3);
});

test('User Skill: formatRichResponse vytvára formátovaný JSON výstup', () => {
  const md = skills.formatRichResponse('markdown', '## Nadpis\nText');
  assert.equal(md.type, 'markdown');
  assert.equal(md.content, '## Nadpis\nText');
  assert.ok(md.metadata.timestamp);

  const tbl = skills.formatRichResponse('table', [{ id: 1, name: 'Test' }]);
  assert.equal(tbl.type, 'table');
});

test('User Skill: securitySanitise odstraňuje XSS, SQL injection a maskuje tokeny', () => {
  // XSS
  const dirty = '<script>alert("hack")</script>Hello <iframe src="evil"></iframe><div onclick="bad()">Click</div>';
  const clean = skills.securitySanitise.sanitizeHtml(dirty);
  assert.equal(clean.includes('<script>'), false);
  assert.equal(clean.includes('<iframe'), false);
  assert.equal(clean.includes('onclick'), false);

  // SQL injection
  assert.equal(skills.securitySanitise.detectSqlInjection("admin' OR 1=1; DROP TABLE users;--"), true);
  assert.equal(skills.securitySanitise.detectSqlInjection("Ako sa máš dnes?"), false);

  // Redaction
  const secretText = 'Moje heslo password="superSecret123" a token sk-1234567890abcdef123456789';
  const redacted = skills.securitySanitise.redactSensitive(secretText);
  assert.match(redacted, /\[REDACTED_TOKEN\]/);
  assert.match(redacted, /password=\[REDACTED\]/);
});

// ─────────────────────────────────────────────────────────────
// 4️⃣ SKILL REGISTRY & PLUGIN REGISTRY TESTY
// ─────────────────────────────────────────────────────────────

test('SkillRegistry umožňuje dynamické pridávanie a spúšťanie skillov', async () => {
  skillRegistry.register('customEcho', (msg) => `ECHO: ${msg}`, { author: 'Ivan' });
  assert.equal(skillRegistry.has('customEcho'), true);
  assert.equal(await skillRegistry.execute('customEcho', 'Test'), 'ECHO: Test');

  const list = skillRegistry.list();
  assert.ok(list.some(s => s.name === 'customEcho' && s.type === 'custom'));
  assert.ok(list.some(s => s.name === 'validateInput' && s.type === 'builtin'));
});

test('CopilotPluginRegistry spravuje vstavané aj vlastné pluginy', () => {
  const plugins = copilotPluginRegistry.list();
  assert.ok(plugins.length >= 7);
  assert.ok(plugins.some(p => p.id === 'core-copilot' && p.required));
  assert.ok(plugins.some(p => p.id === 'powerplatform-connector'));
  assert.ok(plugins.some(p => p.id === 'data-analytics'));

  // Nemožno vypnúť povinný plugin
  assert.throws(() => copilotPluginRegistry.disable('core-copilot'), /nie je možné vypnúť/);

  // Vypnutie a zapnutie voliteľného pluginu
  copilotPluginRegistry.disable('web-researcher');
  assert.equal(copilotPluginRegistry.get('web-researcher').enabled, false);
  copilotPluginRegistry.enable('web-researcher');
  assert.equal(copilotPluginRegistry.get('web-researcher').enabled, true);
});

// ─────────────────────────────────────────────────────────────
// 5️⃣ TRINITY COPILOT AGENT KOMPLETNÝ INTEGRAČNÝ TEST
// ─────────────────────────────────────────────────────────────

test('TrinityCopilotAgent isolates dialogue and never caches contextual answers', async () => {
  const mockDB = createMockDB();
  const mockKV = createMockKV();
  const env = {
    DB: mockDB,
    CACHE: mockKV,
    RATE_LIMIT: createMockKV()
  };

  const sessionId = 'copilot-test-session-' + Date.now();
  const query = 'Ako začať s Trinity a nastaviť skilly?';

  // 1. Prvé volanie
  const res1 = await TrinityCopilotAgent(query, env, { userId:'owner-a',sessionId, noCache: false });
  assert.equal(res1.cached, false);
  assert.ok(res1.duration_ms >= 0);
  assert.ok(res1.request_id);
  assert.equal(res1.session_id, sessionId);
  assert.equal(res1.type, 'markdown');
  assert.ok(res1.content);

  // Overenie uloženia do auditu D1
  assert.ok(mockDB.auditLogs.some(log => log.message.includes('Agent called')));

  // Overenie uloženia do histórie dialógu
  const sessionHistory = JSON.parse([...mockDB.sessions.values()][0]);
  assert.equal(sessionHistory.length, 2);
  assert.equal(sessionHistory[0].content, query);

  // Contextual replies must see the updated history instead of a cached response.
  const res2 = await TrinityCopilotAgent(query, env, { userId:'owner-a',sessionId, noCache: false });
  assert.equal(res2.cached, false);
  assert.deepEqual(res2.content, res1.content);
  assert.equal(JSON.parse([...mockDB.sessions.values()][0]).length,4);
});

test('TrinityCopilotAgent spracuje Power Platform volanie s fallbackom pri nedostupnosti', async () => {
  const mockDB = createMockDB();
  const env = { DB: mockDB };

  // Volanie s mock Power Platform
  const resPower = await TrinityCopilotAgent('Skontroluj stav objednávky', env, {
    usePowerPlatform: true,
    mock: true
  });
  assert.equal(resPower.provider, 'power-platform');
  assert.match(JSON.stringify(resPower.content), /Power Platform Demo/);

  // Volanie s chybou a fallbackom
  const resFallback = await TrinityCopilotAgent('Neexistujúca služba', env, {
    usePowerPlatform: true,
    mock: false,
    enableFallback: true,
    retries: 0
  });
  assert.equal(resFallback.provider, 'fallback');
  assert.equal(resFallback.type, 'fallback');
  assert.ok(Array.isArray(resFallback.suggestions));
});

test('Microsoft Dataverse / Dynamics 365 Dataverse skills pracujú korektne', async () => {
  const env = {
    DATAVERSE_URL: 'https://org35ccf923.crm17.dynamics.com'
  };

  // 1. WhoAmI
  const whoami = await skills.dataverseWhoAmI(env, { mock: true });
  assert.equal(whoami.instance_url, 'https://org35ccf923.crm17.dynamics.com');
  assert.equal(whoami.organization_id, '8659177c-c9ca-f111-be88-00224874567f');
  assert.equal(whoami.environment_id, '263ab070-afaa-ebda-a227-c1f465562341');

  // 2. Query
  const queryRes = await skills.dataverseQuery('accounts', { $top: 5, $select: 'name,accountnumber' }, env, { mock: true });
  assert.equal(queryRes.entitySet, 'accounts');
  assert.ok(Array.isArray(queryRes.value));
  assert.equal(queryRes.count, 2);

  // 3. Create, Update, Delete CRUD
  const created = await skills.dataverseCreateRecord('contacts', { firstname: 'Ivan', lastname: 'Trinity' }, env, { mock: true });
  assert.ok(created.id);
  assert.equal(created.firstname, 'Ivan');

  const updated = await skills.dataverseUpdateRecord('contacts', created.id, { telephone1: '+421900000000' }, env, { mock: true });
  assert.equal(updated.updated, true);
  assert.equal(updated.telephone1, '+421900000000');

  const deleted = await skills.dataverseDeleteRecord('contacts', created.id, env, { mock: true });
  assert.equal(deleted.deleted, true);

  // 4. Overenie cez SkillRegistry a TrinityCopilotAgent
  assert.ok(skillRegistry.has('dataverseWhoAmI'));
  const regWhoami = await skillRegistry.execute('dataverseWhoAmI', env, { mock: true });
  assert.equal(regWhoami.organization_id, '8659177c-c9ca-f111-be88-00224874567f');

  const mockDB = createMockDB();
  const agentRes = await TrinityCopilotAgent('Over stav Dynamics 365', { DB: mockDB, ...env }, {
    skill: 'dataverseWhoAmI',
    mock: true
  });
  assert.equal(agentRes.provider, 'skill:dataverseWhoAmI');
  assert.equal(agentRes.content.organization_id, '8659177c-c9ca-f111-be88-00224874567f');
});

test('Gemini developer skills never fabricate execution evidence', async () => {
  assert.ok(copilotPluginRegistry.get('gemini-developer-pack'));
  const status = await skills.geminiDevStatus({ TRINITY_ENV: 'production' });
  assert.equal(status.connected, false);
  assert.equal(status.environment, 'production');
  assert.equal(status.status, 'not_connected');
  const command = await skills.geminiDevRunCommand('npm test');
  assert.equal(command.success, false);
  assert.equal(command.executed, false);
  assert.equal(command.exitCode, undefined);
  const file = await skills.geminiDevFileInspect('src/index.js');
  assert.equal(file.success, false);
  assert.equal(file.inspected, false);
  assert.equal(file.content, undefined);
  const deploy = await skills.geminiDevDeploy('production', 'abc1234');
  assert.equal(deploy.success, false);
  assert.equal(deploy.deployed, false);
});

test('AI Studio skills sú zaregistrované a bezpečne zlyhajú bez D1', async () => {
  assert.ok(copilotPluginRegistry.isSkillEnabled('aiStudioBuild'));
  assert.ok(copilotPluginRegistry.isSkillEnabled('aiStudioRevise'));
  assert.ok(copilotPluginRegistry.isSkillEnabled('aiStudioList'));
  const res = await skillRegistry.execute('aiStudioBuild', { prompt: 'Vytvor jednoduchy web' }, {});
  assert.equal(res.success, false);
  assert.match(res.error, /D1/);
});


test('copilotStudioAsk prejde Direct Line tok a nikdy nevráti tajný kód', async () => {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method, auth: init.headers?.Authorization });
    const u = String(url);
    const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (u.endsWith('/tokens/generate')) return json({ token: 'tok-1' });
    if (u.endsWith('/v3/directline/conversations')) return json({ conversationId: 'c1', token: 'tok-2' });
    if (init.method === 'POST' && u.includes('/activities')) return json({ id: 'c1|1' });
    if (u.includes('/activities')) return json(u.includes('watermark=') ? { watermark: '2', activities: [] } : { watermark: '2', activities: [{ type: 'message', from: { id: 'bot' }, text: 'Ahoj z Copilot Studio' }] });
    return new Response('nope', { status: 404 });
  };
  try {
    const res = await skills.copilotStudioAsk({ query: 'Ahoj' }, { COPILOT_STUDIO_SECRET: 'tajny-test-kod' }, { pollMs: 5, timeoutMs: 3000 });
    assert.equal(res.success, true);
    assert.deepEqual(res.replies, ['Ahoj z Copilot Studio']);
    assert.ok(!JSON.stringify(res).includes('tajny-test-kod'));
    assert.equal(calls[0].auth, 'Bearer tajny-test-kod');
    assert.equal(calls[1].auth, 'Bearer tok-1');
    const missing = await skills.copilotStudioAsk({ query: 'Ahoj' }, {});
    assert.equal(missing.success, false);
    assert.match(missing.error, /COPILOT_STUDIO_SECRET/);
    assert.ok(copilotPluginRegistry.isSkillEnabled('copilotStudioAsk'));
  } finally {
    globalThis.fetch = realFetch;
  }
});
