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