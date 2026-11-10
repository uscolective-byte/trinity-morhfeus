// src/chat-agent.js - Durable Object ChatAgent
// + Fallback kaskáda modelov + D1 system prompty + Trace logovanie + Tool-Calling Engine
import { executeToolCalls, TOOL_CALLING_SYSTEM_PROMPT } from './trinity-tools/tool-calling-engine.js';

export class ChatAgent {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const action = url.pathname.replace(/^\//, "");
    const traceId = request.headers.get("X-Trinity-Trace-Id") || crypto.randomUUID();

    switch (action) {
      case "message":
        return this.handleMessage(request, traceId);
      case "history":
        return this.handleHistory();
      case "clear":
        return this.handleClear();
      default:
        return new Response(JSON.stringify({ error: "ACTION_NOT_FOUND" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
    }
  }

  async handleMessage(request, traceId) {
    const payload = await request.json();
    const { task, mode = "single", agent = "ORCHESTRATOR", provider = "workers-ai" } = payload;

    // Log incoming message
    await this._log(traceId, "chat-agent", "message.received", "info",
      `Message from ${agent}: ${(task || "").slice(0, 100)}`, { mode, agent, provider });

    const history = (await this.state.storage.get("history")) || [];

    // Append incoming user task
    const userEntry = {
      role: "user",
      content: task,
      timestamp: Date.now(),
      mode,
      agent,
    };
    history.push(userEntry);

    // Keep context window bounded within Durable Object storage
    const boundedHistory = history.slice(-20);
    await this.state.storage.put("history", boundedHistory);

    // Try CHAT_INFERENCE_SERVICE binding first
    if (this.env.CHAT_INFERENCE_SERVICE) {
      const start = Date.now();
      try {
        const inferenceResponse = await this.env.CHAT_INFERENCE_SERVICE.fetch(
          new Request("https://internal/inference", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Trinity-Trace-Id": traceId,
            },
            body: JSON.stringify({
              task,
              history: boundedHistory,
              mode,
              agent,
              provider,
            }),
          })
        );

        const ms = Date.now() - start;

        if (inferenceResponse.ok) {
          const respBody = await inferenceResponse.json();

          // Store assistant response in history
          if (respBody.response) {
            boundedHistory.push({
              role: "assistant",
              content: respBody.response,
              timestamp: Date.now(),
              model: respBody.model,
            });
            await this.state.storage.put("history", boundedHistory);
          }

          await this._log(traceId, "chat-agent", "inference.success", "info",
            `Inference OK in ${ms}ms`, { ms, model: respBody.model }, "ok", ms);

          return new Response(JSON.stringify({
            ...respBody,
            trace_id: traceId,
            latencyMs: ms,
          }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "X-Trinity-Trace-Id": traceId,
            },
          });
        }

        // Service returned error — fall through to direct AI
        await this._log(traceId, "chat-agent", "inference.service_error", "warn",
          `Service returned ${inferenceResponse.status}, falling back to direct AI`,
          { status: inferenceResponse.status });
      } catch (serviceErr) {
        await this._log(traceId, "chat-agent", "inference.service_failed", "warn",
          `Service binding failed: ${serviceErr.message}, falling back to direct AI`,
          { error: serviceErr.message });
      }
    }

    // Fallback: direct Workers AI with model cascade
    return await this._directAI(task, boundedHistory, traceId, mode);
  }

  async _directAI(task, history, traceId, mode) {
    if (!this.env.AI) {
      await this._log(traceId, "chat-agent", "ai.unavailable", "error", "No AI binding available");
      return new Response(JSON.stringify({ error: "AI_UNAVAILABLE", trace_id: traceId }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Load system prompts from D1
    let systemPrompt = null;
    if (this.env.DB) {
      try {
        const r = await this.env.DB.prepare(
          "SELECT content FROM system_prompts WHERE active=1 ORDER BY priority DESC"
        ).all();
        if (r.results?.length > 0) {
          systemPrompt = r.results.map(p => p.content).join("\n\n---\n\n");
        }
      } catch (e) {}
    }
    if (!systemPrompt) {
      systemPrompt = "Si Trinity. Pokročilý AI asistent. Komunikuj v slovenčine alebo angličtine. Nikdy v češtine. Buď prirodzený a ústretový.";
    }
    systemPrompt += "\n\n" + TOOL_CALLING_SYSTEM_PROMPT;

    const messages = [{ role: "system", content: systemPrompt }];
    for (const m of history) {
      if (m.role === "user" || m.role === "assistant") {
        messages.push({ role: m.role, content: m.content });
      }
    }
    messages.push({ role: "user", content: task });

    // Model cascade: primary → fallback
    const primaryModel = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    const fallbackModel = "@cf/meta/llama-3.1-8b-instruct-fast";
    const maxTokens = mode === "code" ? 4096 : 2048;

    const start = Date.now();

    // Try primary model
    try {
      const resp = await this.env.AI.run(primaryModel, {
        messages, max_tokens: maxTokens, temperature: 0.7
      });
      let finalResponse = resp.response;
      let toolReceipts = [];
      try {
        const toolResult = await executeToolCalls(finalResponse, this.env, {
          userId: 'basterix',
          sessionId: traceId,
          traceId,
        });

        if (toolResult.hasToolCalls) {
          toolReceipts = toolResult.results;
          await this._log(traceId, "chat-agent", "tools.executed", "info",
            `Executed ${toolResult.calls.length} tool(s)`, { calls: toolResult.calls, receipts: toolReceipts });

          try {
            const summary = await this.env.AI.run(primaryModel, {
              messages: [
                ...messages,
                { role: 'assistant', content: finalResponse },
                { role: 'system', content: `Tool results: ${JSON.stringify(toolReceipts)}` },
                { role: 'user', content: 'Zhrň výsledok vykonaných operácií prirodzene v slovenčine.' }
              ],
              max_tokens: maxTokens,
              temperature: 0.7
            });
            finalResponse = summary.response || summary;
          } catch (_) {}
        }
      } catch (toolErr) {
        await this._log(traceId, "chat-agent", "tools.error", "warn", toolErr.message);
      }

      const ms = Date.now() - start;

      // Store response in history
      history.push({
        role: "assistant",
        content: finalResponse,
        timestamp: Date.now(),
        model: "llama-3.3-70b",
      });
      await this.state.storage.put("history", history);

      await this._log(traceId, "chat-agent", "model.primary.success", "info",
        `Primary model OK in ${ms}ms`, { model: primaryModel, ms }, "ok", ms);
      await this._updateRoute("route-chat", true, ms);

      return new Response(JSON.stringify({
        response: finalResponse,
        model: "Llama 3.3 70B",
        fallbackUsed: false,
        tools: toolReceipts,
        trace_id: traceId,
        latencyMs: ms,
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Trinity-Trace-Id": traceId,
        },
      });
    } catch (primaryErr) {
      await this._log(traceId, "chat-agent", "model.primary.failed", "error",
        `Primary failed: ${primaryErr.message}`,
        { model: primaryModel, error: primaryErr.message });

      // Try fallback model
      try {
        const resp = await this.env.AI.run(fallbackModel, {
          messages, max_tokens: maxTokens, temperature: 0.7
        });

        let finalResponse = resp.response;
        let toolReceipts = [];
        try {
          const toolResult = await executeToolCalls(finalResponse, this.env, {
            userId: 'basterix',
            sessionId: traceId,
            traceId,
          });

          if (toolResult.hasToolCalls) {
            toolReceipts = toolResult.results;
            await this._log(traceId, "chat-agent", "tools.executed", "info",
              `Executed ${toolResult.calls.length} tool(s) on fallback`, { calls: toolResult.calls, receipts: toolReceipts });

            try {
              const summary = await this.env.AI.run(fallbackModel, {
                messages: [
                  ...messages,
                  { role: 'assistant', content: finalResponse },
                  { role: 'system', content: `Tool results: ${JSON.stringify(toolReceipts)}` },
                  { role: 'user', content: 'Zhrň výsledok vykonaných operácií prirodzene v slovenčine.' }
                ],
                max_tokens: maxTokens,
                temperature: 0.7
              });
              finalResponse = summary.response || summary;
            } catch (_) {}
          }
        } catch (toolErr) {
          await this._log(traceId, "chat-agent", "tools.error", "warn", toolErr.message);
        }

        const ms = Date.now() - start;

        history.push({
          role: "assistant",
          content: finalResponse,
          timestamp: Date.now(),
          model: "llama-3.1-8b",
        });
        await this.state.storage.put("history", history);

        await this._log(traceId, "chat-agent", "model.fallback.success", "warn",
          `Fallback OK in ${ms}ms`, { model: fallbackModel, ms }, "ok", ms);
        await this._updateRoute("route-chat", false, ms, primaryErr.message);

        return new Response(JSON.stringify({
          response: finalResponse,
          model: "Llama 3.1 8B (fallback)",
          fallbackUsed: true,
          primaryError: primaryErr.message,
          tools: toolReceipts,
          trace_id: traceId,
          latencyMs: ms,
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "X-Trinity-Trace-Id": traceId,
          },
        });
      } catch (fallbackErr) {
        const ms = Date.now() - start;
        await this._log(traceId, "chat-agent", "model.both_failed", "error",
          "Both models failed",
          { primary: primaryErr.message, fallback: fallbackErr.message });

        return new Response(JSON.stringify({
          error: `Primary: ${primaryErr.message} | Fallback: ${fallbackErr.message}`,
          trace_id: traceId,
          fallbackUsed: true,
        }), {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "X-Trinity-Trace-Id": traceId,
          },
        });
      }
    }
  }

  async handleHistory() {
    const history = (await this.state.storage.get("history")) || [];
    return new Response(JSON.stringify({ history, count: history.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  async handleClear() {
    await this.state.storage.delete("history");
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // === HELPERS ===

  async _log(traceId, source, eventType, severity, message, payload = {}, status = "ok", durationMs = null) {
    if (!this.env.DB) return;
    try {
      await this.env.DB.prepare(
        "INSERT INTO trinity_trace_log (id, trace_id, source, event_type, severity, message, payload_json, status, duration_ms, environment) VALUES (?,?,?,?,?,?,?,?,?,?)"
      ).bind(
        crypto.randomUUID(), traceId, source, eventType, severity, message,
        JSON.stringify(payload).slice(0, 4096), status, durationMs, "production"
      ).run();
    } catch (e) {}
  }

  async _updateRoute(routeId, success, ms, error = null) {
    if (!this.env.DB) return;
    try {
      if (success) {
        await this.env.DB.prepare(
          "UPDATE model_routes SET success_count=success_count+1, avg_latency_ms=?, last_success_at=datetime('now') WHERE id=?"
        ).bind(ms, routeId).run();
      } else {
        await this.env.DB.prepare(
          "UPDATE model_routes SET error_count=error_count+1, last_error=?, last_error_at=datetime('now'), fallback_triggered=fallback_triggered+1 WHERE id=?"
        ).bind(error?.slice(0, 500), routeId).run();
      }
    } catch (e) {}
  }
}
