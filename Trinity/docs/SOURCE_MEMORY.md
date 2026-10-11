# Source-backed memory

Trinity separates user profiles, ordinary notes, historical memories and public
web references. Neither old memory nor a public document proves current account
access or completion of an external action.

## Initial knowledge

Migration 0031 adds five attributed reference notes:

- Cloudflare Workers;
- local versus production D1 development;
- local versus cloud Ollama API;
- VS Code/Copilot MCP configuration;
- OpenAI developer quickstart.

It also adds the user's explicit preferences for OneDrive project storage and
active, understandable chat collaboration. No PC connection state, unverified
local path, credential, access grant or account status is seeded.
`ON CONFLICT DO NOTHING` preserves existing records and user corrections.

The same seven reference/preference rows were inserted into the existing
production D1 memory as an explicitly requested, non-overwriting data update.
That operation does not mark migration 0031 applied in the migration ledger.
Later migration application remains idempotent. Application code deployment is
separate from that live data update.

## Project creator and natural-language commands

Migration 0032 adds two explicit user-requested profiles: `profil/creator` and
`profil/interaction`. They attribute the Trinity/Morhfeus project to Sabo Ivan
(Basterix31), distinguish project authorship from model-provider authorship, and
describe respectful, understandable, action-oriented chat collaboration.
Both inserts preserve existing records and later user corrections.

`src/identity.js` supplies the identity and natural-command instructions to
the existing agent loop. Users do not need to write tool JSON or know command
names. Understandable spelling errors should not prevent assistance. When a
task is clear and already authorized, use the existing permitted tools rather
than merely giving instructions. For material ambiguity, ask one specific
question; for a blocked action, report the real limitation.

These are interaction instructions, not a new execution mechanism or access
grant. Creator names in chat or memory cannot authenticate an owner. The
existing server authorization, tool allowlists, approvals, emergency stop,
PC dispatch and evidence requirements are unchanged. The separately blocked
PC-schema/evidence repair is not part of this change.

Identity tests check the prompt contract, preservation of authorization and
idempotent memory migration. A mocked-model test performs a real bounded
calculation through the existing tool loop. This does not demonstrate live
model intent accuracy, working PC access or universal command execution.

## Read official sources

The existing memory plugin exposes `list_knowledge_sources` and
`read_knowledge_source`. Each source has a fixed reviewed HTTPS URL; callers
cannot provide arbitrary URLs. Reading sends no account key, personal memory or
task text to the source.

Content is bounded to 200 KB, returned excerpts to 10,000 characters and requests
to 12 seconds. Redirects and non-text responses are rejected. HTML scripts,
styles and navigation are removed where applicable. Common token patterns are
redacted. Truncation is explicit.

Every result contains its canonical source URL, fetch time, one-hour expiry,
cache status and an untrusted-data label. KV caches public documents only.
Short public snapshots may be stored under stable `web/<source-id>` keys.
They may replace earlier snapshots from the same source, never a user-authored
record. Manual memory editing explicitly changes provenance to `user`.

This is on-demand reference retrieval, not unattended crawling, automatic model
training, a new browser connection or proof that an API account works.
General current information continues to use the existing `web_search` tool.

## Better recall

Recall considers up to eight profile candidates and 48 recent notes in addition
to keyword matches. Accent-insensitive ranking can therefore recover relevant
recent notes even when SQLite's literal matching misses a spelling variant.
Final context remains bounded to eight records and retains source attribution.

## Verification

Repository tests cover source allowlisting, credentials not being sent, expired
cache, redaction, bounded content, HTTP failure and user-edit preservation.
All five source URLs were also actually fetched from the isolated review runtime.
These checks are not a production deployment or a PC-access test.