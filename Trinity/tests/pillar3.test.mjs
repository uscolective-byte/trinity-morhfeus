import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSupportResistance,
  createPriceAlert,
  checkPriceAlerts,
  generateInvoiceWithSepaQr,
  getAggregatedNetWorth
} from '../src/banking-commodity-advanced.js';

test('Pillar 3: calculateSupportResistance calculates 4% support and resistance bounds', () => {
  const comm = { symbol: 'XAU-EUR', price_eur: 2600 };
  const bounds = calculateSupportResistance(comm);
  assert.equal(typeof bounds.support, 'number');
  assert.equal(typeof bounds.resistance, 'number');
  assert.ok(bounds.support < 2600);
  assert.ok(bounds.resistance > 2600);
});

test('Pillar 3: Price alert creation and condition check triggers on breached levels', async () => {
  let alertStatus = 'active';
  const mockDb = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() { return { results: [] }; },
            async first() { return null; },
            async run() {
              if (sql.includes('UPDATE commodity_price_alerts')) alertStatus = 'triggered';
              return { success: true };
            }
          };
        },
        async all() {
          if (sql.includes("FROM commodity_price_alerts WHERE status = 'active'")) {
            return {
              results: [
                {
                  id: 'alt-1',
                  symbol: 'XAU-EUR',
                  condition: 'below',
                  target_price: 3000, // Spot price is ~2645 so <= 3000 will breach
                  status: 'active'
                }
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
  const alert = await createPriceAlert(env, 'admin', {
    symbol: 'XAU-EUR',
    condition: 'below',
    target_price: 3000,
    notify_channel: 'telegram'
  });
  assert.equal(alert.success, true);
  assert.equal(alert.symbol, 'XAU-EUR');

  const check = await checkPriceAlerts(env, { notify: false });
  assert.equal(check.success, true);
  assert.equal(check.triggered_count, 1);
  assert.equal(alertStatus, 'triggered');
});

test('Pillar 3: generateInvoiceWithSepaQr produces invoice with EPC QR SVG and HTML', async () => {
  const mockDb = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() { return { success: true }; },
            async first() { return null; },
            async all() { return { results: [] }; }
          };
        },
        async run() { return { success: true }; },
        async first() { return null; },
        async all() { return { results: [] }; }
      };
    }
  };

  const env = { DB: mockDb };
  const inv = await generateInvoiceWithSepaQr(env, 'admin', {
    client_name: 'Basterix Media s.r.o.',
    client_email: 'faktury@basterix.sk',
    amount_eur: 490,
    item_description: 'Tvorba webovej aplikácie na mieru'
  });

  assert.equal(inv.success, true);
  assert.equal(typeof inv.invoice_number, 'string');
  assert.equal(inv.amount_eur, 490);
  assert.ok(inv.qr_svg.includes('<svg'));
  assert.ok(inv.html_invoice.includes('Basterix Media s.r.o.'));
  assert.ok(inv.html_invoice.includes('490.00 €'));
});

test('Pillar 3: getAggregatedNetWorth calculates combined net worth from bank, trading and domains', async () => {
  const mockDb = {
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
                { id: 'd1', domain_name: 'test1.sk', sale_price: 500 },
                { id: 'd2', domain_name: 'test2.sk', sale_price: 1500 }
              ]
            };
          }
          return { results: [] };
        },
        async first() {
          if (sql.includes('FROM wallet_sandboxes') || sql.includes('FROM ops_wallets')) {
            return { balance_eur: 5000 };
          }
          return null;
        },
        async run() { return { success: true }; }
      };
    }
  };

  const env = { DB: mockDb };
  const netWorth = await getAggregatedNetWorth(env, 'admin');

  assert.equal(netWorth.success, true);
  assert.equal(typeof netWorth.total_net_worth_eur, 'number');
  assert.ok(netWorth.total_net_worth_eur > 0);
  assert.ok(Array.isArray(netWorth.history));
  assert.equal(netWorth.history.length, 5);
});
