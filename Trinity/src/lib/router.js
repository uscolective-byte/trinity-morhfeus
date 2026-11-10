/**
 * Trinity Router — Ultrarýchly URL pattern matcher
 * Bez externých regex knižníc
 * @version 1.0.0
 */

export class Router {
  constructor() {
    this.routes = [];
  }

  /**
   * Pridá route
   * @param {string} method - GET, POST, PUT, DELETE, OPTIONS
   * @param {string} pattern - URL pattern, napr. "/api/chat" alebo "/api/conversations/:id/messages"
   * @param {function} handler - (request, env, ctx, params, query) => Response
   */
  add(method, pattern, handler) {
    const parts = pattern.split("/").filter(Boolean);
    const paramNames = [];
    const regexParts = parts.map(part => {
      if (part.startsWith(":")) {
        paramNames.push(part.slice(1));
        return "([^/]+)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });
    const regex = new RegExp("^/" + regexParts.join("/") + "/?$");
    this.routes.push({ method, regex, paramNames, handler, pattern });
    return this;
  }

  get(pattern, handler) { return this.add("GET", pattern, handler); }
  post(pattern, handler) { return this.add("POST", pattern, handler); }
  put(pattern, handler) { return this.add("PUT", pattern, handler); }
  delete(pattern, handler) { return this.add("DELETE", pattern, handler); }

  /**
   * Matchne request proti routom
   * @returns {handler, params, query} alebo null
   */
  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = route.regex.exec(pathname);
      if (!m) continue;
      const params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(m[i + 1]);
      });
      return { handler: route.handler, params, pattern: route.pattern };
    }
    return null;
  }

  /**
   * Spracuje request cez router
   */
  async handle(request, env, ctx) {
    const url = new URL(request.url);
    const match = this.match(request.method, url.pathname);
    if (!match) return null;
    const query = Object.fromEntries(url.searchParams);
    return match.handler(request, env, ctx, match.params, query);
  }
}

/**
 * Helper pre JSON response
 */
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Trinity-Token, X-Trinity-Trace-Id, X-Trinity-Session-Id",
      ...extraHeaders
    }
  });
}

/**
 * Helper pre OPTIONS preflight
 */
export function preflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Trinity-Token, X-Trinity-Trace-Id, X-Trinity-Session-Id"
    }
  });
}
