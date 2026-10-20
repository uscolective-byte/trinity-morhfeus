--62720e41e31b6f2a7da9411ce31607b5ae12b34683385a40c6299440585a
Content-Disposition: form-data; name="guardian.js"

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/security.js
import { timingSafeEqual } from "node:crypto";
var HttpError = class extends Error {
  static {
    __name(this, "HttpError");
  }
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
async function hash(value) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).toString("hex");
}
__name(hash, "hash");
async function equal(a, b) {
  return timingSafeEqual(Buffer.from(await hash(a)), Buffer.from(await hash(b)));
}
__name(equal, "equal");
function normalizedEmails(value) {
  return new Set(String(value || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}
__name(normalizedEmails, "normalizedEmails");
function isOwnerEmail(env, email) {
  const owners = normalizedEmails(env.TRINITY_OWNER_EMAILS);
  const primary = String(env.TRINITY_OWNER_EMAIL || "").trim().toLowerCase();
  if (primary) owners.add(primary);
  return owners.has(String(email || "").trim().toLowerCase());
}
__name(isOwnerEmail, "isOwnerEmail");
async function validKey(token, env) {
  token = typeof token === "string" ? token.trim() : token;
  if (!token || token.length > 2048) return false;
  for (const secret of [env.TRINITY_OPS_KEY, env.TRINITY_SESSION_SECRET]) {
    if (typeof secret === "string" && secret.length >= 8 && await equal(token, secret)) return true;
  }
  return false;
}
__name(validKey, "validKey");
function localLoopbackRequest(request, env = {}) {
  try {
    const target = new URL(request.url);
    return env.TRINITY_LOCAL_DEV_AUTH === "1" && target.protocol === "http:";
  } catch {
    return false;
  }
}
__name(localLoopbackRequest, "localLoopbackRequest");
async function authenticate(request, env) {
  const googleOnly = env.TRINITY_AUTH_MODE === "google";
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "") || request.headers.get("X-Trinity-Token");
  if (!googleOnly && await validKey(token, env)) return { id: (await hash(token)).slice(0, 24), email: env.TRINITY_OWNER_EMAIL || null, role: "owner", owner: true };
  const session = request.headers.get("Cookie")?.match(/(?:^|;\s*)trinity_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (session) {
    const digest = await hash(session);
    if (googleOnly) {
      const row = await env.DB.prepare(`SELECT s.expires_at,s.email,u.role,u.status FROM ops_sessions s
        LEFT JOIN ops_users u ON lower(u.email)=lower(s.email) WHERE s.token_hash=?`).bind(digest).first();
      if (row && row.expires_at > Date.now() && row.email && row.status === "active") return { id: digest.slice(0, 24), email: row.email, role: isOwnerEmail(env, row.email) ? "owner" : row.role };
    } else {
      const row = await env.DB.prepare("SELECT expires_at,email FROM ops_sessions WHERE token_hash = ?").bind(digest).first();
      if (row && row.expires_at > Date.now()) {
        const owner = isOwnerEmail(env, row.email);
        return { id: digest.slice(0, 24), email: row.email || null, role: owner ? "owner" : null, owner };
      }
    }
  }
  throw new HttpError(401, "Prihl\xE1s sa do Trinity.");
}
__name(authenticate, "authenticate");
function checkOrigin(request, env = {}) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin && !localLoopbackRequest(request, env)) throw new HttpError(403, "Cudz\xED p\xF4vod po\u017Eiadavky je zak\xE1zan\xFD.");
}
__name(checkOrigin, "checkOrigin");
function secure(response) {
  const out = new Response(response.body, response);
  out.headers.set("X-Content-Type-Options", "nosniff");
  out.headers.set("Referrer-Policy", "no-referrer");
  out.headers.set("X-Frame-Options", "DENY");
  out.headers.set("Cache-Control", "no-store");
  return out;
}
__name(secure, "secure");

// services/guardian.js
async function inspect(env) {
  try {
    const r = await env.TRINITY.fetch("https://trinity.internal/health", { signal: AbortSignal.timeout(1e4) });
    const d = await r.json();
    return { ok: r.ok && d.status === "serving", service: "trinity-guardian", trinity_version: d.version, time: (/* @__PURE__ */ new Date()).toISOString() };
  } catch {
    return { ok: false, service: "trinity-guardian", error: "Trinity neodpoved\xE1.", time: (/* @__PURE__ */ new Date()).toISOString() };
  }
}
__name(inspect, "inspect");
async function record(env) {
  const state = await inspect(env);
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('guardian_check',?)").bind(JSON.stringify(state)).run();
  return state;
}
__name(record, "record");
var guardian_default = {
  async fetch(request, env) {
    try {
      const path = new URL(request.url).pathname;
      if (path === "/health" && request.method === "GET") {
        const state = await inspect(env);
        return secure(Response.json(state, { status: state.ok ? 200 : 503 }));
      }
      checkOrigin(request);
      await authenticate(request, env);
      if (path === "/api/check" && request.method === "GET") return secure(Response.json(await record(env)));
      if (path === "/api/logs" && request.method === "GET") return secure(Response.json((await env.DB.prepare("SELECT * FROM ops_events WHERE action='guardian_check' ORDER BY id DESC LIMIT 50").all()).results));
      return secure(Response.json({ error: "Pou\u017Ei opera\u010Dn\xE9 centrum Trinity. Star\xE9 automatick\xE9 wake/browse/talk akcie boli nahraden\xE9 sledovan\xFDmi \xFAlohami." }, { status: 410 }));
    } catch (e) {
      return secure(Response.json({ error: e.status ? e.message : "Monitoring zlyhal." }, { status: e.status || 500 }));
    }
  },
  async scheduled(_event, env) {
    await record(env);
  }
};
export {
  guardian_default as default
};
//# sourceMappingURL=guardian.js.map

--62720e41e31b6f2a7da9411ce31607b5ae12b34683385a40c6299440585a--
