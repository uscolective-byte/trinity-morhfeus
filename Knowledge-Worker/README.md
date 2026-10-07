# Trinity Knowledge — additive extension

Prepared and tested locally; not deployed. No existing tracked source files were changed.

The private Worker stores up to 64 text documents (100000 UTF-8 bytes each) in SQLite Durable Object storage. It retains the latest version, SHA256, provenance and import time. Retrieval ranks keyword matches over 1800-character passages and returns at most five passages. This is keyword retrieval, not semantic/vector search. Source contents are untrusted reference material, never instructions or verified facts.

The catalog allows only Cloudflare Workers, Workflows and Agents official documentation. Refresh rejects redirects, non-text formats and responses larger than 256000 bytes, with a 15-second fetch timeout. Some pages may exceed these limits and will fail explicitly. Internet refresh is on demand; there is no scheduled crawling. Owner imports do not fetch URLs.

## Connection to existing Trinity

`Trinity/services/knowledge-entry.js` delegates existing routes and exports to the original entry. New owner/admin endpoints:

- `GET /api/knowledge/catalog`
- `GET /api/knowledge/search?q=...`
- `POST /api/knowledge/import` with `{ "source_id":"project", "title":"Project notes", "text":"..." }`
- `POST /api/knowledge/refresh` with `{ "source_id":"cloudflare-workers" }`

Existing authentication, origin checking and request limits apply. Mutations respect the owner's emergency stop. Imports synchronize a provenance-labelled excerpt (first 8500 characters) into `ops_memory`. Existing chat recall can find it when the memory plugin is enabled. Full documents remain searchable in the Knowledge API. No automatic full-document retrieval or new UI has been added. Core memory is currently shared among authorized users: import only project material suitable for that audience. A successful Knowledge write with failed D1 sync returns an error; retrying the same import repairs the sync.

Use the additive `Trinity/wrangler.knowledge.jsonc` to deploy; the original configuration remains unchanged. Capacity-Worker is still independent and is not connected by this extension. This release does not claim to meter AI costs or make the local PC reachable.

## Validation and deployment

From repository root on Windows, after Cloudflare login, run `powershell -ExecutionPolicy Bypass -File .\DEPLOY-KNOWLEDGE.ps1`. It installs locked dependencies, checks the original Trinity, tests the new Worker and integration, then deploys Knowledge, applies only the new profile migration, and deploys Trinity with its original name/routes/resources plus the Knowledge binding. Existing production database must already have migrations through 0022. Review the account/resource IDs for your installation before running. This is a production deployment, not a preview.

Rollback entry: in Trinity run `npx wrangler deploy --config wrangler.jsonc`; new stored reference records and the profile remain in D1. No production rollback has been tested.
