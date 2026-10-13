import {AuthError, authorizeRequest, configReady} from './auth.mjs';

const defaultHeaders = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'};
const respond = (value, status = 200) => Response.json(value, {status, headers: defaultHeaders});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function tasksEnabled(env) {
  // Pilot is intentionally limited to one Entra user; no cross-user job disclosure.
  return env?.ENTRA_ENABLE_TASKS === 'true' &&
    (env?.ENTRA_ALLOWED_USER_OIDS || '').split(',').map(x => x.trim()).filter(Boolean).length === 1 &&
    typeof env?.COPILOT_TRINITY_TASK_KEY === 'string' &&
    env.COPILOT_TRINITY_TASK_KEY.startsWith('trn_live_');
}

function safeReadResponse(data, endpoint) {
  if (!data || typeof data !== 'object') throw new Error('Bad Trinity response');
  if (endpoint === '/v1/trinity/status') return {
    service: data.service === 'Trinity' ? 'Trinity' : 'unknown',
    version: typeof data.version === 'string' ? data.version : null,
    status: typeof data.status === 'string' ? data.status : 'unknown',
    agents_count: Number.isInteger(data.agents) ? data.agents : null
  };
  if (endpoint === '/v1/trinity/readiness') return {
    ready: data.ready === true,
    status: typeof data.status === 'string' ? data.status : 'unknown'
  };
  if (!Array.isArray(data.agents) || data.agents.length > 100) throw new Error('Bad agent catalog');
  return {agents: data.agents.map(a => ({
    id: String(a.id || '').slice(0,80),
    name: String(a.name || '').slice(0,120),
    cluster: String(a.cluster || '').slice(0,120)
  }))};
}

async function boundedBody(request, maximum = 5500) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    throw new AuthError(415, 'Expected JSON');
  }
  if (Number(request.headers.get('content-length') || 0) > maximum) {
    throw new AuthError(413, 'Request too large');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError(400, 'Missing body');
  const chunks = [];
  let bytes = 0;
  for (;;) {
    const {value, done} = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximum) { await reader.cancel(); throw new AuthError(413, 'Request too large'); }
    chunks.push(value);
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  let data;
  try { data = JSON.parse(new TextDecoder().decode(buffer)); }
  catch { throw new AuthError(400, 'Invalid JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      Object.keys(data).some(k => k !== 'message') ||
      typeof data.message !== 'string' ||
      !data.message.trim() || data.message.length > 4000) {
    throw new AuthError(400, 'Expected message string (1-4000 characters)');
  }
  return {message: data.message.trim()};
}

export async function handleRequest(request, env, options = {}) {
  const path = new URL(request.url).pathname;
  if (path === '/health' && request.method === 'GET') {
    return respond({service: 'trinity-copilot-bridge',
      configured: configReady(env) && Boolean(env.TRINITY?.fetch),
      tasks_enabled: configReady(env) && tasksEnabled(env)});
  }
  const taskId = path.match(/^\/v1\/trinity\/tasks\/([0-9a-f-]{36})$/i);
  const isRead = ['/v1/trinity/status', '/v1/trinity/readiness', '/v1/trinity/agents'].includes(path);
  const isSubmit = path === '/v1/trinity/tasks';
  const isPoll = Boolean(taskId && UUID.test(taskId[1]));
  if (!isRead && !isSubmit && !isPoll) return respond({error: 'Not found'}, 404);
  if ((isRead || isPoll) && request.method !== 'GET' ||
      isSubmit && request.method !== 'POST') return respond({error: 'Method not allowed'}, 405);
  if ((isSubmit || isPoll) && !tasksEnabled(env)) return respond({error: 'Copilot tasks not configured'}, 503);

  try {
    await authorizeRequest(request, env, options.getKeys, isRead ? 'Trinity.Read' : 'Trinity.Execute');
  } catch (error) {
    return respond({error: error instanceof AuthError ? error.message : 'Authentication unavailable'},
      error instanceof AuthError ? error.status : 503);
  }
  if (!env.TRINITY?.fetch) return respond({error: 'Trinity service binding unavailable'}, 503);

  const upstream = path === '/v1/trinity/status' ? '/api/health'
    : path === '/v1/trinity/readiness' ? '/ready'
    : path === '/v1/trinity/agents' ? '/api/integrations/copilot/agents'
    : path === '/v1/trinity/tasks' ? '/api/integrations/copilot/tasks'
    : '/api/integrations/copilot/tasks/' + taskId[1];

  const headers = new Headers({'Accept': 'application/json'});
  if (isRead && upstream.endsWith('/agents')) {
    if (!env.COPILOT_TRINITY_READ_KEY?.startsWith('trn_live_')) return respond({error: 'Read key not configured'}, 503);
    headers.set('Authorization', 'Bearer ' + env.COPILOT_TRINITY_READ_KEY);
  }
  if (isSubmit || isPoll) headers.set('Authorization', 'Bearer ' + env.COPILOT_TRINITY_TASK_KEY);
  let body;
  if (isSubmit) {
    try { body = JSON.stringify(await boundedBody(request)); }
    catch (error) {
      return respond({error: error instanceof AuthError ? error.message : 'Bad request'},
        error instanceof AuthError ? error.status : 400);
    }
    headers.set('Content-Type', 'application/json');
  }
  try {
    const response = await env.TRINITY.fetch(new Request('https://trinity.internal' + upstream, {
      method: isSubmit ? 'POST' : 'GET', headers, body,
      signal: AbortSignal.timeout(8000)
    }));
    if (!response.ok) {
      if (response.status === 403) return respond({error: 'Task not permitted through Copilot'}, 403);
      if (response.status === 429) return respond({error: 'Rate limited by Trinity'}, 429);
      return respond({error: 'Trinity upstream unavailable'}, 502);
    }
    const data = await response.json();
    if (isRead) return respond(safeReadResponse(data, path));
    if (isSubmit) {
      if (!UUID.test(data.id || '') || data.status !== 'queued') return respond({error: 'Invalid task receipt'}, 502);
      return respond({id: data.id, status: 'queued', completed: false}, 202);
    }
    if (data.id !== taskId[1] || typeof data.status !== 'string') return respond({error: 'Invalid task state'}, 502);
    return respond({id: data.id, status: data.status,
      result: data.status === 'completed' ? String(data.result || '').slice(0,12000) : null});
  } catch {
    return respond({error: 'Trinity upstream unavailable'}, 502);
  }
}

export default {fetch: handleRequest};
