# Trinity Tool-Calling Components

Three modules that give Trinity real "hands" — the ability to execute actions on your PC, automate browser tasks, and record every action as a verifiable receipt.

## Architecture

```
User chat message
  ↓
Trinity Worker (Llama 3.3 70B) generates tool_calls JSON
  ↓
tool-calling-engine.js parses & dispatches
  ↓
┌─────────────────┬──────────────────┬──────────────┐
│  PC Bridge      │  Browser (edge)  │  D1 / KV     │
│  (local daemon) │  (puppeteer)     │  (data)      │
└─────────────────┴──────────────────┴──────────────┘
  ↓
core_tool_receipts (D1) ← receipt for every execution
  ↓
Trinity responds with results
```

## 1. Tool-Calling Engine (`tool-calling-engine.js`)

Integrates into your existing `worker.js` / `ChatAgent` Durable Object.

**Usage in Worker:**
```javascript
import { executeToolCalls, TOOL_CALLING_SYSTEM_PROMPT } from './tool-calling-engine.js';

// Inside your chat handler, after getting LLM response:
const toolResult = await executeToolCalls(llmResponse, env, { userId, sessionId });

if (toolResult.hasToolCalls) {
  // Feed results back to LLM for a natural-language summary
  const summary = await runInferenceCascade(env, {
    messages: [...conversation,
      { role: 'assistant', content: llmResponse },
      { role: 'system', content: `Tool results: ${JSON.stringify(toolResult.results)}` },
      { role: 'user', content: 'Summarize what happened.' }
    ]
  });
  return new Response(summary);
}
```

## 2. PC Bridge Daemon (`pc-bridge-daemon.js`)

Runs on your Windows PC. Listens on `localhost:7777`.

**Setup:**
```powershell
# On your PC:
cd C:\TrinityWorkspace\trinity-tools
npm install
$env:BRIDGE_SECRET = "your-secret-here"  # must match PC_BRIDGE_KEY in Worker
node pc-bridge-daemon.js
```

**Security features:**
- Binds to `127.0.0.1` only (never external)
- HMAC-SHA256 signature verification on every request
- Command allowlist (npm, node, git, wrangler, forge, hardhat, etc.)
- Path traversal prevention
- Shell metacharacter blocking (`; & | $ \``)
- Full audit log to `bridge-audit.log`

**Worker side (already configured):**
- `PC_BRIDGE_SERVICE` → `trinity-pc-bridge` service binding
- `PC_BRIDGE_V2` → `trinity-pc-bridge-v2` service binding
- `PC_BRIDGE_KEY` → shared secret
- `PC_STATE` → KV namespace for online status

## 3. Browser Automation (`browser-automation.js`)

Uses Cloudflare Browser Rendering (`@cloudflare/puppeteer`).

**wrangler.toml binding:**
```toml
[[browser]]
binding = "BROWSER"
```

**Available actions:**
- `navigate` — go to URL, return title
- `screenshot` — capture page, store in R2
- `scrape` — extract visible text
- `extract` — structured data via CSS selector
- `fill_form` — fill and submit forms
- `click` — click an element

**Important:** For social media platforms (X, Reddit, Meta), use their **official APIs** (Meta Graph API, X API v2, Reddit API) rather than browser automation. Datacenter IPs are blocked by these platforms, and automating login flows to circumvent bot detection violates their Terms of Service. Your Worker already has `META_APP_ID`, `META_APP_SECRET`, and `META_GRAPH_VERSION` bindings configured for the Meta Graph API.

## 4. Schema Migration (`schema-migration.sql`)

Run against `trinity-v03` D1 to ensure `core_tool_receipts` has the right columns and seed the tool registry.

```bash
npx wrangler d1 execute trinity-v03 --file=trinity-tools/schema-migration.sql
```

## What's NOT included (and why)

- **Social media auto-login via browser:** Circumventing platform bot detection violates Terms of Service. Use official APIs instead (Meta Graph API, X API v2, Reddit API). Your Worker already has Meta OAuth bindings.
- **$TTK token launch / DEX listing / liquidity pools:** This is financial/crypto advice outside the scope of Cloudflare tooling. For on-chain interactions (Base RPC calls, balance checks), the `ttk-sync.js` pattern in your existing code handles read-only RPC. Smart contract deployment and DEX listing require separate tooling (Foundry/Hardhat) and should be done with appropriate financial/legal review.
