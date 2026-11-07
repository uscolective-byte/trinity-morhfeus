// services/trinity-gateway/src/index.js
// WORKER #01: TRINITY EDGE GATEWAY & ROUTER [Ring 0 Compliant]

import { verifyTapToken } from '../../../packages/contracts/src/tap.js';

export default {
  async fetch(request, env = {}, ctx = null) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // 1. CORS & Preflight pre aura.space / auru.space a aura.dev / auru.dev
    const allowedDomains = [
      "https://aura.space",
      "https://aura.dev",
      "https://auru.space",
      "https://auru.dev"
    ];
    const isAllowedOrigin =
      allowedDomains.includes(origin) ||
      origin.endsWith(".aura.space") ||
      origin.endsWith(".aura.dev") ||
      origin.endsWith(".auru.space") ||
      origin.endsWith(".auru.dev");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": isAllowedOrigin ? origin : allowedDomains[0],
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Trinity-Signature",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    // 2. Health check endpoint pre fleet status
    if (url.pathname === "/health" || url.pathname === "/v1/ping") {
      return Response.json({
        status: "ONLINE",
        worker: "trinity-gateway",
        ring: 0,
        env: env.ENVIRONMENT || "development",
        timestamp: Date.now()
      });
    }

    // 3. TAP Ring 0 overenie pre zabezpečené trasy
    const authHeader = request.headers.get("Authorization");
    const isPublicRoute = url.pathname.startsWith("/public");

    let userContext = null;
    if (!isPublicRoute) {
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return Response.json(
          { error: "UNAUTHORIZED", message: "Missing Ring 0 TAP token" },
          { status: 401 }
        );
      }

      const token = authHeader.slice(7).trim();
      const tapResult = await verifyTapToken(token, env.TAP_PUBLIC_KEY);

      if (!tapResult.valid) {
        return Response.json(
          { error: "FORBIDDEN", message: "Invalid or tampered TAP signature" },
          { status: 403 }
        );
      }

      userContext = tapResult.payload;
    }

    // 4. Asynchrónne logovanie do auditu (Zero Blocking)
    const auditPromise = logAuditEntry(env.AUDIT_DB || env.DB, {
      path: url.pathname,
      method: request.method,
      actor: userContext ? (userContext.sub || userContext.usr || "authenticated") : "anonymous",
      environment: env.ENVIRONMENT || "development",
      ip: request.headers.get("CF-Connecting-IP") || "0.0.0.0",
      timestamp: Date.now()
    });
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(auditPromise);
    }

    // 5. Interné smerovanie cez Cloudflare Service Bindings
    try {
      if (url.pathname.startsWith("/api/chat")) {
        const inferenceTarget =
          env.INFERENCE_SERVICE || env.AI_INFERENCE_SERVICE || env.CHAT_INFERENCE_SERVICE;
        if (!inferenceTarget || typeof inferenceTarget.fetch !== "function") {
          throw new Error("INFERENCE_SERVICE binding is not configured");
        }
        return await inferenceTarget.fetch(request.clone());
      }
      if (url.pathname.startsWith("/api/profile")) {
        if (!env.PROFILE_SERVICE || typeof env.PROFILE_SERVICE.fetch !== "function") {
          throw new Error("PROFILE_SERVICE binding is not configured");
        }
        return await env.PROFILE_SERVICE.fetch(request.clone());
      }
      if (url.pathname.startsWith("/api/crypto") || url.pathname.startsWith("/api/jericho")) {
        if (!env.JERICHO_SERVICE || typeof env.JERICHO_SERVICE.fetch !== "function") {
          throw new Error("JERICHO_SERVICE binding is not configured");
        }
        return await env.JERICHO_SERVICE.fetch(request.clone());
      }

      return Response.json(
        { error: "NOT_FOUND", message: "No worker assigned to this route" },
        { status: 404 }
      );
    } catch (err) {
      return Response.json(
        {
          error: "EDGE_ROUTING_FAULT",
          message: err.message
        },
        { status: 502 }
      );
    }
  }
};

// Pomocná funkcia pre bezpečný D1 audit log
export async function logAuditEntry(db, entry) {
  if (!db || typeof db.prepare !== "function") return;
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        `INSERT INTO audit_logs (id, path, method, actor, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, entry.path, entry.method, entry.actor, entry.ip, entry.timestamp)
      .run();
  } catch {
    try {
      await db
        .prepare(
          `INSERT INTO audit_logs (id, actor, environment, action, payload, timestamp) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
        )
        .bind(
          id,
          entry.actor,
          entry.environment || "production",
          `${entry.method} ${entry.path}`,
          JSON.stringify({ path: entry.path, method: entry.method, ip: entry.ip }),
          entry.timestamp
        )
        .run();
    } catch {
      // Audit failure nesmie zhodiť hlavný request
    }
  }
}
