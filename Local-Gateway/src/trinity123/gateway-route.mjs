import path from 'node:path';
import {Trinity123} from './runtime.mjs';
import {redact, safeId} from './config.mjs';

export function createTrinity123Routes({dataDir, env = process.env, client = new Trinity123({env, dataDir: env.TRINITY123_DATA || path.join(dataDir, 'trinity123')})}) {
  const prefix = '/api/agents/trinity123';
  const json = (response, status, value) => {
    response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
    response.end(redact(value, env));
  };
  return async function route(request, response, url, readBody) {
    // Human-facing identity is Trinity; keep earlier API URLs usable.
    url = new URL(url);
    url.pathname = url.pathname.replace(/^\/api\/agents\/trinity(?=\/|$)/, prefix);
    if (url.pathname !== prefix && !url.pathname.startsWith(prefix + '/')) return false;
    // The parent gateway MUST authenticate before calling this route.
    if (request.method === 'GET' && url.pathname === prefix) { json(response, 200, client.configuration()); return true; }
    const run = url.pathname.match(/^\/api\/agents\/trinity123\/runs\/([A-Za-z0-9_-]+)$/);
    if (run && request.method === 'GET') {
      const state = await client.getRun(run[1]); json(response, state ? 200 : 404, state || {error: 'Beh neexistuje.'}); return true;
    }
    const match = url.pathname.match(/^\/api\/agents\/trinity123\/sessions(?:\/([A-Za-z0-9_-]+)(?:\/(messages|observe|cancel))?)?$/);
    if (!match) { json(response, 404, {error: 'Agent endpoint neexistuje.'}); return true; }
    const [, sessionId, operation] = match;
    if (sessionId) safeId(sessionId);
    if (request.method === 'GET' && sessionId && !operation) { json(response, 200, await client.inspect(sessionId)); return true; }
    if (request.method === 'DELETE' && sessionId && !operation) { json(response, 200, await client.remove(sessionId)); return true; }
    if (request.method !== 'POST') { json(response, 405, {error: 'Nepodporovaná metóda.'}); return true; }
    if (operation === 'cancel') { json(response, 200, await client.cancel(sessionId)); return true; }
    if (sessionId && !['messages', 'observe'].includes(operation)) { json(response, 404, {error: 'Chýba messages alebo observe.'}); return true; }
    if (!env.OPENAI_API_KEY?.trim()) { json(response, 503, {status: 'blocked', error: 'Chýba OPENAI_API_KEY.', live_verified: false}); return true; }
    const input = await readBody(request);
    response.writeHead(200, {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'});
    response.flushHeaders();
    const heartbeat = setInterval(() => { if (!response.destroyed) response.write(': heartbeat\n\n'); }, 15_000);
    try {
      await client.run({sessionId, mode: !sessionId ? 'start' : operation === 'observe' ? 'observe' : 'message',
        message: input.message,
        onEvent: event => { if (!response.destroyed) response.write('data: ' + JSON.stringify(event) + '\n\n'); }});
    } catch (error) {
      if (!response.destroyed) response.write('data: ' + redact({type: 'trinity123.error', status: 'failed', error: error.message}, env) + '\n\n');
    } finally { clearInterval(heartbeat); if (!response.destroyed) response.end(); }
    return true;
  };
}
