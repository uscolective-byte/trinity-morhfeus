import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessDomainResponse as assess } from './check-trinity-domains.mjs';

test('rejects development hostname serving production environment', () => {
  const result = assess('app', 'auru.dev', '/health', { httpStatus: 200, body: { service: 'Trinity', status: 'serving', environment: 'production' } });
  assert.equal(result.ok, false);
});

test('health result preserves actual HTTP status separately from application status', () => {
  const result = assess('app', 'auru.space', '/health', { httpStatus: 503, body: { service: 'Trinity', status: 'serving', environment: 'production' } });
  assert.equal(result.ok, false);
});

test('canonical redirect must preserve path and query on its own apex', () => {
  const path = '/tasks/123?view=full';
  assert.equal(assess('canonical', 'www.auru.dev', path, { httpStatus: 308, location: 'https://auru.dev/tasks/123?view=full' }).ok, true);
  assert.equal(assess('canonical', 'www.auru.dev', path, { httpStatus: 308, location: 'https://auru.space/tasks/123?view=full' }).ok, false);
  assert.equal(assess('canonical', 'www.auru.dev', path, { httpStatus: 308, location: 'https://auru.dev/' }).ok, false);
});

test('Access redirect is protection evidence, not an origin readiness claim', () => {
  const result = assess('protected', 'jericho123.auru.dev', '/', { httpStatus: 302, location: 'https://example.cloudflareaccess.com/cdn-cgi/access/login/jericho123.auru.dev?token=not-recorded' });
  assert.equal(result.ok, true);
  assert.equal(result.originReadiness, 'not_checked_without_authentication');
  assert.equal(JSON.stringify(result).includes('token'), false);
});

test('rejects misleading Access-like domain and unexpectedly public protected UI', () => {
  assert.equal(assess('protected', 'jericho123.auru.dev', '/', { httpStatus: 302, location: 'https://example.cloudflareaccess.com.attacker.invalid/cdn-cgi/access/login/' }).ok, false);
  assert.equal(assess('protected', 'jericho123.auru.dev', '/', { httpStatus: 200 }).ok, false);
});
