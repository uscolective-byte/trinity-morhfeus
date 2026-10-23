import {readFileSync} from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { provisionAgentDomain, listCustomAgents, executeCustomAgent, requireRealAgentReply } from '../src/agent-sandbox.js';
import { provisionDomainWithEnvironments } from '../src/domain-environments.js';
import { integrationReadiness } from '../src/integration-readiness.js';

function fakeDb() {
  const queries = [];
  return {
    queries,
    prepare(sql) {
      const q = {sql, params: []};
      queries.push(q);
      return {
        bind(...params) { q.params = params; return this; },
        async first() { return sql.includes('SELECT id FROM ops_custom_agents') ? {id: 'agent-one'} : null; },
        async all() { return {results: []}; },
        async run() { return {success: true}; }
      };
    }
  };
}

test('agent listing fails closed instead of inventing an agent when D1 is missing', async () => {
  await assert.rejects(listCustomAgents({}), /D1 databáza nie je dostupná/);
});

test('agent domain does not pretend to register, create DNS, deploy SSL, or enable WAF', async () => {
  const db = fakeDb();
  const oldFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({url: String(url), method: init.method || 'GET'});
    return Response.json({success: true, result: [{name: 'agent.example.com', id: 'real-zone'}]});
  };
  try {
    const r = await provisionAgentDomain({DB: db, CF_API_TOKEN: 'test-token'}, 'owner', {
      agent_id: 'agent-one', domain_name: 'agent.example.com', target_worker: 'trinity-development'
    });
    assert.equal(r.zone_id, 'real-zone');
    assert.equal(r.status, 'zone_found_dns_not_configured');
    assert.equal(r.registered, false);
    assert.equal(r.deployed, false);
    assert.equal(r.ssl_verified, false);
    assert.equal(r.waf_verified, false);
    assert.equal(r.dns_configured, false);
    assert.equal(r.endpoint, null);
    assert.deepEqual(r.dns_records, []);
    assert.deepEqual(calls.map(c => c.method), ['GET']);
    assert.ok(calls[0].url.startsWith('https://api.cloudflare.com/client/v4/zones?name='));
    assert.ok(db.queries.every(q => !/192\\.0\\.2\\.1/.test(q.sql)));
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('an unauthorized agent cannot be assigned a domain', async () => {
  const db = fakeDb();
  db.prepare = () => ({
    bind() {return this;},
    async run() {return {success:true};},
    async first() {return null;}
  });
  await assert.rejects(provisionAgentDomain({DB: db}, 'owner', {
    agent_id: 'missing', domain_name: 'safe.example.com'
  }), /neexistuje/);
});

test('fake root A DNS record is rejected before creating any domain data', async () => {
  await assert.rejects(provisionDomainWithEnvironments({}, 'owner', {
    domain_name: 'example.com', auto_create_dns: true
  }), /Automatické DNS bez overeného cieľa/);
});

test('integration readiness never leaks secrets or reports a configured integration as verified', () => {
  const secret = 'not-for-public-output-supersecret';
  const r = integrationReadiness({}, {
    GOOGLE_ENABLED: 'true',
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: secret,
    GOOGLE_REDIRECT_URI: 'https://auru.space/auth/google/callback',
    CF_ACCOUNT_ID: 'account-id',
    CF_API_TOKEN: secret,
    TELEGRAM_BOT_TOKEN: secret,
    TELEGRAM_CHAT_ID: '123456'
  });
  const byId = Object.fromEntries(r.items.map(x => [x.id, x]));
  assert.equal(r.live_verified, false);
  assert.equal(byId['google-oauth'].status, 'configured_unverified');
  assert.equal(byId['cloudflare-registrar'].status, 'configured_unverified');
  assert.equal(byId['telegram-notifications'].status, 'configured_unverified');
  assert.equal(byId['paypal-verified-payments'].status, 'needs_configuration');
  assert.equal(byId['revolut-verified-payments'].status, 'needs_configuration');
  assert.ok(!JSON.stringify(r).includes(secret));
});

test('agent execution fails closed when D1 is unavailable', async () => {
  await assert.rejects(executeCustomAgent({}, 'owner', {
    agent_id: 'agent-one', input: 'test'
  }), /D1 databáza nie je dostupná/);
});

test('agent execution does not invent an agent for a different owner', async () => {
  const env = {DB: fakeDb()};
  await assert.rejects(executeCustomAgent(env, 'owner-b', {
    agent_id: 'agent-one', input: 'test'
  }), /neexistuje/);
});

test('AI reply guard refuses empty or invented fallbacks', () => {
  assert.equal(requireRealAgentReply({text: ' Done. '}), 'Done.');
  for (const value of [null, undefined, {}, {text:''}, {text:'  '}, {output:'No real response'}]) {
    assert.throws(() => requireRealAgentReply(value), /nevrátil platný výsledok/);
  }
});

test('Trinity 11 UI keeps all routes and unique DOM identifiers', () => {
  const html = readFileSync(new URL('../public/assistant/chat.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../public/assistant/chat.js.txt', import.meta.url), 'utf8');
  const ids = Array.from(html.matchAll(/\\bid="([^"]+)"/g), m => m[1]);
  assert.equal(ids.length, new Set(ids).size, 'duplicate HTML IDs break event handlers');
  const routes = [...new Set(Array.from(html.matchAll(/data-view="([^"]+)"/g), m => m[1]))];
  for (const route of routes) assert.ok(html.includes(`id="${route}-view"`), `missing view: ${route}`);
  for (const required of ['agentlab','workflows','wallet','studio','chat']) {
    assert.ok(routes.includes(required), `Trinity 11 route hidden: ${required}`);
  }
  assert.ok(script.includes('initAgentLabEvents()'), 'AI Agent Lab wiring must remain');
  assert.ok(!html.includes('1,000,000 TRNT'), 'token amount cannot be hard-coded as live');
});
