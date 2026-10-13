import {AuthError, authorizeRequest, configReady} from './auth.mjs';

const headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'};
const respond = (value, status = 200) => Response.json(value, {status, headers});

function safeUpstream(data, endpoint) {
  if (!data || typeof data !== 'object') throw new Error('Bad Trinity response');
  if (endpoint === '/v1/trinity/status') {
    return {
      service: data.service === 'Trinity' ? 'Trinity' : 'unknown',
      version: typeof data.version === 'string' ? data.version : null,
      status: typeof data.status === 'string' ? data.status : 'unknown',
      agents_count: Number.isInteger(data.agents) ? data.agents : null
    };
  }
  if (endpoint === '/v1/trinity/readiness') {
    return {
      ready: data.ready === true,
      status: typeof data.status === 'string' ? data.status : 'unknown'
    };
  }
  if (!Array.isArray(data.agents) || data.agents.length > 100) throw new Error('Bad agent catalog');
  return {agents: data.agents.map(a => ({
    id: String(a.id || '').slice(0,80),
    name: String(a.name || '').slice(0,120),
    cluster: String(a.cluster || '').slice(0,120)
  }))};
}

export async function handleRequest(request, env, options = {}) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/health' && request.method === 'GET') {
    return respond({service: 'trinity-copilot-bridge', configured: configReady(env) && Boolean(env.TRINITY?.fetch)});
  }
  if (!['/v1/trinity/status', '/v1/trinity/readiness', '/v1/trinity/agents'].includes(path)) {
    return respond({error: 'Not found'}, 404);
  }
  if (request.method !== 'GET') return respond({error: 'Method not allowed'}, 405);
  try {
    await authorizeRequest(request, env, options.getKeys);
  } catch (error) {
    return respond({error: error instanceof AuthError ? error.message : 'Authentication unavailable'},
      error instanceof AuthError ? error.status : 503);
  }
  if (!env.TRINITY?.fetch) return respond({error: 'Trinity service binding unavailable'}, 503);
  const upstreamPath = path.endsWith('/status') ? '/api/health' :
    path.endsWith('/readiness') ? '/ready' : '/api/integrations/copilot/agents';
  const requestHeaders = new Headers({'Accept': 'application/json'});
  if (upstreamPath.endsWith('/agents')) {
    const key = env.COPILOT_TRINITY_READ_KEY;
    if (typeof key !== 'string' || !key.startsWith('trn_live_')) {
      return respond({error: 'Scoped Trinity read key not configured'}, 503);
    }
    requestHeaders.set('Authorization', 'Bearer ' + key);
  }
  try {
    const response = await env.TRINITY.fetch(new Request('https://trinity.internal' + upstreamPath, {
      method: 'GET', headers: requestHeaders, signal: AbortSignal.timeout(8000)
    }));
    if (!response.ok) return respond({error: 'Trinity upstream unavailable'}, 502);
    return respond(safeUpstream(await response.json(), path));
  } catch {
    return respond({error: 'Trinity upstream unavailable'}, 502);
  }
}

export default {fetch: handleRequest};
