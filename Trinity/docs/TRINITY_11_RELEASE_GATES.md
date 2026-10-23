# Trinity 11.0 — release gates and evidence ledger

Status: **DRAFT CHANGESET / NOT DEPLOYED**. The current **source release metadata** in main is **11.0.0**. Live deployment of that version has not been independently verified. This branch is the first hardening change, not a verified 11.0 production release.

Canonical repository: `uscolective-byte/trinity-morhfeus`; deployment source: `main`.

| Pillar | Current verifiable implementation | Remaining release gate |
| --- | --- | --- |
| 1. Code quality | Existing modular JS, dry-run build and 50+ test modules; targeted hardening tests added | Full repository static scan, lint/typecheck, dependency audit, green Actions logs, no unreviewed destructive refactor |
| 2. Agent Lab | Existing `agent-sandbox.js` + `ops_custom_agents`, indexed D1 migration | Authenticated browser UI/e2e tests, isolated runtimes, memory quotas, execution receipts, real deployment |
| 3. Connectors | Existing Workers AI, Gemini/OpenAI/Copilot, PC Bridge, external adapters | Test tokens without logging, real device online, Google OAuth client secret, service-by-service live verification |
| 4. UI | Main navigation simplified, fintech status labels corrected, chat is default | Visual review on mobile/desktop, accessibility checks, full UI consistency, stale-data/error testing |
| 5. Domains | Existing registration API with quote+owner-price confirmation; fake DNS and silent demo seeding blocked | Cloudflare zone permission, actual registrar receipt, verified DNS, TLS and WAF for each requested domain |
| 6. Finance | Existing EPC QR, receipt ledger, payment links and on-chain read-only verification | Merchant OAuth/API onboarding, bank read integration, idempotent signed webhooks, dispute/replay handling, independent balance and settlement proofs |
| 7. Phone | Existing Telegram sender with token/chat ID requirement | Real Telegram subscriber and webhook verification, SMS/WhatsApp integration only after provider onboarding and opt-in |
| 8. D1/security/CI | WebAuthn/passkeys, roles, audit, D1 migration 0047, GitHub CI | Verified CI, remote D1 backup bookmark, migration audit, canary and rollback verification |

## Release blockers

1. **CI**: PR #53 started Trinity CI, integration checks and CodeQL. They reported failure, but GitHub returned no job steps and job log blobs were unavailable. Do not interpret as pass or automatically merge.
2. **Cloudflare**: no authenticated Cloudflare deployment session is available in the current ChatGPT tool connection. Local Windows Desktop Commander device was offline. Production and development were not changed.
3. **Google OAuth**: the current Wrangler configuration says `GOOGLE_ENABLED=false`. Never enable login until the Worker contains a valid OAuth client secret and production/development callback URIs have been registered.
4. **Finance**: a PayPal email or Revolut RevTag is not merchant API authorization. Bank balances and transfers are not provided by the current ledger, and no webhook payment confirmation can be assumed.
5. **Domains**: an internal Cloudflare-zone listing is not a domain registration receipt, HTTPS deployment, verified WAF policy, or DNS write.
6. **Performance**: zero latency and zero defects are not attainable engineering guarantees. Publish measured percentiles, availability objectives, and audit proofs instead.

## Protected deployment sequence

From a checked-out repository after all CI checks have passed:

```powershell
cd Trinity
npm ci
npm test
npm run build:development
npm run build
npx wrangler d1 migrations list trinity-development --env development --remote
npx wrangler d1 migrations apply trinity-development --env development --remote
npm run deploy:development
node scripts/verify-deployment.mjs https://auru.dev <commit-sha-or-worker-version>
# Review staging receipts before applying production migrations.
npx wrangler d1 time-travel info trinity-v03
npx wrangler d1 migrations list trinity-v03 --remote
npx wrangler d1 migrations apply trinity-v03 --remote
npm run deploy
node scripts/verify-deployment.mjs https://auru.space <commit-sha-or-worker-version>
```

Never copy real credentials into Git, issue comments or plaintext logs. Register purchase-price and paid-transfer approval as separate high-risk operations. For self-improving agents, use branch → tests → review → canary → promote, with rollback and audit. Every external action must return independent evidence.

## Files changed in the groundwork PR

- `Trinity/public/assistant/chat.html`
- `Trinity/public/assistant/chat.js.txt`
- `Trinity/src/agent-sandbox.js`
- `Trinity/src/domain-environments.js`
- `Trinity/src/integration-readiness.js`
- `Trinity/src/index.js`
- `Trinity/migrations/0047_agent_lab_indexes.sql`
- `Trinity/tests/trinity11-hardening.test.mjs`
- `Trinity/docs/TRINITY_11_RELEASE_GATES.md`

The complete unchanged repository continues to be the source of truth for unmodified files. Do not claim an entire-repo rewrite from this incremental patch.
