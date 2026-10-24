#!/usr/bin/env node
// Public, read-only domain checks. No credentials, DNS mutations or deployments.
import dns from 'node:dns/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function assessDomainResponse(kind, host, path, response) {
  const { httpStatus, location, body } = response;
  if (kind === 'app') {
    if (httpStatus !== 200) return { ok: false, reason: 'APP_HTTP_ERROR' };
    if (path === '/health') {
      const expected = host === 'auru.space' ? 'production' : 'development';
      if (body?.environment !== expected || body?.status !== 'serving' || body?.service !== 'Trinity') {
        return { ok: false, reason: 'APP_ENVIRONMENT_OR_HEALTH_MISMATCH' };
      }
      return { ok: true, version: body.version, environment: body.environment, deploymentId: body.deployment?.id, commitTag: body.deployment?.tag || null };
    }
    return { ok: true };
  }
  if (kind === 'canonical') {
    const target = `https://${host.slice(4)}${path}`;
    if (![301, 308].includes(httpStatus) || location !== target) return { ok: false, reason: 'CANONICAL_REDIRECT_MISMATCH' };
    return { ok: true, redirect: target };
  }
  if (kind === 'protected') {
    let target;
    try { target = new URL(location); } catch { return { ok: false, reason: 'ACCESS_REDIRECT_MISSING' }; }
    if (![302, 303].includes(httpStatus) || target.protocol !== 'https:' || !target.hostname.endsWith('.cloudflareaccess.com') || !target.pathname.startsWith('/cdn-cgi/access/login/')) {
      return { ok: false, reason: 'EXPECTED_ACCESS_PROTECTION_MISSING' };
    }
    return { ok: true, accessProtected: true, originReadiness: 'not_checked_without_authentication' };
  }
  return { ok: false, reason: 'UNKNOWN_CHECK_KIND' };
}

export async function checkDomains() {
  const definitions = [
    ['app', 'auru.space', ['/', '/health']],
    ['app', 'auru.dev', ['/', '/health']],
    ['protected', 'jericho123.auru.space', ['/']],
    ['protected', 'jericho123.auru.dev', ['/']],
    ['canonical', 'www.auru.space', ['/', '/__trinity_domain_probe__?check=1']],
    ['canonical', 'www.auru.dev', ['/', '/__trinity_domain_probe__?check=1']]
  ];
  const hosts = await Promise.all(definitions.map(async ([kind, host, paths]) => {
    const report = { host, kind };
    try { report.addresses = await dns.resolve4(host); }
    catch (error) { return { ...report, ok: false, reason: 'DNS_LOOKUP_FAILED', dnsError: error.code }; }
    report.checks = await Promise.all(paths.map(async path => {
      try {
        const r = await fetch(`https://${host}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
        const location = r.headers.get('location');
        let body = null;
        if (path === '/health') { try { body = await r.json(); } catch {} }
        else if (r.body) await r.body.cancel();
        return { path, httpStatus: r.status, ...assessDomainResponse(kind, host, path, { httpStatus: r.status, location, body }) };
      } catch (error) { return { path, ok: false, reason: 'HTTPS_REQUEST_FAILED', error: error.cause?.code || error.name }; }
    }));
    report.ok = report.checks.every(check => check.ok);
    return report;
  }));
  return { ok: hosts.every(host => host.ok), checkedAt: new Date().toISOString(), hosts, limitation: 'Public reachability and canonical routing only. Protected origin readiness, authorization and development data isolation require separate checks.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkDomains().then(report => { console.log(JSON.stringify(report, null, 2)); process.exitCode = report.ok ? 0 : 1; })
    .catch(() => { console.error(JSON.stringify({ ok: false, reason: 'DOMAIN_CHECK_FAILED' })); process.exitCode = 1; });
}
