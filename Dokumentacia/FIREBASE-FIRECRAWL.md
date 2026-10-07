# Firebase + Firecrawl integration
Target Firebase project: morfeus-ac7ed (user-selected new project). The existing Firebase hosting project remains unchanged.

New Trinity entry delegates existing and knowledge routes. Owner/admin-only integration routes:
- GET /api/integrations/status reports configuration presence, never claims live connectivity.
- POST /api/integrations/firecrawl/scrape with {"url":"https://firebase.google.com/docs/"} imports bounded markdown into Knowledge Worker and existing assistant memory.
- POST /api/integrations/firebase/publish with {} writes the current service/version/status/timestamp to Firestore trinity_status/current. No conversation contents, user identifiers or credentials are exported.

Deploy Knowledge Worker and Integrations-Worker first; then in Trinity use wrangler.integrations.jsonc. Ordinary default deployment still uses the original configuration; it would omit integration routes. This release adds files only, per the user's constraint.

Required setup:
1. Enable Firestore (default database) in morfeus-ac7ed if not already enabled.
2. Create/use a service account for this project with only the necessary Firestore permissions. Store its JSON using "npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON (from Integrations-Worker)". Do not commit it or paste it in chat.
3. Store the Firecrawl key using "npx wrangler secret put FIRECRAWL_API_KEY (from Integrations-Worker)".
4. Run "npm ci", "node --test tests/integration-providers.test.mjs", then "npx wrangler deploy --config wrangler.integrations.jsonc --dry-run".
5. With Cloudflare authentication available, deploy using "npx wrangler deploy --config wrangler.integrations.jsonc".
6. As an authenticated owner/admin, invoke both POST endpoints and check their receipts. Firebase publication failure does not report success.

Firecrawl currently allows only the three documentation origins listed in Integrations-Worker/wrangler.jsonc. One page per invocation; no automatic crawl or schedule. Calls consume Firecrawl credits. Rate limit is 5 integration requests/minute per caller; no daily credit cap yet. External HTTP responses and source text are bounded; credentials never appear in URLs. The API key is sent only to api.firecrawl.dev. Provider content remains untrusted reference material and is visible through existing shared project memory.

Firebase OAuth uses a signed service-account assertion, obtains a temporary Google token per publication, and targets only the configured project document. Firestore rules/IAM are not changed by this code. User-facing Firebase subscriptions and live task synchronization are not part of this first bridge.

Validation status: JavaScript syntax inspected, but the local execution environment is currently unresponsive, so build and provider tests have NOT been run. A dedicated GitHub PR check is supplied. No deployment or live provider call is claimed; credentials and database readiness remain to be verified.
\nWorker roles: Trinity authenticates and orchestrates; Integrations-Worker owns external provider credentials and calls; Knowledge-Worker stores and retrieves sourced documents; Capacity-Worker tracks caller-reported work budgets (still standalone); PC-Bridge-Worker tracks PC connectivity. No Worker claims a live connection or role execution until deployed and checked. Integrations-Worker exposes RPC only and serves no public HTTP API.\nBuild Integrations-Worker with npm install then npm run build; configure its secrets there, deploy it, and only then deploy the Trinity integration entry.\n