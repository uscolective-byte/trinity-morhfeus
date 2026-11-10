/**
 * Trinity Tool-Calling Engine
 * ──────────────────────────
 * Core loop that parses LLM responses for structured tool calls,
 * dispatches them to the correct executor (PC Bridge, Browser, D1, etc.),
 * records receipts in `core_tool_receipts`, and feeds results back
 * into the conversation.
 *
 * Designed to be imported by the main trinity Worker (worker.js)
 * and called from the ChatAgent / TrinityAgent Durable Objects.
 */

// ── Tool registry: maps tool names to executors ──────────────────────
const TOOL_REGISTRY = {
  // PC Bridge tools (local machine via PC_BRIDGE_SERVICE)
  pc_open_file:        { executor: 'pc_bridge', action: 'open_file',   requiresAuth: true },
  pc_execute:          { executor: 'pc_bridge', action: 'execute',      requiresAuth: true },
  pc_list_dir:         { executor: 'pc_bridge', action: 'list_dir',    requiresAuth: true },
  pc_read_file:        { executor: 'pc_bridge', action: 'read_file',   requiresAuth: true },
  pc_write_file:       { executor: 'pc_bridge', action: 'write_file',  requiresAuth: true },
  pc_create_dir:       { executor: 'pc_bridge', action: 'create_dir',   requiresAuth: true },
  pc_run_build:        { executor: 'pc_bridge', action: 'run_build',   requiresAuth: true },

  // Browser Rendering tools (Cloudflare @cloudflare/puppeteer)
  browser_navigate:    { executor: 'browser',   action: 'navigate' },
  browser_screenshot:  { executor: 'browser',   action: 'screenshot' },
  browser_scrape:      { executor: 'browser',   action: 'scrape' },
  browser_fill_form:   { executor: 'browser',   action: 'fill_form' },
  browser_click:       { executor: 'browser',   action: 'click' },
  browser_get_text:    { executor: 'browser',   action: 'get_text' },

  // D1 / data tools
  db_query:            { executor: 'd1',        action: 'query' },
  db_execute:           { executor: 'd1',        action: 'execute' },

  // KV tools
  kv_get:              { executor: 'kv',        action: 'get' },
  kv_put:              { executor: 'kv',        action: 'put' },

  // Ring 0 Autonomous Domain Engine
  domain_orchestrator: { executor: 'ring0',     action: 'orchestrate_domains' },
  domain_prepare:      { executor: 'ring0',     action: 'orchestrate_domains' },
};

// ── Parse LLM response for tool calls ────────────────────────────────
/**
 * Extracts structured tool calls from an LLM text response.
 * Supports two formats:
 *   1. JSON code block: ```json { "tool_calls": [...] } ```
 *   2. Inline JSON: <tool_call name="..." args='{}' />
 */
export function parseToolCalls(llmOutput) {
  const calls = [];

  // Format 1: JSON code block
  const jsonBlockMatch = llmOutput.match(/```json\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        for (const tc of parsed.tool_calls) {
          if (tc.name && TOOL_REGISTRY[tc.name]) {
            calls.push({
              name: tc.name,
              arguments: tc.arguments || {},
              call_id: tc.call_id || generateCallId(),
            });
          }
        }
      }
    } catch (_) { /* not JSON, try other formats */ }
  }

  // Format 2: <tool_call name="..." args='{...}' />
  const inlineMatches = llmOutput.matchAll(/<tool_call\s+name="([^"]+)"\s+args='([^']*)'\s*\/>/g);
  for (const m of inlineMatches) {
    const name = m[1];
    if (TOOL_REGISTRY[name]) {
      try {
        const args = JSON.parse(m[2]);
        calls.push({ name, arguments: args, call_id: generateCallId() });
      } catch (_) { /* skip malformed */ }
    }
  }

  return calls;
}

function generateCallId() {
  return 'tc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

// ── Main execution loop ───────────────────────────────────────────────
/**
 * Runs the full tool-calling cycle:
 *   1. Parse LLM output for tool calls
 *   2. For each call: dispatch to executor, get result
 *   3. Record receipt in D1 `core_tool_receipts`
 *   4. Return structured results for the next LLM turn
 *
 * @param {string} llmOutput  - Raw text from the LLM
 * @param {object} env        - Worker environment (bindings)
 * @param {object} ctx        - Request context (user, session)
 * @returns {Promise<{calls: array, results: array, hasToolCalls: boolean}>}
 */
export async function executeToolCalls(llmOutput, env, ctx) {
  const calls = parseToolCalls(llmOutput);

  if (calls.length === 0) {
    return { calls: [], results: [], hasToolCalls: false };
  }

  const results = [];
  let stepNum = 0;

  for (const call of calls) {
    stepNum++;
    const spec = TOOL_REGISTRY[call.name];
    let result;

    try {
      switch (spec.executor) {
        case 'pc_bridge':
          result = await dispatchToPcBridge(call, spec, env, ctx);
          break;
        case 'browser':
          result = await dispatchToBrowser(call, spec, env, ctx);
          break;
        case 'd1':
          result = await dispatchToD1(call, spec, env);
          break;
        case 'kv':
          result = await dispatchToKV(call, spec, env);
          break;
        case 'ring0':
          if (spec.action === 'orchestrate_domains') {
            const { handleDomainOrchestration } = await import('../tools/domain-orchestrator.js');
            result = await handleDomainOrchestration(env, { ...call.arguments, sessionId: ctx?.sessionId, runId: call.call_id });
          } else {
            result = { status: 'ERROR', message: `Unknown ring0 action: ${spec.action}` };
          }
          break;
        default:
          result = { status: 'ERROR', message: `Unknown executor: ${spec.executor}` };
      }
    } catch (err) {
      result = { status: 'ERROR', message: err.message || String(err) };
    }

    // Record receipt in D1
    await recordReceipt(env, {
      call_id: call.call_id,
      tool_name: call.name,
      executor: spec.executor,
      action: spec.action,
      arguments: JSON.stringify(call.arguments),
      status: result.status || 'UNKNOWN',
      result: JSON.stringify(result),
      user_id: ctx.userId || 'unknown',
      session_id: ctx.sessionId || 'unknown',
      step: stepNum,
    });

    results.push({ call_id: call.call_id, tool: call.name, ...result });
  }

  return { calls, results, hasToolCalls: true };
}

// ── PC Bridge dispatcher ─────────────────────────────────────────────
async function dispatchToPcBridge(call, spec, env, ctx) {
  const bridgeService = env.PC_BRIDGE_V2 || env.PC_BRIDGE_SERVICE;
  if (!bridgeService) {
    return { status: 'ERROR', message: 'PC_BRIDGE service binding not configured' };
  }

  // Check if PC is online (via PC_STATE KV)
  const pcStatus = await env.PC_STATE.get('pc:status');
  if (pcStatus) {
    const status = JSON.parse(pcStatus);
    if (status.online !== true) {
      return { status: 'OFFLINE', message: 'PC Bridge is not connected. Daemon must be running on the target machine.' };
    }
  }

  // Forward to PC Bridge service binding
  const response = await bridgeService.fetch('https://pc-bridge.internal/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bridge-Key': env.PC_BRIDGE_KEY || '',
      'X-Session-Id': ctx.sessionId || '',
    },
    body: JSON.stringify({
      action: spec.action,
      arguments: call.arguments,
      call_id: call.call_id,
    }),
  });

  if (!response.ok) {
    return { status: 'ERROR', message: `PC Bridge returned ${response.status}` };
  }

  return await response.json();
}

// ── Browser Rendering dispatcher ─────────────────────────────────────
async function dispatchToBrowser(call, spec, env, ctx) {
  const { action, arguments: args } = { action: spec.action, arguments: call.arguments };

  // Priority 1: Forward to dedicated trinity-browser service binding if configured
  const browserService = env.TRINITY_BROWSER;
  if (browserService) {
    try {
      const resp = await browserService.fetch('https://internal/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, args })
      });
      if (resp.ok) return await resp.json();
    } catch (_) {
      // Fall through to direct BROWSER binding
    }
  }

  // Priority 2: Direct browser rendering binding
  if (!env.BROWSER) {
    return { status: 'ERROR', message: 'Neither TRINITY_BROWSER service nor BROWSER binding is configured' };
  }

  const puppeteer = await import('@cloudflare/puppeteer');
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();

    switch (action) {
      case 'navigate': {
        await page.goto(args.url, { waitUntil: 'networkidle0', timeout: 30000 });
        const title = await page.title();
        return { status: 'SUCCESS', message: `Navigated to ${args.url}`, title };
      }
      case 'screenshot': {
        if (args.url) await page.goto(args.url, { waitUntil: 'networkidle0' });
        const screenshot = await page.screenshot({ type: 'png' });
        // Store in R2
        const key = `screenshots/${call.call_id}.png`;
        await env.R2.put(key, screenshot);
        return { status: 'SUCCESS', message: 'Screenshot captured', r2_key: key };
      }
      case 'scrape': {
        await page.goto(args.url, { waitUntil: 'networkidle0' });
        const content = await page.evaluate(() => document.body.innerText);
        return { status: 'SUCCESS', content: content.slice(0, 10000) };
      }
      case 'get_text': {
        if (args.url) await page.goto(args.url, { waitUntil: 'networkidle0' });
        const selector = args.selector || 'body';
        const text = await page.$eval(selector, el => el.textContent);
        return { status: 'SUCCESS', text };
      }
      case 'fill_form': {
        if (args.url) await page.goto(args.url, { waitUntil: 'networkidle0' });
        for (const field of (args.fields || [])) {
          await page.type(field.selector, field.value);
        }
        return { status: 'SUCCESS', message: 'Form fields filled' };
      }
      case 'click': {
        if (args.url) await page.goto(args.url, { waitUntil: 'networkidle0' });
        await page.click(args.selector);
        await page.waitForTimeout(1000);
        return { status: 'SUCCESS', message: `Clicked ${args.selector}` };
      }
      default:
        return { status: 'ERROR', message: `Unknown browser action: ${action}` };
    }
  } finally {
    await browser.close();
  }
}

// ── D1 dispatcher ─────────────────────────────────────────────────────
async function dispatchToD1(call, spec, env) {
  const db = env.DB || env.TRINITY_D1;
  if (!db) return { status: 'ERROR', message: 'D1 binding not configured' };

  if (spec.action === 'query') {
    const result = await db.prepare(call.arguments.sql).bind(...(call.arguments.params || [])).all();
    return { status: 'SUCCESS', rows: result.results, meta: result.meta };
  } else {
    const result = await db.prepare(call.arguments.sql).bind(...(call.arguments.params || [])).run();
    return { status: 'SUCCESS', meta: result.meta };
  }
}

// ── KV dispatcher ─────────────────────────────────────────────────────
async function dispatchToKV(call, spec, env) {
  const kv = env.TRINITY_KV || env.Mastermind;
  if (!kv) return { status: 'ERROR', message: 'KV binding not configured' };

  if (spec.action === 'get') {
    const value = await kv.get(call.arguments.key);
    return { status: 'SUCCESS', value };
  } else if (spec.action === 'put') {
    await kv.put(call.arguments.key, call.arguments.value, {
      expirationTtl: call.arguments.ttl,
    });
    return { status: 'SUCCESS', message: `Key ${call.arguments.key} stored` };
  }
  return { status: 'ERROR', message: `Unknown KV action: ${spec.action}` };
}

// ── Record receipt in D1 ─────────────────────────────────────────────
// Uses the EXISTING core_tool_receipts schema:
//   id (PK), run_id, step, tool, status, receipt_id,
//   input_json, output_json, created_at
//   (+ optional: executor, action, user_id, session_id, completed_at if ALTER was applied)
async function recordReceipt(env, receipt) {
  const db = env.DB || env.TRINITY_D1;
  if (!db) return;

  // Pack all metadata into input_json for the base schema
  const inputJson = JSON.stringify({
    arguments: receipt.arguments ? JSON.parse(receipt.arguments) : {},
    executor: receipt.executor,
    action: receipt.action,
    user_id: receipt.user_id,
    session_id: receipt.session_id,
  });

  // Try the extended schema first (if ALTER TABLE was applied);
  // fall back to base schema if the extra columns don't exist.
  try {
    await db.prepare(`
      INSERT INTO core_tool_receipts
        (receipt_id, run_id, step, tool, status, input_json, output_json,
         executor, action, user_id, session_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      receipt.call_id,
      receipt.session_id || 'run_' + receipt.call_id,
      receipt.step || 0,
      receipt.tool_name,
      receipt.status,
      inputJson,
      receipt.result,
      receipt.executor,
      receipt.action,
      receipt.user_id,
      receipt.session_id,
    ).run();
  } catch (_extendedError) {
    // Fallback: base schema only (no executor/action/user_id/session_id columns)
    await db.prepare(`
      INSERT INTO core_tool_receipts
        (receipt_id, run_id, step, tool, status, input_json, output_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      receipt.call_id,
      receipt.session_id || 'run_' + receipt.call_id,
      receipt.step || 0,
      receipt.tool_name,
      receipt.status,
      inputJson,
      receipt.result,
    ).run();
  }
}

// ── System prompt fragment for tool-calling ──────────────────────────
export const TOOL_CALLING_SYSTEM_PROMPT = `
You have access to real tools. When the user asks you to perform an action,
respond with a JSON code block containing tool_calls:

\`\`\`json
{
  "tool_calls": [
    {
      "name": "pc_open_file",
      "arguments": { "path": "C:\\\\Users\\\\saboi\\\\project\\\\index.html" },
      "call_id": "tc_001"
    }
  ]
}
\`\`\`

Available tools:
- pc_open_file: Open a file on the user's PC (args: path)
- pc_execute: Run a command on the user's PC (args: command, cwd)
- pc_list_dir: List directory contents (args: path)
- pc_read_file: Read file contents (args: path)
- pc_write_file: Write content to a file (args: path, content)
- pc_create_dir: Create a directory (args: path)
- pc_run_build: Run a build command (args: command, cwd)
- browser_navigate: Navigate to a URL (args: url)
- browser_screenshot: Take a screenshot (args: url)
- browser_scrape: Scrape page text content (args: url)
- browser_get_text: Get text from a selector (args: url, selector)
- browser_fill_form: Fill form fields (args: url, fields[{selector, value}])
- browser_click: Click an element (args: url, selector)
- db_query: Query D1 database (args: sql, params[])
- db_execute: Execute D1 statement (args: sql, params[])
- kv_get: Get KV value (args: key)
- kv_put: Put KV value (args: key, value, ttl)
- domain_orchestrator: Generate, configure DNS, reserve and list strategic domains on $TTK escrow (args: domains[])

After tool execution, you will receive the results and should respond naturally.
`;
