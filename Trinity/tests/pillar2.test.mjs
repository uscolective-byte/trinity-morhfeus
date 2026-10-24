import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateEscrowLandingHtml,
  createEscrowDeal,
  settleEscrowDeal,
  checkDomainsAndSslHealth,
  cloneDomainEnvironment
} from '../src/domain-desk-advanced.js';

test('Pillar 2: generateEscrowLandingHtml produces valid HTML with pricing and escrow guarantee', () => {
  const html = generateEscrowLandingHtml({
    domain: { domain_name: 'quantum-ai.sk', sale_price: 990, lease_price_monthly: 99 },
    salePrice: 990,
    leasePrice: 99
  });
  assert.equal(typeof html, 'string');
  assert.ok(html.includes('quantum-ai.sk'));
  assert.ok(html.includes('990 €'));
  assert.ok(html.includes('99 €'));
  assert.ok(html.includes('Escrow Garancia'));
  assert.ok(html.includes('id="escrow-inquiry-form"'));
});

test('Pillar 2: Escrow deal creation and settlement with automated DNS rewrite', async () => {
  const testDomainId = 'dom-test-123';
  let domainStatus = 'for_sale';
  let dnsUpdated = false;
  let dealUpdated = false;

  const mockDb = {
    async batch(stmts) { return []; },
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM managed_domains')) {
                return {
                  id: testDomainId,
                  domain_name: 'cloud-trinity.sk',
                  status: domainStatus,
                  sale_price: 1200
                };
              }
              if (sql.includes('FROM domain_escrow_deals')) {
                return {
                  id: args[0],
                  domain_id: testDomainId,
                  domain_name: 'cloud-trinity.sk',
                  deal_type: 'instant_buy',
                  amount: 1200,
                  currency: 'EUR',
                  buyer_email: 'buyer@test.sk',
                  target_dns: '203.0.113.10',
                  status: 'pending'
                };
              }
              return null;
            },
            async all() {
              if (sql.includes('FROM domain_dns_records')) {
                return { results: [{ id: 'dns-old', type: 'A', name: '@', content: '192.0.2.1' }] };
              }
              return { results: [] };
            },
            async run() {
              if (sql.includes('UPDATE managed_domains')) domainStatus = 'sold';
              if (sql.includes('UPDATE domain_escrow_deals')) dealUpdated = true;
              if (sql.includes('INSERT INTO domain_dns_records')) dnsUpdated = true;
              return { success: true };
            }
          };
        },
        async first() { return null; },
        async all() { return { results: [] }; },
        async run() { return { success: true }; }
      };
    }
  };

  const env = { DB: mockDb };

  // Create deal
  const deal = await createEscrowDeal(env, {
    domain_name: 'cloud-trinity.sk',
    deal_type: 'instant_buy',
    amount: 1200,
    currency: 'EUR',
    buyer_email: 'buyer@test.sk',
    target_dns: '203.0.113.10'
  });
  assert.equal(deal.success, true);
  assert.equal(deal.amount, 1200);

  // Settle deal
  const settled = await settleEscrowDeal(env, 'admin', {
    deal_id: deal.deal_id,
    payment_reference: 'SEPA-INSTANT-001',
    target_dns: '203.0.113.10'
  });
  assert.equal(settled.success, true);
  assert.equal(settled.status, 'settled');
  assert.equal(settled.new_domain_status, 'sold');
});

test('Pillar 2: Domain and SSL health check detects expiring domains', async () => {
  const expiringDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const mockDb = {
    async batch(stmts) { return []; },
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() { return { results: [] }; },
            async first() { return null; },
            async run() { return { success: true }; }
          };
        },
        async all() {
          if (sql.includes('FROM managed_domains')) {
            return {
              results: [
                { id: 'd1', domain_name: 'safe-domain.sk', status: 'active', expires_at: '2030-01-01' },
                { id: 'd2', domain_name: 'urgent-domain.sk', status: 'active', expires_at: expiringDate }
              ]
            };
          }
          return { results: [] };
        },
        async first() { return null; },
        async run() { return { success: true }; }
      };
    }
  };

  const env = { DB: mockDb };
  const report = await checkDomainsAndSslHealth(env, { notifyTelegram: false });
  assert.equal(report.success, true);
  assert.ok(report.alerts.some(a => a.domain_name === 'urgent-domain.sk' && a.severity === 'critical'));
});

test('Pillar 2: 1-Click environment cloning creates A/B test variant', async () => {
  const envMap = {
    'auru.space': {
      production: {
        environment: 'production',
        template: 'ai_saas',
        title: 'Auru Space Production',
        version: 1
      }
    }
  };

  const mockDb = {
    async batch(stmts) { return []; },
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes('FROM managed_domains')) {
                return { id: 'dom-auru', domain_name: 'auru.space' };
              }
              if (sql.includes('FROM ops_memory')) {
                return { value: JSON.stringify(envMap) };
              }
              return null;
            },
            async run() {
              return { success: true };
            }
          };
        },
        async first() { return null; },
        async run() { return { success: true }; }
      };
    }
  };

  const env = { DB: mockDb };
  const res = await cloneDomainEnvironment(env, 'owner', {
    domain_name: 'auru.space',
    source_env: 'production',
    target_env: 'variant-b',
    ab_variant_label: 'A/B Test Hero Redesign'
  });

  assert.equal(res.success, true);
  assert.equal(res.source_env, 'production');
  assert.equal(res.target_env, 'variant-b');
  assert.equal(res.target_url, 'https://variant-b.auru.space');
});
