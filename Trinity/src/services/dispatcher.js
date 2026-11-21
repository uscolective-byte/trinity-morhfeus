/**
 * Trinity Service Dispatcher
 * Klient pre volanie Service Bindingov
 * @version 1.0.0
 */

import { D1 } from '../lib/d1.js';

const SERVICE_MAP = {
  'CHAT_INFERENCE_SERVICE': 'trinity-chat-inference',
  'AI_INFERENCE_SERVICE': 'trinity-chat-inference',
  'CORE': 'trinity-core',
  'CORE_SERVICE': 'trinity-core',
  'AURA_MEMORY': 'trinity-memory',
  'AURA_MEMORY_SERVICE': 'trinity-memory',
  'MEMORY': 'trinity-memory',
  'PC_BRIDGE_SERVICE': 'trinity-pc-bridge-v2',
  'PC_BRIDGE_V2': 'trinity-pc-bridge-v2',
  'DISPATCHER': 'trinity-dispatcher',
  'DISPATCHER_SERVICE': 'trinity-dispatcher',
  'AUDIT_SERVICE': 'trinity-audit',
  'GUARDIAN': 'trinity-guardian',
  'CONNECTORS': 'trinity-connectors',
  'JERICHO': 'trinity-jericho',
  'COPILOT_BRIDGE': 'trinity-copilot-bridge',
};

export class Dispatcher {
  constructor(env, d1, traceId = null) {
    this.env = env;
    this.d1 = d1;
    this.traceId = traceId || crypto.randomUUID();
  }

  /**
   * Volá service binding s trace propagation
   */
  async call(bindingName, path, options = {}) {
    const binding = this.env[bindingName];
    if (!binding) {
      await this.d1.log(this.traceId, "dispatcher", "service.not_found", "error",
        `Binding ${bindingName} not available`, { binding: bindingName }, "error");
      return { ok: false, status: 502, error: `Binding ${bindingName} not available` };
    }

    const start = Date.now();
    const headers = new Headers(options.headers || {});
    headers.set("X-Trinity-Trace-Id", this.traceId);

    try {
      const response = await binding.fetch(path, {
        ...options,
        headers,
        method: options.method || "POST"
      });

      const ms = Date.now() - start;
      await this.d1.log(this.traceId, "dispatcher", "service.response", "info",
        `${bindingName} responded ${response.status} in ${ms}ms`,
        { binding: bindingName, path, status: response.status, ms }, "ok", ms);

      const body = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, body, latencyMs: ms };
    } catch (err) {
      const ms = Date.now() - start;
      await this.d1.log(this.traceId, "dispatcher", "service.error", "error",
        `${bindingName} failed: ${err.message}`,
        { binding: bindingName, path, error: err.message, ms }, "error", ms);
      return { ok: false, status: 500, error: err.message, latencyMs: ms };
    }
  }

  /**
   * Vykoná nástroj z tool registry
   */
  async executeTool(toolId, input = {}, runId = null, step = 0) {
    const rid = runId || crypto.randomUUID();
    const receiptId = crypto.randomUUID();

    const tool = await this.d1.getTool(toolId);
    if (!tool) {
      await this.d1.log(this.traceId, "dispatcher", "tool.not_found", "warn",
        `Tool not found: ${toolId}`, { tool: toolId }, "error");
      return { status: "not_found", error: `Tool ${toolId} not registered` };
    }

    const binding = this.env[tool.handler_target];
    if (!binding) {
      await this.d1.log(this.traceId, "dispatcher", "tool.no_handler", "error",
        `No binding for ${toolId}: ${tool.handler_target}`,
        { tool: toolId, target: tool.handler_target }, "error");

      // Record failed receipt
      try {
        await this.env.DB.prepare("INSERT INTO core_tool_receipts (id, run_id, step, tool, status, receipt_id, input_json, output_json) VALUES (?,?,?,?,?,?,?,?)")
          .bind(crypto.randomUUID(), rid, step, toolId, "failed", receiptId,
            JSON.stringify(input).slice(0, 8192), '{"error":"no binding"}').run();
      } catch (e) {}

      return { status: "no_handler", error: `No binding for ${tool.handler_target}` };
    }

    const start = Date.now();
    try {
      const response = await binding.fetch(`/tool/${toolId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Trinity-Trace-Id": this.traceId
        },
        body: JSON.stringify({ tool: toolId, input, run_id: rid, step })
      });

      const ms = Date.now() - start;
      const output = await response.json();

      if (response.ok) {
        await this.d1.recordToolSuccess(toolId, ms);
        await this.d1.log(this.traceId, "dispatcher", "tool.success", "info",
          `${toolId} completed in ${ms}ms`, { tool: toolId, ms }, "ok", ms);
        return { status: "success", output, receipt_id: receiptId, latencyMs: ms };
      } else {
        await this.d1.recordToolError(toolId, input, output.error || "unknown");
        await this.d1.log(this.traceId, "dispatcher", "tool.error", "error",
          `${toolId} failed`, { tool: toolId, ms, error: output.error }, "error", ms);
        return { status: "error", error: output.error, receipt_id: receiptId, latencyMs: ms };
      }
    } catch (err) {
      const ms = Date.now() - start;
      await this.d1.recordToolError(toolId, input, err.message);
      await this.d1.log(this.traceId, "dispatcher", "tool.exception", "error",
        `${toolId} threw: ${err.message}`, { tool: toolId, ms, error: err.message }, "error", ms);
      return { status: "exception", error: err.message, receipt_id: receiptId, latencyMs: ms };
    }
  }

  /**
   * Spustí pipeline nástrojov
   */
  async executePipeline(steps, initialInput = {}) {
    const runId = crypto.randomUUID();
    let currentInput = initialInput;
    const results = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await this.d1.log(this.traceId, "dispatcher", "pipeline.step", "info",
        `Pipeline step ${i}/${steps.length}: ${step.tool}`,
        { run_id: runId, step: i, tool: step.tool });

      const result = await this.executeTool(step.tool, currentInput, runId, i);
      results.push({ step: i, tool: step.tool, ...result });

      if (result.status !== "success") {
        await this.d1.log(this.traceId, "dispatcher", "pipeline.failed", "error",
          `Pipeline failed at step ${i}: ${step.tool}`,
          { run_id: runId, step: i, error: result.error }, "error");
        break;
      }
      currentInput = result.output || {};
    }

    await this.d1.log(this.traceId, "dispatcher", "pipeline.complete", "info",
      `Pipeline done: ${results.length}/${steps.length} steps`,
      { run_id: runId, completed: results.length === steps.length });

    return { run_id: runId, results, completed: results.length === steps.length };
  }
}
