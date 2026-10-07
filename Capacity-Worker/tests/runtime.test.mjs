import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const mf = new Miniflare(convertV4MiniflareOptions({ workers: [
  { name: 'capacity', compatibilityDate: '2026-10-01',
    modules: [{ type: 'ESModule', path: fileURLToPath(new URL('../dist/index.js', import.meta.url)) }],
    bindings: { DAILY_WORK_UNITS: '1000' },
    durableObjects: { CAPACITY: { className: 'CapacityLedger', useSQLite: true } } },
  { name: 'caller', compatibilityDate: '2026-10-01', modules: true,
    serviceBindings: { BUDGET: 'capacity' },
    script: `export default {async fetch(request,env){
      const {method,input}=await request.json();
      try {return Response.json(await env.BUDGET[method](input));}
      catch {return Response.json({error:'rejected'},{status:409});}
    }};` }
] }));
after(() => mf.dispose());
async function rpc(method, input) {
  const caller = await mf.getWorker('caller');
  return caller.fetch('https://internal/', { method: 'POST', body: JSON.stringify({ method, input }) });
}
async function data(method, input) { const response = await rpc(method, input); assert.equal(response.status, 200); return response.json(); }

test('real Worker runtime preserves reservations, accounting and retry receipts', async () => {
  const ids = Array.from({ length: 30 }, () => randomUUID());
  const permits = await Promise.all(ids.map(id => data('reserve', { id, units: 1 })));
  assert.ok(permits.every(p => p.allowed));
  assert.equal((await data('getStatus')).reserved, 30);
  const replay = await data('reserve', { id: ids[0], units: 1 });
  assert.equal(replay.reused, true);
  assert.equal((await data('getStatus')).reserved, 30);
  assert.equal((await rpc('reserve', { id: ids[0], units: 2 })).status, 409);
  await Promise.all(ids.map(id => data('settle', { id, actual_units: 2 })));
  const status = await data('getStatus');
  assert.equal(status.reserved, 0);
  assert.equal(status.spent, 60);
  assert.equal((await data('settle', { id: ids[0], actual_units: 2 })).reused, true);
  assert.equal((await rpc('settle', { id: ids[0], actual_units: 3 })).status, 409);
  assert.equal((await data('reserve', { id: ids[0], units: 1 })).allowed, false);
});

test('oversized reservations are denied without changing ledger', async () => {
  const before = await data('getStatus');
  const denial = await data('reserve', { id: randomUUID(), units: 950 });
  assert.equal(denial.allowed, false);
  assert.equal(denial.reason, 'budget_guard');
  assert.equal((await data('getStatus')).used, before.used);
});

test('unknown settlement and invalid reservation fail without releasing capacity', async () => {
  const before = await data('getStatus');
  assert.equal((await rpc('settle', { id: randomUUID(), actual_units: 0 })).status, 409);
  assert.equal((await rpc('reserve', { id: randomUUID(), units: -1 })).status, 409);
  assert.equal((await data('getStatus')).used, before.used);
});

test('actual overage is recorded and new work is paused', async () => {
  const id = randomUUID();
  assert.equal((await data('reserve', { id, units: 1 })).allowed, true);
  const receipt = await data('settle', { id, actual_units: 1000 });
  assert.equal(receipt.status.stage, 'paused');
  assert.equal(receipt.status.spent, 1060);
  assert.equal((await data('reserve', { id: randomUUID(), units: 1 })).reason, 'budget_guard');
});

test('HTTP does not expose RPC or status', async () => {
  assert.equal((await mf.dispatchFetch('https://internal/health')).status, 404);
});
