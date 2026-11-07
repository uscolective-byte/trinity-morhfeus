import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Read-only Access diagnostics. Never serialize credentials or raw upstream bodies.
export class AccessDiagnosticError extends Error {
  constructor(code) { super(code); this.code = code; }
}

export function resolveEnvCredentials(customEnv = process.env, customPath) {
  const merged = { ...customEnv };
  const hasAccessId = Boolean(merged.CLOUDFLARE_ACCESS_CLIENT_ID || merged.CF_ACCESS_CLIENT_ID);
  const hasAccessSecret = Boolean(merged.CLOUDFLARE_ACCESS_CLIENT_SECRET || merged.CF_ACCESS_CLIENT_SECRET);
  const hasToken = Boolean(merged.TRINITY_MCP_API_KEY || merged.TRINITY_MCP_TOKEN);

  if (hasAccessId && hasAccessSecret && hasToken) {
    return merged;
  }

  const candidates = [
    customPath,
    merged.SHARED_ENV_PATH,
    path.join(os.homedir(), '.env')
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const content = fs.readFileSync(candidate, 'utf8');
        for (const line of content.split(/\r?\n/)) {
          const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
          if (match) {
            const key = match[1];
            let val = match[2].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!merged[key] && val) {
              merged[key] = val;
            }
          }
        }
        break;
      } catch {}
    }
  }
  return merged;
}

export function accessCredentialState(env = process.env) {
  const pairs = [
    ['CLOUDFLARE_ACCESS_CLIENT_ID', 'CLOUDFLARE_ACCESS_CLIENT_SECRET'],
    ['CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET']
  ].map(([id, secret]) => ({ id: env[id]?.trim() || '', secret: env[secret]?.trim() || '', idName: id }));
  if (pairs.some(pair => Boolean(pair.id) !== Boolean(pair.secret)))
    throw new AccessDiagnosticError('incomplete_access_credentials');
  const active = pairs.filter(pair => pair.id && pair.secret);
  if (active.length === 2 && (active[0].id !== active[1].id || active[0].secret !== active[1].secret))
    throw new AccessDiagnosticError('conflicting_access_credentials');
  return active[0] || null;
}

export function accessHeaders(env) {
  const pair = accessCredentialState(env);
  return pair ? { 'CF-Access-Client-Id': pair.id, 'CF-Access-Client-Secret': pair.secret } : {};
}

export function validateOrigin(origin) {
  const url = new URL(origin);
  if (!['https://auru.space', 'https://auru.dev'].includes(url.origin) || url.href !== url.origin + '/')
    throw new AccessDiagnosticError('origin_not_allowed');
  return url.origin;
}

async function boundedJson(response, limit = 65536) {
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    await response.body?.cancel(); return null;
  }
  if (!response.body) return null;
  const reader = response.body.getReader(); const chunks = []; let total = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read(); if (done) break;
      total += value.length;
      if (total > limit) { await reader.cancel(); throw new AccessDiagnosticError('response_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}

export async function probeEndpoint({origin, path, headers = {}, fetcher = fetch}) {
  origin = validateOrigin(origin);
  if (!['/health', '/ready'].includes(path)) throw new AccessDiagnosticError('probe_path_not_allowed');
  const response = await fetcher(origin + path, {
    method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15000),
    headers: {Accept: 'application/json', ...headers}
  });
  const location = response.headers.get('location');
  let loginRedirect = false;
  if (location) {
    const host = new URL(location, origin).hostname;
    loginRedirect = host.endsWith('.cloudflareaccess.com');
  }
  const body = await boundedJson(response);
  return {
    path, http_status: response.status, access_login_redirect: loginRedirect,
    application_json: response.ok && Boolean(body && typeof body === 'object' && !Array.isArray(body)),
    ...(typeof body?.version === 'string' ? {version: body.version} : {}),
    ...(typeof body?.environment === 'string' ? {environment: body.environment} : {}),
    ...(typeof body?.ready === 'boolean' ? {ready: body.ready} : {}),
    ...(typeof body?.deployment?.id === 'string' ? {deployment_id: body.deployment.id} : {})
  };
}

// Native Workers protection uses worker destinations, not a hostname domain field.
export function targetsWorker(app, {workerId, hostname}) {
  if (app.destinations?.some(destination => destination.type === 'worker' && destination.worker_id === workerId))
    return 'specific_worker';
  if (app.destinations?.some(destination => destination.type === 'all_workers')) return 'all_workers';
  const hosts = [app.domain, ...(app.self_hosted_domains || []),
    ...(app.destinations || []).filter(d => d.type === 'public').map(d => d.hostname)].filter(Boolean);
  if (hosts.some(domain => domain.split('/')[0] === hostname)) return 'hostname';
  return null;
}

export function summarizePolicies(policies) {
  return (policies || []).map(policy => ({
    id: policy.id, name: policy.name, decision: policy.decision,
    include_rule_types: (policy.include || []).flatMap(rule => Object.keys(rule)),
    service_token_ids: (policy.include || []).flatMap(rule => rule.service_token?.token_id ? [rule.service_token.token_id] : []),
    required_rule_types: (policy.require || []).flatMap(rule => Object.keys(rule)),
    excluded_rule_types: (policy.exclude || []).flatMap(rule => Object.keys(rule))
  }));
}

export async function readAccessMetadata({accountId, appId, apiToken, fetcher = fetch}) {
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !/^[a-f0-9-]{36}$/i.test(appId))
    throw new AccessDiagnosticError('invalid_access_metadata_target');
  if (!apiToken) return {available: false, reason: 'cloudflare_api_credential_missing'};
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/access/apps/${appId}`;
  async function get(url) {
    const response = await fetcher(url, {redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: {Authorization: `Bearer ${apiToken}`, Accept: 'application/json'}});
    const data = await boundedJson(response, 524288);
    if (!response.ok || data?.success !== true) throw new AccessDiagnosticError('access_metadata_unavailable');
    return data.result;
  }
  const app = await get(base);
  const policies = await get(base + '/policies');
  return {available: true, application: {id: app.id, name: app.name, type: app.type,
    destinations: (app.destinations || []).map(d => ({type: d.type, ...(d.worker_id ? {worker_id: d.worker_id} : {})}))},
    policies: summarizePolicies(policies)};
}

export async function verifyMcp({origin, env = process.env, fetcher = fetch}) {
  origin = validateOrigin(origin);
  if (env === process.env) env = resolveEnvCredentials(process.env);
  const mcpKey = env.TRINITY_MCP_API_KEY || env.TRINITY_MCP_TOKEN;
  if (!mcpKey) return {verified: false, reason: 'trinity_mcp_credential_missing'};
  const {Client} = await import('@modelcontextprotocol/sdk/client/index.js');
  const {StreamableHTTPClientTransport} = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const endpoint = origin + '/mcp';
  const timeout = AbortSignal.timeout(20000);
  const guardedFetch = (input, init) => {
    const target = input instanceof Request ? input.url : String(input);
    if (target !== endpoint) throw new AccessDiagnosticError('mcp_endpoint_changed');
    return fetcher(input, {...init, redirect: 'error', signal: AbortSignal.any([timeout, ...(init?.signal ? [init.signal] : [])])});
  };
  const client = new Client({name: 'trinity-access-diagnostic', version: '1.0.0'});
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    fetch: guardedFetch,
    requestInit: {headers: {...accessHeaders(env), Authorization: `Bearer ${mcpKey}`}}
  });
  try {
    await client.connect(transport, {signal: timeout});
    const result = await client.listTools({}, {signal: timeout});
    return {verified: true, initialized: true, catalog_received: true, tools_count: result.tools.length,
      tool_names: result.tools.map(tool => tool.name), mutating_tools_called: false};
  } catch {
    return {verified: false, reason: 'mcp_handshake_or_catalog_failed', mutating_tools_called: false};
  } finally { await client.close().catch(() => {}); await transport.close().catch(() => {}); }
}

export async function diagnoseAccess({origin = 'https://auru.space', env = process.env, accountId, appId,
  includeMcp = false, fetcher = fetch}) {
  origin = validateOrigin(origin);
  if (env === process.env) env = resolveEnvCredentials(process.env);
  const report = {origin, checked_at: new Date().toISOString(), read_only: true,
    credentials_configured: false, anonymous: [], authenticated: [], cloud_mutations_performed: false};
  let headers;
  try { headers = accessHeaders(env); report.credentials_configured = Object.keys(headers).length > 0; }
  catch (error) { report.credential_error = error.code; }
  for (const path of ['/health', '/ready']) {
    try { report.anonymous.push(await probeEndpoint({origin, path, fetcher})); }
    catch { report.anonymous.push({path, error: 'probe_failed'}); }
    if (report.credentials_configured) {
      try { report.authenticated.push(await probeEndpoint({origin, path, headers, fetcher})); }
      catch { report.authenticated.push({path, error: 'authenticated_probe_failed'}); }
    }
  }
  if (accountId && appId) {
    try { report.access_metadata = await readAccessMetadata({accountId, appId, apiToken: env.CLOUDFLARE_API_TOKEN, fetcher}); }
    catch (error) { report.access_metadata = {available: false, reason: error.code || 'metadata_probe_failed'}; }
  }
  if (includeMcp && !report.credential_error) report.mcp = await verifyMcp({origin, env, fetcher});
  report.access_verified = report.credentials_configured && report.authenticated.length === 2 &&
    report.authenticated.every(probe => probe.application_json === true && probe.access_login_redirect === false);
  report.application_ready = report.access_verified && report.authenticated.some(probe => probe.path === '/ready' && probe.ready === true);
  return report;
}
