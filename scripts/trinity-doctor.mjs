#!/usr/bin/env node
// Read-only Trinity diagnostics. No credentials are read or printed.
const targets = [
  ['production', process.env.TRINITY_HEALTH_URL || 'https://auru.space/health'],
  ['local-gateway', process.env.TRINITY_LOCAL_GATEWAY_URL || 'http://127.0.0.1:8791/health'],
  ['pc-bridge', process.env.TRINITY_PC_BRIDGE_URL || 'http://127.0.0.1:8792/health'],
];
async function check(label, endpoint) {
  let url;
  try { url = new URL(endpoint); } catch { return { label, state: 'invalid_url' }; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return { label, state: 'invalid_url' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'manual', headers: { accept: 'application/json' } });
    const contentType = response.headers.get('content-type') || '';
    const sample = (await response.text()).slice(0, 8192);
    let data = null;
    if (contentType.includes('json')) { try { data = JSON.parse(sample); } catch { /* malformed JSON */ } }
    return { label, state: response.ok ? 'reachable' : 'http_error', status: response.status,
      version: typeof data?.version === 'string' ? data.version : null,
      service: typeof data?.service === 'string' ? data.service : null,
      health: typeof data?.status === 'string' ? data.status : null };
  } catch (error) {
    return { label, state: error.name === 'AbortError' ? 'timeout' : 'unreachable' };
  } finally { clearTimeout(timer); }
}
const results = await Promise.all(targets.map(([label, url]) => check(label, url)));
console.log(JSON.stringify({ checked_at: new Date().toISOString(), checks: results,
  note: 'HTTP reachability does not prove complete application health. A MEMORY key 404 may indicate a missing record.' }, null, 2));
if (results.some(item => item.state !== 'reachable')) process.exitCode = 1;
