# User and admin workspace UI

## What changed

- A quieter, legible workspace with system light/dark theme, reduced-motion
  support, visible keyboard focus and large touch targets.
- Full-height chat with a pinned composer, input auto-sizing, a latest-message
  button, and reading position preserved when the reader scrolls up.
- A mobile navigation drawer with inert closed contents, Escape/shade dismissal
  and keyboard focus containment.
- Existing dashboard, memory, projects, settings and Studio retained.
  Studio file and version panels remain available on mobile.
- Admin-only Developer navigation and a read-only diagnostics workspace.
  Unauthenticated controls remain disabled; ordinary users cannot open the
  Developer view through the client router.
- Separate Admin WRITE memory form and an entry to existing admin Settings.
  The status badge describes monitoring only, not a global denial of writes.

## Server authorization and evidence

`GET /api/assistant/developer` requires the existing server `requireAdmin`
check. Hiding the menu is not the security boundary. The endpoint has no POST
operation and does not change PC access, secrets, model configuration, jobs
or deployments.

It returns server version and check time, readiness/schema checks, binding
presence, a bounded PC status report, at most 20 recent job summaries and 15
event names/timestamps. It does not return API-key values, raw event details,
PC payloads or receipts. PC probing has a four-second timeout; individual
failures produce explicit partial data without suppressing other sections.

Configured bindings are not successful inference or external integration
tests. A PC connection report is not proof that a PC action completed.
Missing heartbeat information remains missing. Failed refreshes clear old
snapshots instead of retaining a misleading healthy status.

The server monitor endpoint remains readable during emergency stop but cannot
resume work. The bootstrap availability change was initially blocked by the
automated reviewer, then retried only after fresh explicit user approval.
The authenticated read-only `/api/assistant/status` bootstrap now reports
emergency-stop state. Admin startup can open Developer without first trying
blocked sessions/history requests. Jobs, memory writes and plugin changes
remain blocked and are covered by runtime tests.
Auto-refresh is opt-in, every 30 seconds, only in the visible Developer view.
Opening the page does not run paid inference or create background jobs.

## Admin WRITE scope

`POST /api/assistant/developer/memory` independently requires server-verified
admin access, origin validation, strict bounded JSON and rate limiting.
Creation preserves an existing key unless `replace_existing` is explicitly
true. The write uses user provenance and a batched audit event with a
persisted receipt ID, key and actor, not the private memory text.
Only a confirmed server response displays successful storage; network errors
say storage is unconfirmed and never automatically repeat the POST.

Emergency stop continues to block this route, ordinary memory writes, plugin
changes and job creation. Runtime tests check these restrictions. The UI
disables WRITE controls while monitoring is unavailable or stopped.

Direct editing of Trinity source files on the Windows PC is not implemented
or claimed working by this change. The user's project-root preference was
saved privately, not hardcoded into public assets or repository source.
The previously blocked PC-schema/evidence repair still needs fresh explicit
approval; there is no alternate PC execution route in this UI change.

## Verified developer help

Prompts/style live in `src/engine.js`, `src/identity.js` and `src/cognition.js`.
Models and existing catalogue modules are managed through Settings.
Invented `system_prompts`, `pc_bridge_config.json`, `pc_restart`,
`trinity-plugin-file-watcher`, `trinity-plugin-onedrive-sync`,
`trinity-local:4b` or audit-receipt paths must not be treated as implemented
capabilities merely because a generated answer mentions them.

OneDrive sync, scheduled PC automation, Office macros, fine-tuning and new
connectors are separate proposed work. This UI change does not install them
or retry the previously blocked PC-schema/evidence repair.

## Validation and rollout

Tests cover metadata-only diagnostics, failed sections, malformed heartbeat
fields, timeout, anonymous rejection, non-admin rejection and continued
monitoring during emergency stop without permitting work.

Browser previews use isolated fixture responses, not production data.
Desktop and 390px mobile previews cover chat, dashboards, Developer
populated/empty/error states, settings, Studio, projects, navigation, dialogs,
login and dark mode. These are UI checks, not a live integration test.

Application deployment and resolution of the existing PR merge conflict
remain separate from source implementation and isolated testing.
Emergency-state UI preview responses are fixtures; runtime tests separately
check the protected server and continued write blocking.