# Trinity Worker audit - 2026-10-10

This is an evidence-based inventory of the Cloudflare account and the checked-out
`uscolective-byte/trinity-morhfeus` source. Secret values are intentionally omitted.

## Production inventory

| Worker | Purpose / contract | Verified bindings | Result in this change |
| --- | --- | --- | --- |
| `trinity` | Public UI/API, orchestration, Agents SDK, Workflows, MCP, model routing | DO, Workflow, KV, D1, R2, AI, Secrets Store, 20 service bindings | Upgraded to 9.0.0 and deployed. Added `/ready`, binding/schema checks and role-specific dependency probes. |
| `aura_analyzer` | AI analysis | AI, D1, idempotency KV | Restored bindings, validation, bounded health, audit logging and safe errors; deployed. |
| `aura_architect` | Architecture proposals and graph mutations | AI, D1, idempotency KV | Added approval/idempotency gates for mutations; deployed. |
| `aura_codegen` | Code generation | AI, D1, idempotency KV | Added strict action/input controls and observability; deployed. |
| `aura_deployer` | Staged deployment state | AI, D1, code/idempotency KV | Added approval/idempotency gates for stage/complete/rollback; deployed. |
| `aura_evolver` | Evolution proposals | AI, D1, idempotency KV | Added strict action/input controls and observability; deployed. |
| `aura_memory` | Aura memory operations | AI, D1, idempotency KV | Restored missing runtime bindings and safe wrapper; deployed. |
| `aura_optimizer` | Optimization proposals | AI, D1, idempotency KV | Added strict action/input controls and observability; deployed. |
| `aura_planner` | Planning | AI, D1, idempotency KV | Added strict action/input controls and observability; deployed. |
| `aura_sentinel` | Aura security analysis | AI, D1, idempotency KV | Added strict action/input controls and observability; deployed. |
| `aura_tester` | Endpoint/code testing | AI, D1, idempotency KV | Added approval gate and HTTPS Trinity-domain SSRF restriction; deployed. |
| `trinity-core` | Reasoning, reflection, personality and state | AI, D1; secret name preserved | Source and bindings inspected. Legacy runtime remains; mutation validation/approval still needs a dedicated compatibility pass. |
| `trinity-builder` | Generate/store/list code artifacts | AI, D1, idempotency KV | Reconciled with the live D1 schema, added validation/idempotency/health/safe errors and deployed. |
| `trinity-dispatcher` | Jobs/tasks and dispatch | D1 | Source inspected. `route_aura` references a missing `TRINITY` binding; not changed because adding a circular service path needs an integration test first. |
| `trinity-connectors` | Connector registry and tests | D1, idempotency KV | Reconciled with the live D1 schema; added approval, idempotency and SSRF controls and deployed. |
| `trinity-guardian` | Security scans, approvals and audit | D1; secret names preserved | Source and bindings inspected. Main orchestrator now probes its real action contract. |
| `trinity-memory` | Dedicated memory API | dedicated D1 (`TRINITY_DB`) | Source and binding inspected; already on a current compatibility date. No data migration was applied. |
| `trinity-sentinel` | Monitoring and token/event views | D1 | Source and binding inspected. Legacy runtime remains. |
| `trinity-skills` | Skill registry/execution | AI, D1 | Source and bindings inspected. Legacy runtime remains. |
| `trinity-ops` | Read-only operational views | D1 | Source and binding inspected. Legacy runtime remains. |
| `trinity-pc-bridge` | Durable Object PC command bridge | DO; protected secret bindings | Source, handlers and bindings inspected. Existing Access/secret boundary was preserved; no destructive redeploy. |
| `trinity-pc-bridge-v2` | KV-backed PC heartbeat/status bridge | KV | Source and binding inspected. Access currently protects the endpoint; no redeploy. |

`trinity-knowledge` was present only as a local project and was not found as a
deployed Cloudflare Worker. The local `Capacity-Worker` project was also tested
but is not deployed under this account.

## Routes and exposure

- `trinity` is served on `auru.dev`, `auru.space`, configured wildcard/custom
  routes and scheduled/workflow triggers.
- The ten Aura services have no public route or workers.dev target; they are
  consumed through service bindings from `trinity`.
- Legacy Trinity and PC bridge workers that exposed workers.dev URLs were
  observed behind Cloudflare Access. That boundary was not removed.

## Database and migration check

- Remote D1 migration state reported no pending migration.
- The production `conversations` table includes `message_count`.
- `/ready` now verifies this historical compatibility condition when the legacy
  table exists, while also accepting the current `ops_jobs` schema.
- No production rows or schemas were deleted or rewritten.
- Duplicate local migration sequence `0023` remains intentionally untouched;
  blindly renaming or replaying it could apply a migration twice.

## Verification receipts

- Main deployment: version `2765bcd6-4305-453a-ae36-c86406d006a1`.
- Aura deployments: versions `0a385f32`, `ced62a1d`, `aedf1fff`, `c2db07a1`,
  `e0a785c1`, `a1ddeb90`, `5c551ab4`, `674602de`, `b72c92ae`, `bb9d6800`.
- Builder and connectors deployments: versions `c44e2511` and `a209e71d`.
- A local Wrangler probe using remote production service bindings returned HTTP
  200 and `ok: true` from both repaired workers.
- `https://auru.dev/health` and `https://auru.space/health`: HTTP 200, version 9.0.0.
- `https://auru.dev/ready` and `https://auru.space/ready`: HTTP 200, bindings/schema/cache ready.
- Local build and test suite: 101 passed, 0 failed.
- Aura configuration dry runs: 10 passed.
- `git diff --check`: passed.
- Dependency audit: 3 high findings in the Agents SDK MCP dependency chain.
  The automated fix is a breaking downgrade and was not applied without a
  dedicated compatibility upgrade/test.

## Follow-up priority

1. Add compatibility tests and role-specific guards to the remaining legacy
   `trinity-*` API workers before replacing their live scripts.
2. Repair `trinity-dispatcher`'s missing `TRINITY` integration without creating
   an unbounded service-binding loop.
3. Upgrade the Agents SDK/MCP dependency chain after validating the current
   API surface and rerunning all 97+ tests.
4. Reconcile the two local-only Worker projects with an explicit product owner
   decision before creating any new production Worker.
