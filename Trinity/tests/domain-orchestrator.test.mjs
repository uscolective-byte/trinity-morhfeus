import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDomainOrchestration, STRATEGIC_TARGET_DOMAINS } from '../src/tools/domain-orchestrator.js';

test('Domain Orchestrator: generates 10 strategic domains with DNS and escrow', async () => {
  const managedDomains = new Map();
  const dnsRecords = [];
  const escrowDeals = [];
  const receipts = [];

  const mockDb = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (sql.includes('INSERT INTO managed_domains')) {
                const [id, domain_name, notes, sale_price] = args;
                managedDomains.set(domain_name, { id, domain_name, notes, sale_price, status: 'STAGING_RESERVE' });
              } else if (sql.includes('INSERT INTO domain_dns_records')) {
                const [id, domain_id, name, content] = [args[0], args[1], args[2] || '@', args[3] || 'auru.space'];
                dnsRecords.push({ id, domain_id, name, content });
              } else if (sql.includes('INSERT INTO domain_escrow_deals')) {
                const [id, domain_id, domain_name, amount, notes, status] = [args[0], args[1], args[2], args[3], args[4], args[5]];
                escrowDeals.push({ id, domain_id, domain_name, amount, notes, status });
              } else if (sql.includes('INSERT INTO core_tool_receipts')) {
                receipts.push({ id: args[0], run_id: args[1], tool: args[2] || 'domain_orchestrator', status: 'completed' });
              }
              return { success: true };
            }
          };
        }
      };
    }
  };

  const mockEnv = {
    DB: mockDb,
    CF_ACCOUNT_ID: 'b60342e5e52f5646fbd4e913bb409334'
  };

  const result = await handleDomainOrchestration(mockEnv);

  assert.equal(result.success, true);
  assert.equal(result.totalCount, 10);
  assert.ok(result.receiptId.startsWith('rcpt_dom_'));
  assert.equal(managedDomains.size, 10);
  assert.ok(managedDomains.has('tetrakis-vault.space'));
  assert.equal(managedDomains.get('tetrakis-vault.space').sale_price, 12000);
  assert.equal(managedDomains.get('tetrakis-vault.space').status, 'STAGING_RESERVE');

  // Verify DNS records (root + 3 subdomains = 4 per domain -> 40 total)
  assert.equal(dnsRecords.length, 40);

  // Verify escrow deals
  assert.equal(escrowDeals.length, 10);
  const tetrakisDeal = escrowDeals.find(d => d.domain_name === 'tetrakis-vault.space');
  assert.ok(tetrakisDeal);
  assert.equal(tetrakisDeal.amount, 12000);

  // Verify tool receipt
  assert.equal(receipts.length, 1);
});
