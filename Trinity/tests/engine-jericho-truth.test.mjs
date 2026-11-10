import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgent } from '../src/engine.js';

test('Jericho outage is reported without a synthetic success receipt or treasury address', async () => {
  const result = await runAgent({
    JERICHO_SERVICE: {
      async executeWorkCycle() { throw new Error('private provider diagnostic'); }
    }
  }, 'orchestrator', 'Zisti stav Jericho a Tetrakis');

  assert.match(result.text, /Jericho momentálne neodpovedá/);
  assert.doesNotMatch(result.text, /private provider diagnostic|0x4d308452/);
  assert.deepEqual(result.tool_log, []);
});

test('Jericho response without a completed work ID remains unverified', async () => {
  const result = await runAgent({
    JERICHO_SERVICE: {
      async executeWorkCycle() { return { status: 'COMPLETED', summary: 'untrusted incomplete response' }; }
    }
  }, 'orchestrator', 'Zisti stav Jericho a Tetrakis');

  assert.match(result.text, /nevrátil potvrdenie dokončeného pracovného cyklu/);
  assert.deepEqual(result.tool_log, []);
});

test('Jericho successful result carries its actual work ID and no inferred treasury facts', async () => {
  const result = await runAgent({
    JERICHO_SERVICE: {
      async executeWorkCycle() {
        return {
          status: 'COMPLETED',
          work_id: 'jericho:actual-work-123',
          summary: 'Returned source result',
          treasury_addresses: { evm: '0x4d308452a96D7dAbFd2f33d92677A3a2724f387e' }
        };
      }
    }
  }, 'orchestrator', 'Zisti stav Jericho a Tetrakis');

  assert.match(result.text, /jericho:actual-work-123/);
  assert.match(result.text, /Nasadenie TTK, vlastníctvo treasury adresy ani uskutočnené prevody.*neboli overené/);
  assert.doesNotMatch(result.text, /0x4d308452/);
  assert.equal(result.tool_log[0]?.receipt_id, 'jericho:actual-work-123');
});
