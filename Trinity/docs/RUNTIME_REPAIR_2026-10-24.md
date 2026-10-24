# Trinity 11.0 runtime repair

The runtime now distinguishes configured capabilities, catalog instructions, plans and actual results. This repair does not claim external integrations are operational without provider receipts.

- Canonical source: `uscolective-byte/trinity-morhfeus`, `main`; deploys must carry the full commit SHA and pass `verify-deployment.mjs` on each domain.
- Agent executions use the configured model and owned agent record. Failed models/tools are recorded as failed. Confidence and truth evaluation are not invented.
- Agent domain provisioning currently saves a plan only (`applied: false`). Use the existing authenticated domain tools for real DNS changes. There is no mock zone, placeholder IP or invented SSL/WAF acknowledgement.
- Worker delegation requires server-derived administrator authorization for mutations and the existing `AURA_SERVICE_TOKEN` for Aura mutations. The model cannot supply owner approval. Fleet checks use GET `/health`, not arbitrary action names.
- Extended catalog skills return `catalog-only`; they are instructions, not executable workers. Core catalog blueprints return `plan-ready`. Installed executable functions remain in the skill registry.
- A custom agent can receive `tool_inputs` keyed by its configured skill name, enabling real validated parameters instead of sending every tool a generic prompt.

## Existing Cloudflare credentials

Worker Secrets are consumed in place and never copied into source or prompts. Supported provider aliases and Secrets Store bindings are resolved by `src/runtime-secrets.js`. A failed binding is reported unavailable and cannot silently switch to a different account; it does not take down unrelated providers.

Owner/admin endpoints:

- `GET /api/assistant/secrets/status`: supported credential names, configured/missing/unavailable status, and unmapped names; never values.
- `GET /api/assistant/runtime/manifest`: configured workers, skill catalog and credential status. Configuration is not execution verification.

Supported keys include the existing OpenAI, Gemini, Anthropic, Groq, DeepSeek, Mistral, OpenRouter, Ollama, Cloudflare, GitHub, Firecrawl, Google OAuth, Copilot Studio, Aura service, PC Gateway, Telegram and PayPal bindings. Existing canonical names take precedence over aliases. Only attach credentials to services that need them. Secrets are environment-specific; do not copy production credentials into development automatically.

To inspect deployed names without values, use `wrangler secret list --env=""` and `wrangler secret list --env development` from `Trinity/`. Cloudflare does not return stored secret values. Actual provider calls must be checked separately before reporting an integration as verified.

## Verification

Run `npm run setup`, `npm run check`, `npm --prefix Trinity run build:development`, and `npm run docs:check`. The full check includes module tests, integration runtime tests and dependency audit. A Wrangler dry-run is a build, not a deployment.
