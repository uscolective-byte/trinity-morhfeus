import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateIntrinsicValuation,
  calculateTtkQuote,
  VALUATION_MILESTONES,
  VALUE_MECHANISMS,
  TTK_METRICS
} from '../src/crypto-value-engine.js';

test('Crypto Value Engine: Token metrics and constants are correct', () => {
  assert.equal(TTK_METRICS.token_name, 'Tetrakis');
  assert.equal(TTK_METRICS.token_symbol, 'TTK');
  assert.equal(TTK_METRICS.total_supply, 1_000_000_000n);
  assert.equal(TTK_METRICS.basterix_wallet, '0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4');
  assert.equal(TTK_METRICS.basterix_holding, 1_000_000n);
  assert.equal(VALUE_MECHANISMS.protocol_revenue_share_pct, 30);
  assert.equal(VALUE_MECHANISMS.service_payment_discount_pct, 30);
});

test('Crypto Value Engine: calculateIntrinsicValuation produces floor valuation and founder yield', () => {
  const result = calculateIntrinsicValuation(10000);
  assert.equal(result.monthly_platform_revenue_eur, 10000);
  assert.equal(result.protocol_buyback_monthly_eur, 3000);
  assert.equal(result.protocol_buyback_annual_eur, 36000);
  assert.equal(result.intrinsic_valuation_floor_eur, 540000); // 36k * 15
  assert.ok(result.intrinsic_token_price_eur > 0);
  assert.ok(result.basterix_intrinsic_value_eur > 0);
  assert.equal(result.basterix_wallet, '0x7e17f9072cfCbc7fE45973De0F11eC8db99281e4');
});

test('Crypto Value Engine: calculateTtkQuote computes discounted quote with burn and dividend split', () => {
  const quote = calculateTtkQuote(100, 0.001);
  assert.equal(quote.original_amount_eur, 100);
  assert.equal(quote.discount_pct, 30);
  assert.equal(quote.discounted_amount_eur, 70);
  assert.equal(quote.required_ttk, 70000);
  assert.equal(quote.burn_portion_ttk, 35000);
  assert.equal(quote.dividend_portion_ttk, 35000);
});

test('Crypto Value Engine: Valuation milestones are properly ordered', () => {
  assert.equal(VALUATION_MILESTONES.length, 5);
  assert.equal(VALUATION_MILESTONES[0].basterix_portfolio_usd, 13.25);
  assert.equal(VALUATION_MILESTONES[1].basterix_portfolio_usd, 1000);
  assert.equal(VALUATION_MILESTONES[2].basterix_portfolio_usd, 10000);
  assert.equal(VALUATION_MILESTONES[3].basterix_portfolio_usd, 100000);
  assert.equal(VALUATION_MILESTONES[4].basterix_portfolio_usd, 1000000);
});
