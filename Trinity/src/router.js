// src/router.js - Lightweight zero-dependency Edge Router
// + Trinity trace propagation + extended CORS

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      handler,
    });
  }

  get(pattern, handler) {
    this.add("GET", pattern, handler);
  }

  post(pattern, handler) {
    this.add("POST", pattern, handler);
  }

  put(pattern, handler) {
    this.add("PUT", pattern, handler);
  }

  delete(pattern, handler) {
    this.add("DELETE", pattern, handler);
  }

  options(pattern, handler) {
    this.add("OPTIONS", pattern, handler);
  }

  async handle(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // CORS Preflight handler
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Id, X-Trinity-Trace-Id, X-Trinity-Token",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    for (const route of this.routes) {
      if (route.method !== method && route.method !== "*") continue;

      const match = this._matchPath(route.pattern, url.pathname);
      if (match) {
        return route.handler({ request, env, ctx, params: match.params, url });
      }
    }

    return null; // Route not matched, falls through to ASSETS
  }

  _matchPath(pattern, pathname) {
    if (pattern === pathname) return { params: {} };
    if (!pattern.includes(":")) return null;

    const patternParts = pattern.split("/").filter(Boolean);
    const pathParts = pathname.split("/").filter(Boolean);

    if (patternParts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }
    return { params };
  }
}

// Helper: JSON response with CORS
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Id, X-Trinity-Trace-Id, X-Trinity-Token",
    },
  });
}

// Helper: Trace log to D1
export async function logTrace(env, traceId, source, eventType, severity, message, payload = {}, status = "ok", durationMs = null) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      "INSERT INTO trinity_trace_log (id, trace_id, source, event_type, severity, message, payload_json, status, duration_ms, environment) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ).bind(
      crypto.randomUUID(), traceId, source, eventType, severity, message,
      JSON.stringify(payload).slice(0, 4096), status, durationMs, "production"
    ).run();
  } catch (e) { /* best-effort logging */ }
}
