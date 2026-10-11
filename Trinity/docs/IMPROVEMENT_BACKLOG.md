# Trinity improvement backlog

Generated suggestions supplied by the user are ideas, not evidence that a
plugin, table, command, connector or deployment exists.

## Current implementation

User/admin workspace UI and a protected, read-only Developer status endpoint.
See `WORKSPACE_UI.md` for implementation, tests and rollout limits.

## Next two priorities: awaiting confirmation

The previous generated response suggested OneDrive sync and scheduled tasks
as an example pair. The user requested two next improvements but has not yet
confirmed which pair. Do not silently substitute this example for a decision.

- **OneDrive project continuity:** inspect the real Windows/OneDrive location,
  preserve local changes, exclude credentials and build/cache directories,
  verify actual native sync or design an authenticated connector if necessary.
  A proposed plugin ID is not an installable package.
- **Scheduled work:** specify the exact task, timing/timezone, data scope,
  permissions, cancellation and receipts. Do not schedule unrestricted PC
  command execution or create unattended tasks from a vague wishlist.

## Other proposed work, not installed

- Task priorities, reminders and calendar-aware dates.
- Voice input/output with explicit microphone permission and data handling.
- Configuration snapshots and restore, excluding credentials.
- Local document search/indexing and Markdown preview.
- Calendar, email and multi-channel notifications through actual supported
  authenticated interfaces; HTTP web fetching is not an IMAP/SMTP client.
- Script sandboxing and bounded code tests, subject to available PC tools.
- Real schema validation, translation and document summarization.
- Plugin management quality and version visibility in existing Settings.
- Container tooling if installed and authorized; no invented PC tool names.
- File streaming with measured runtime limits, not arbitrary 100 MB chunks.
- Encryption design, key recovery, tenant isolation and offline operation.
- Model evaluation or fine-tuning only after establishing provider support,
  privacy, cost, hardware and dataset readiness.
- Charts and developer assistance after choosing actual implementations.

Any requested extension needs source/capability verification before changes.
No new PC permissions, integrations, cron jobs or plugin installations were
performed merely because these ideas appeared in a generated answer.

## Expanded roadmap: proposed delivery order

This is a development plan, not an implementation or deployment report.
The order below is a recommendation; it does not select the previously
unconfirmed pair of improvements or authorize privileged actions.

### First delivery slice: admin development workflow

- [ ] **DEV-01 — Repair PC tool validation and receipt effect classification.**
  Await explicit human approval for this specific repair. Preserve server-side
  admin authorization, plugin checks, action approval and gateway path policy.
  Verify valid/invalid input, user denial, pending/failed actions and real
  completion receipts in tests. Do not label a completed write as a read.
- [ ] **DEV-02 — Reconcile cloud tool schemas with gateway capabilities.**
  Make unsupported actions explicit; a registered cloud tool is not proof of
  gateway support. Expose no arbitrary shell access or additional applications.
- [ ] **DEV-03 — Complete the admin write interaction.**
  Show target, proposed change, approval state and actual execution result.
  Keep production deployment separate from editing. Require conflict checks
  before overwriting existing files; never claim success from queue acceptance.
- [ ] **UI-01 — Validate the user/admin workspace on mobile and desktop.**
  Check navigation, focus, keyboard access, dark/light themes, readable statuses
  and pending/error/empty states. Non-admin users must not gain privileged
  access through hidden buttons or direct API requests.
- [ ] **AUD-01 — Specify and test audit records.**
  Record action ID, verified actor, timestamps, status and receipt references.
  Before adding content hashes, define canonicalization and privacy handling;
  never include secrets or raw sensitive inputs/outputs in an audit record.
- [ ] **REL-01 — Deliver a tested pilot without overwriting local work.**
  Reconcile the open branch and its merge conflicts first. Test on an isolated
  environment, define rollback and obtain approval for production deployment.
  Passing repository tests is not proof of deployment or a Windows PC write.

DEV-01 remains approval-gated. UI review and planning can proceed independently.
This documentation update creates no new permissions, endpoints or PC actions.

### Requested expansion backlog

| ID | Area | Smallest useful pilot | Acceptance and dependency |
| --- | --- | --- | --- |
| UI-02 | Canvas and project templates | Choose analysis/development/support templates, then prototype a Markdown/card canvas with keyboard-accessible reordering. | Persist and reload layout; isolate preview content; treat charts/diagrams as separately specified components, not already available widgets. |
| MM-01 | Voice and video | Start with opt-in voice transcription to an editable note; evaluate short video analysis separately. | Verify provider support, language accuracy, consent, retention, file limits and cost before upload. No microphone permission implied by this wishlist. |
| PLG-01 | Plugin marketplace and dependency scanning | First improve the existing catalog: versions, permissions, provenance and scan results. | Verify a real package/registry and reproducible scanning tool; installation remains admin-authorized. Community marketplace comes after trust/signing and rollback design. |
| PERF-01 | Caching and edge execution | Identify one measured repeated request and evaluate a bounded, tenant-scoped response cache. | Define invalidation, TTL, isolation and sensitive-data exclusions; measure correctness and cost before enabling. Response caching is not model-weight caching. Verify which work is already handled by Workers. |
| SEC-01 | Per-skill roles and audit integrity | Define a small permissions matrix and test it at the server/tool execution boundary. | Test admin, ordinary user and revoked access; never rely solely on UI visibility. Add input/output hashes only after the AUD-01 privacy design. |
| INT-01 | Microsoft Graph, Google Workspace and connector builder | Choose one provider and one read-only use case before designing a visual connector editor. | Confirm API support and least-privilege OAuth scopes; secure credentials, consent, pagination, rate limits and revocation. Endpoint validation must prevent internal-network access. |
| OFF-01 | Offline Docker and cloud synchronization | First verify model licensing, hardware and which functions can run offline; design a local pilot. | Container runtime must exist and be authorized. Define encryption, tenant isolation, sync conflicts and recovery before unattended sync. Do not silently replace the Windows gateway. |
| HELP-01 | Tutorials and contextual help | Add a short workspace onboarding flow and answers grounded in versioned project documentation. | Dismissible and keyboard accessible; show unsupported features honestly; redact secrets and avoid inventing commands or plugin IDs. |
| REP-01 | KPI dashboards and report export | Define actual sources for job counts, timings and costs, then create a read-only dashboard pilot. | Display missing measurements as unknown, not zero; enforce user/tenant access. PDF/Excel export follows data validation; scheduled email requires a confirmed recipient, schedule and authorization. |

### Definition of done for every pilot

1. Verify existing code, provider/tool capability and data ownership.
2. Specify one user-visible outcome and failure/permission behavior.
3. Implement the smallest slice with automated tests and bounded inputs.
4. Validate the relevant UI or runtime; distinguish fixtures from live evidence.
5. Document limitations and rollback before an approved rollout.
6. Mark completed only after the relevant execution/deployment is confirmed.

Voice/video processing, paid AI calls, OAuth integrations, marketplace installs,
Docker launches, unattended schedules and production deployments are not
triggered by this roadmap.
