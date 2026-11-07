/**
 * TRINITY OMNI-CORE v11.2.0 - SOVEREIGN EDGE RUNTIME (DEV / STAGING MONOLITH)
 * Root Architect: Ivan Sabo (Basterix)
 * Domain: aura.dev (Staging) / aura.space (Production)
 * Status: Ring 0 Sovereign Master Controller
 */

import {
  PINNED_SYSTEM_PROMPT,
  TRINITY_TOOL_DEFINITIONS,
  normalizeText,
  handleFastEdgeRoute,
  executeTool,
  runInferenceCascade
} from './sovereign-monolith.js';
import { handleFastChat } from './fast-chat.js';
import tapProfileService from '../../services/trinity-profile/src/index.js';
import jerichoCryptoService from '../../services/jericho123/src/index.js';

export {
  PINNED_SYSTEM_PROMPT,
  TRINITY_TOOL_DEFINITIONS,
  normalizeText,
  handleFastEdgeRoute,
  executeTool,
  runInferenceCascade
};

export default {
  async fetch(request, env = {}, ctx = null) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    // 1. Voľný CORS (Vývojový režim bez blokovania)
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Trinity-Trace-Id",
      "Access-Control-Max-Age": "86400"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 2. ProfileMaker Service Binding (Worker #47)
    if (url.pathname.startsWith("/api/profiles") || url.pathname.startsWith("/profiles")) {
      if (env.PROFILE_SERVICE && typeof env.PROFILE_SERVICE.fetch === "function") {
        const subReq = new Request(request.url.replace("/api/profiles", "/profiles"), request);
        return await env.PROFILE_SERVICE.fetch(subReq);
      }
      return await tapProfileService.fetch(request, env, ctx);
    }

    // 3. Jericho Krypto Service Binding (Worker #26)
    if (url.pathname.startsWith("/api/crypto") || url.pathname.startsWith("/crypto")) {
      if (env.JERICHO_SERVICE && typeof env.JERICHO_SERVICE.fetch === "function") {
        const subReq = new Request(request.url.replace("/api/crypto", "/crypto"), request);
        return await env.JERICHO_SERVICE.fetch(subReq);
      }
      if (request.method === "GET" && (url.pathname === "/api/crypto/prices" || url.pathname === "/crypto/prices")) {
        const prices = await executeTool("crypto_oracle_query", { asset: "ALL" }, env);
        return new Response(JSON.stringify({ oracle: "jericho-edge", ...prices }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      return await jerichoCryptoService.fetch(request, env, ctx);
    }

    // 4. Priame spúšťanie nástrojov cez API (/api/tools/execute)
    if (request.method === "POST" && url.pathname === "/api/tools/execute") {
      try {
        const { tool, arguments: args } = await request.json();
        const execOutput = await executeTool(tool, args || {}, env);
        return new Response(JSON.stringify(execOutput), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 5. Hlavný chat komunikátor (/chat alebo /api/chat)
    if (request.method === "POST" && (url.pathname === "/chat" || url.pathname === "/api/chat")) {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "NEPLATNÝ JSON V TELE POŽIADAVKY" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const messages = body.messages || [{ role: "user", content: body.message || "" }];
      const lastMsgText = messages[messages.length - 1]?.content || "";

      // Okamžitá kontrola Fast-Chat Routera (Sub-10ms)
      const fastResult = handleFastEdgeRoute(lastMsgText, env);
      const fallbackFast = !fastResult.handled ? handleFastChat(lastMsgText, env) : null;
      if (fastResult.handled || fallbackFast?.handled) {
        const replyText = fastResult.handled ? fastResult.text : fallbackFast.response;
        return new Response(JSON.stringify({
          reply: replyText,
          mode: "fast-edge",
          route: "fast-edge-sub10ms",
          timestamp: Date.now()
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Trinity-Route": "fast-edge"
          }
        });
      }

      // Spustenie plnohodnotnej 3-Tier inferenčnej kaskády
      try {
        const aiStream = await runInferenceCascade(messages, env);

        if (env.DB && ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(
            env.DB.prepare(
              "INSERT INTO audit_logs (id, environment, actor, action, payload, timestamp) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
            ).bind(
              crypto.randomUUID(),
              env.ENVIRONMENT || "staging",
              "Basterix",
              "CHAT_INFERENCE_INVOKED",
              JSON.stringify({ query: lastMsgText.substring(0, 100) }),
              Date.now()
            ).run().catch(() => {})
          );
        }

        return new Response(aiStream, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({
          error: "INFERENCE_FAILED",
          details: err.message,
          mode: "fallback_recovery"
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 6. Root stav a manifest
    return new Response(JSON.stringify({
      system: "TRINITY OMNI-CORE",
      version: "11.2.0-SOVEREIGN",
      environment: env.ENVIRONMENT || "staging",
      owner: "Ivan Sabo (Basterix)",
      ring_level: 0,
      active_fleet: 47,
      bindings: {
        d1: Boolean(env.DB),
        kv: Boolean(env.TRINITY_KV),
        ai: Boolean(env.AI),
        profile_service: Boolean(env.PROFILE_SERVICE),
        jericho_service: Boolean(env.JERICHO_SERVICE)
      },
      status: "ONLINE_OPERATIONAL"
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};
