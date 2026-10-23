# Aura Worker audit — 2026-10-23

## Identity and scope
- Source repository: `uscolective-byte/trinity-morhfeus`, `main`.
- Affected modules: `Trinity/services/aura-entry.js`, ten `Trinity/services/legacy-workers/aura_*.js` roles, shared helpers, `Trinity/workers/aura/*.jsonc`, and tests.
- The checked Wrangler production custom domain is **`auru.space`**, development is `auru.dev`. No verified `aura.space` custom route was found in this source. Treat any aura.space registration/routing as unknown.
- This change modifies the **code**, not Cloudflare resources or live customers.

## Ranked findings and actions

| Priority | Finding | Evidence | Remediation |
|---|---|---|---|
| Critical | Unbounded `aura.execute_skill` could reach administrative `skillRegistry` integrations, including domain operations. | `services/aura-entry.js` imports the global skill registry and executes arbitrary names. | Use an explicit 2-skill, read-only registry. Require scoped credentials before expanding it. |
| Critical | Approval on deploy and graph mutations was a claim contained in user-supplied JSON. | `approved(call)` checked only `actor_role`, request UUID and a boolean. | Require Cloudflare Worker secret `AURA_SERVICE_TOKEN` (32+ chars), sent by approved callers via `X-Aura-Service-Token`, alongside approved request metadata. Mutating operations fail closed without it. |
| Critical | `deploy.complete` and `deploy.rollback` marked SQL records as successful without invoking Cloudflare or verifying a deployment ID. | `legacy-workers/aura_deployer.js`. | Return explicit 501 (unsupported) until Wrangler/Cloudflare deployment receipt integration is implemented. Stage requires KV + D1 writes and never claims live deploy. |
| High | `test.endpoint` followed HTTP redirects and permitted arbitrary request methods, bodies and headers from client input. | `legacy-workers/aura_tester.js`. | Only `GET/HEAD` for `/health` or `/ready` on `auru.space`/`auru.dev`; redirect disabled, 5-second timeout, response bounded to 2 KiB. |
| High | DB mutations swallowed errors and reported success. | `safeDbRun` applied to INSERT statements in eight roles. | Introduce fail-closed `safeDbWrite`; use for mutation operations. |
| Medium | Main Aura gateway imported the full skill registry with a large transitive dependency graph, inflating Worker bundle. | `aura-entry.js` imports `src/skillRegistry.js`. | Load the narrow `aura-safe-skills.js` module; retain full registry inside the authenticated application. |
| Medium | Request-length guard checked JavaScript string length, not UTF-8 bytes. | `aura-entry.js`. | Check encoded byte length; follow with streaming hard cap later. |
| Medium | Role-specific status strings still show legacy `10.2.0` while the main package declares `11.0.0`. | 10 worker modules. | Make status metadata generated from one source in a follow-up release; do not blindly change historical service versions. |
| Medium | `CODE_KV` and `IDEMPOTENCY` in `aura_deployer.jsonc` point to the same KV namespace. | Wrangler config namespace IDs match. | Provision a separate KV namespace before changing bindings, then migrate keys intentionally. |
| Medium | Repeated request parsing and identical headers in 10 role files. | Each `aura_*.js` repeats POST/JSON scaffolding. | Consolidate behind `worker-runtime.js` after contract tests are green. |
| Medium | Legacy `safeDbRun` still suppresses SELECT errors, making outage appear as empty results. | `aura_helpers.js`. | Replace selected reads with explicit `data_unavailable` state, then remove silent fallback. |
| Low | Unused imports in deployer. | `parseAuraJson` and `safeDbRun` were imported but unused after hardening. | Removed. |
| Low | Repeated outdated inline comments and hard-coded versions. | `legacy-workers/aura_*.js`. | Replace with generated module metadata in separate small PR. |

## Delete and modification decision

**Removed now:** unused imports, unrestricted skill registry wiring, misleading `deploy.complete/rollback` SQL updates, user-supplied endpoint probe methods/headers, silent SQL mutation behavior.

**Do not delete yet:** `services/legacy-workers/*`, `workers/aura/*.jsonc`, historical D1 migrations, or `src/legacy.js` because named Worker bindings/configurations still reference them. Removal requires a verified map of deployed consumers and a deprecation window.

**Potential later cleanup:** legacy fallback modules, overlapping dispatcher/router abstractions, archived Cloudflare exports and duplicate root build tasks. Each candidate requires import graph + deployment verification.

## Rollout and safety

1. Code review on a dedicated branch; run `node --test Trinity/tests/aura-services.test.mjs` and `npm test` inside Trinity with installed dependencies.
2. Configure `AURA_SERVICE_TOKEN` as a secret on relevant Workers and caller side; never commit secret values.
3. Confirm service bindings are non-public, Cloudflare routes are correct, and privileged calls provide an independently authenticated approval.
4. Verify staging role health, skill scope, denial tests, bounded endpoint probes, D1 errors and idempotency.
5. Deploy and observe on staging; production only when CI is green and rollback receipt is ready.

**Remaining risks:** KV idempotency get/put is not an atomic lock; high-impact transaction calls need a single-flight Durable Object or D1 uniqueness lock before relying on exactly-once semantics. Current audit logging catches and logs DB failures without failing the underlying action. Do not call this a full zero-defect audit.
