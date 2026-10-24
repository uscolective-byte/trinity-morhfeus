import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPayPalBaseUrl, isPayPalConfigured, paypalDiagnostics, createPayPalOrder, capturePayPalOrder } from '../src/paypal-rest.js';

test('PayPal REST: detects live vs sandbox base URL correctly', () => {
  assert.equal(getPayPalBaseUrl({ PAYPAL_MODE: 'live' }), 'https://api-m.paypal.com');
  assert.equal(getPayPalBaseUrl({}), 'https://api-m.paypal.com');
  assert.equal(getPayPalBaseUrl({ PAYPAL_MODE: 'sandbox' }), 'https://api-m.sandbox.paypal.com');
});

test('PayPal REST: reports unconfigured state when secrets are missing without crashing', () => {
  const env = {};
  assert.equal(isPayPalConfigured(env), false);
  const diag = paypalDiagnostics(env);
  assert.equal(diag.configured, false);
  assert.equal(diag.client_id_configured, false);
  assert.equal(diag.secret_configured, false);
  assert.equal(diag.real_money, true);
  assert.equal(diag.simulation_disabled, true);
});

test('PayPal REST: masks client id securely in diagnostics', () => {
  const env = {
    PAYPAL_CLIENT_ID: 'AX1234567890ABCDEF1234',
    PAYPAL_CLIENT_SECRET: 'SECRET_XYZ'
  };
  assert.equal(isPayPalConfigured(env), true);
  const diag = paypalDiagnostics(env);
  assert.equal(diag.configured, true);
  assert.equal(diag.client_id_configured, true);
  assert.equal(diag.secret_configured, true);
  assert.equal(diag.client_id_masked, 'AX1234...1234');
});

test('PayPal REST: createPayPalOrder rejects non-positive or invalid amounts', async () => {
  await assert.rejects(
    async () => createPayPalOrder({}, { amountEur: -10 }),
    /Neplatná suma v EUR/
  );
  await assert.rejects(
    async () => createPayPalOrder({}, { amountEur: 0 }),
    /Neplatná suma v EUR/
  );
  await assert.rejects(
    async () => createPayPalOrder({}, { amountEur: 'abc' }),
    /Neplatná suma v EUR/
  );
});

test('PayPal REST: createPayPalOrder fails closed when credentials missing', async () => {
  await assert.rejects(
    async () => createPayPalOrder({}, { amountEur: 50 }),
    /PayPal REST API nie je nakonfigurované/
  );
});

test('PayPal REST: capturePayPalOrder validates orderId and fails closed', async () => {
  await assert.rejects(
    async () => capturePayPalOrder({}, null),
    /Zadaj platné PayPal Order ID/
  );
  await assert.rejects(
    async () => capturePayPalOrder({}, ''),
    /Zadaj platné PayPal Order ID/
  );
});
