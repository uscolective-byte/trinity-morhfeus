// Trinity Guardian Worker (services/guardian.js)
const VERSION = '2.1.0';

const secure = response => {
  const out = new Response(response.body, response);
  out.headers.set('Cache-Control', 'no-store');
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('Referrer-Policy', 'no-referrer');
  return out;
};

async function inspect(env) {
  try {
    if (!env?.TRINITY) {
      return { ok: true, service: 'trinity-guardian', version: VERSION, status: 'serving', time: new Date().toISOString() };
    }
    const r = await env.TRINITY.fetch('https://trinity.internal/health', { signal: AbortSignal.timeout(10000) });
    const d = await r.json().catch(() => ({}));
    return {
      ok: r.ok && (d.status === 'serving' || d.status === 'ok' || r.status === 200),
      service: 'trinity-guardian',
      trinity_version: d.version || VERSION,
      status: r.ok ? 'serving' : 'degraded',
      time: new Date().toISOString()
    };
  } catch (err) {
    return { ok: false, service: 'trinity-guardian', error: 'Trinity neodpovedá.', message: err.message, time: new Date().toISOString() };
  }
}

async function record(env) {
  const state = await inspect(env);
  if (env?.DB) {
    await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('guardian_check',?)")
      .bind(JSON.stringify(state))
      .run()
      .catch(() => {});
  }
  return state;
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === '/health' && request.method === 'GET') {
        const state = await inspect(env);
        return secure(Response.json(state, { status: state.ok ? 200 : 503 }));
      }

      const authHeader = request.headers.get('Authorization') || '';
      const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
      const expectedSecret = env?.TRINITY_INTERNAL_KEY || env?.TRINITY_GATEWAY_KEY;
      const isInternalBinding = url.hostname === 'trinity.internal' || url.hostname === 'localhost' || url.hostname === '127.0.0.1';

      const isAuthorized = expectedSecret
        ? (Boolean(bearerToken) && bearerToken === expectedSecret)
        : isInternalBinding;

      // Protected REST endpoints
      if ((path === '/api/logs' || path === '/api/check') && !isAuthorized) {
        return secure(Response.json({ ok: false, error: 'Unauthorized: valid internal authentication required' }, { status: 401 }));
      }

      // Action-based internal service call
      if (request.method === 'POST') {
        let call = null;
        try { call = await request.json(); } catch (_) {}
        if (call && typeof call === 'object' && call.action) {
          if (!isAuthorized) {
            return secure(Response.json({ ok: false, error: 'Unauthorized: valid internal secret required' }, { status: 401 }));
          }

          const traceId = call.traceId || crypto.randomUUID();
          if (call.action === 'audit.list' || call.action === 'audit.events') {
            const limit = Number(call.data?.limit || 50);
            let results = [];
            if (env?.DB) {
              const r = await env.DB.prepare("SELECT * FROM ops_events WHERE action='guardian_check' ORDER BY id DESC LIMIT ?")
                .bind(limit)
                .all();
              results = r.results || [];
            }
            return secure(Response.json({ ok: true, result: results, traceId, from: 'guardian' }));
          }
          if (call.action === 'guardian.check' || call.action === 'check') {
            const rec = await record(env);
            return secure(Response.json({ ok: true, result: rec, traceId, from: 'guardian' }));
          }
        }
      }

      if (path === '/api/check' && request.method === 'GET') {
        return secure(Response.json(await record(env)));
      }
      if (path === '/api/logs' && request.method === 'GET') {
        if (!env?.DB) return secure(Response.json([]));
        const rows = await env.DB.prepare("SELECT * FROM ops_events WHERE action='guardian_check' ORDER BY id DESC LIMIT 50").all();
        return secure(Response.json(rows.results || []));
      }

      return secure(Response.json({
        service: 'trinity-guardian',
        version: VERSION,
        status: 'serving'
      }, { status: 200 }));
    } catch (e) {
      return secure(Response.json({ error: e.status ? e.message : 'Monitoring zlyhal.' }, { status: e.status || 500 }));
    }
  },
  async scheduled(_event, env) {
    await record(env);
  }
};
