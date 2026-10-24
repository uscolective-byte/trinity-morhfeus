import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('Jericho Worker: /health returns 200 and valid JSON', async () => {
  const req = new Request('https://jericho123.auru.space/health');
  const env = { SERVICE_NAME: 'Jericho123', VERSION: '1.0.0', ENVIRONMENT: 'production' };
  const res = await worker.fetch(req, env, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.service, 'Jericho123');
  assert.equal(data.status, 'ready');
  assert.ok(Array.isArray(data.domains));
  assert.ok(data.domains.includes('jericho123.auru.space'));
  assert.ok(data.domains.includes('jericho123.auru.dev'));
});

test('Jericho Worker: /api/status returns operational metrics', async () => {
  const req = new Request('https://jericho123.auru.space/api/status');
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'operational');
  assert.equal(data.node.provider, 'Cloudflare Edge');
});

test('Jericho Worker: /api/ping responds with pong', async () => {
  const req = new Request('https://jericho123.auru.space/api/ping', { method: 'POST' });
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.pong, true);
});

test('Jericho Worker: /api/prices returns live crypto market data', async () => {
  const req = new Request('https://jericho123.auru.space/api/prices');
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.prices);
  assert.ok(data.prices.BTC);
  assert.ok(data.prices.ETH);
  assert.ok(data.prices.SOL);
});

test('Jericho Worker: /api/signals returns market sentiment and signals', async () => {
  const req = new Request('https://jericho123.auru.space/api/signals');
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.sentiment);
  assert.ok(Array.isArray(data.signals));
});

test('Jericho Worker: /api/treasury returns derived treasury wallets', async () => {
  const req = new Request('https://jericho123.auru.space/api/treasury');
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.evm_address.startsWith('0x'));
  assert.equal(data.chains_status.evm, 'ACTIVE_DEPLOYED_TREASURY');
  assert.equal(data.solana_address, null);
  assert.equal(data.bitcoin_address, null);
});

test('Jericho Worker: /api/yields returns DeFi vaults', async () => {
  const req = new Request('https://jericho123.auru.space/api/yields');
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.vaults));
  assert.ok(data.vaults.length > 0);
});

test('Jericho Worker: /api/work executes an autonomous work cycle', async () => {
  const req = new Request('https://jericho123.auru.space/api/work', { method: 'POST' });
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.agent, 'Jericho123');
  assert.equal(data.status, 'COMPLETED');
  assert.ok(data.top_actions);
  assert.ok(data.treasury_addresses);
});

test('Jericho Worker: / renders HTML landing page', async () => {
  const req = new Request('https://jericho123.auru.space/');
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('text/html'));
  const html = await res.text();
  assert.ok(html.includes('JERICHO 123'));
  assert.ok(html.includes('jericho123.auru.space'));
  assert.ok(html.includes('jericho123.auru.dev'));
});

test('Jericho Worker: /api/tetrakis returns token specifications and wallet readiness', async () => {
  const req = new Request('https://jericho123.auru.space/api/tetrakis');
  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.token.name, 'Tetrakis');
  assert.equal(data.token.symbol, 'TTK');
  assert.equal(data.ready_for_deployment, true);
  assert.ok(data.treasury_address.startsWith('0x'));
});

test('Jericho Worker: RPC interface methods respond correctly', async () => {
  const s = await worker.status();
  assert.equal(s.service, 'Jericho123');
  assert.equal(s.ready, true);
  const p = await worker.ping();
  assert.equal(p.pong, true);
  const prices = await worker.getPrices();
  assert.ok(prices.BTC);
  const signals = await worker.getSignals();
  assert.ok(signals.sentiment);
  const treasury = await worker.getTreasury();
  assert.ok(treasury.evm_address.startsWith('0x'));
});
