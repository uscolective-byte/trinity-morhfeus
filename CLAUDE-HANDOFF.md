# Trinity / Morhfeus Handoff

Use this file as the current project brief when continuing work with another AI. Treat repository code and current Cloudflare state as authoritative; this document is a snapshot and may become stale.

## Product

Trinity is one Slovak/English AI assistant running as a Cloudflare Worker, backed by D1, R2, KV, Workflows, Workers AI, and an optional Ollama provider. The 40 specialist agents are internal roles, not separate identities. Local Gateway and PC Bridge provide narrowly allowlisted, approval-gated local actions. Firebase Hosting serves a small public status bridge.

## Repositories And Live Services

- GitHub repository: `uscolective-byte/trinity-morhfeus` (Private).
- Git default branch: `master`.
- Main Worker: `trinity`, normally reached through `https://auru.dev` and `https://trinity.saboivan2008.workers.dev`.
- Local Gateway: `127.0.0.1:8791`; it has previously verified `cloud: connected` and `pc_bridge: connected` using a DPAPI-protected local credential.
- PC Bridge Worker: `trinity-pc-bridge`.
- Firebase status bridge: `https://trinity-morhfeus-20261001.web.app`.
- Production Trinity version: `6.7.0`; last verified deployed version ID before pending Google-auth changes: `ae914af9-f156-4b6b-b9e9-7b297dd45a27`.

## Main Components

- `Trinity/src/index.js`: Worker routing, authentication gates, jobs, Studio, system actions, MCP and admin API.
- `Trinity/src/engine.js`, `registry.js`, `tools.js`: one-identity agent orchestration, the 40-agent registry, skill prompts, tools and trusted plugin install.
- `Trinity/src/studio.js`: prompt-to-HTML AI Studio with sandboxed preview, version history and export. It is not yet a full IDE or deployment integration hub.
- `Trinity/migrations/`: D1 schema changes. Apply pending migrations before deploying code that relies on them.
- `Local-Gateway/`: Windows DPAPI-backed local service, approval-based workspace actions and private cloud link.
- `PC-Bridge-Worker/`: authenticated heartbeat/action bridge.
- `Firebase/`: public status page only.

## Authentication Work In Progress

Google OAuth support is implemented in local changes but has **not been deployed or enabled**. It uses OAuth state, nonce, PKCE, Google JWKS signature verification, issuer/audience/expiry checks, and requires `email_verified=true`.

`TRINITY_ADMIN_EMAILS` is configured for:
- `saboivan2008@gmail.com`
- `usc31@auru.space`
- `uscolective@gmail.com`
- `delirium.trade12@gmail.com`

Those addresses receive `admin` only after logging in through Google with the matching verified address. Other verified Google profiles are created as `pending`; only an active admin can approve or reject them. User status and role are checked from D1 on each session-authenticated request. No GitHub, Cloudflare, Firebase, or other provider accounts are linked by this login feature.

D1 migration `0013_google_auth.sql` adds session email, user roles/status, and short-lived OAuth state storage. It still needs to be applied to production before deployment.

Google OAuth is intentionally dormant until configured. Cloudflare currently has no `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET`; do **not** set `TRINITY_AUTH_MODE=google` until the OAuth client is tested, otherwise existing login methods will be rejected. The redirect URI is `https://auru.dev/api/auth/google/callback`.

Required activation sequence:
1. Create a Google OAuth Web application and register the redirect URI above.
2. Set `GOOGLE_CLIENT_ID` as a Worker variable and store `GOOGLE_CLIENT_SECRET` with `npx wrangler secret put GOOGLE_CLIENT_SECRET` from `Trinity/`.
3. Verify callback, admin sign-in, pending signup, approval and logout on staging.
4. Only then set `TRINITY_AUTH_MODE=google` and deploy to production.

`Trinity/.dev.vars.example` is a blank local template. Real credentials belong in ignored `.dev.vars` for local tests or Wrangler Secrets in production; never commit credentials.

## Security And Autonomy

- Trinity has bounded operational autonomy: it can plan and take safe, reversible actions within the user's task.
- Source writes, deployment, external actions and other high-impact changes require separate authenticated approval and a gateway receipt.
- Truth policy requires evidence before claiming an action completed.
- Arbitrary third-party plugin code is not downloaded/executed. Plugin installs are restricted to the trusted built-in catalog.
- No self-destruction or emergency STOP feature is present; it was removed at the owner's request.
- Do not implement unconditional obedience or disable safety, approval, authentication, audit, or truth checks.

## Tests And Build

Recent full Trinity run: build passed; 45/45 tests passed, including Google ID-token signature/claims and Google-only session role checks. Gateway: 8/8; PC Bridge: 2/2.

Run component commands from their own directories:

```powershell
Push-Location Trinity; npm run build; npm test; Pop-Location
Push-Location Local-Gateway; npm test; Pop-Location
Push-Location PC-Bridge-Worker; npm run build; npm test; Pop-Location
```

The root `package.json` has build/sync/deploy orchestration but no `test` script. Root build runs its own module tests and also runs Git fetch/pull; inspect `git status` first and do not use it on a dirty tree.

## Remaining Product Work

- Apply and deploy the pending Google-auth migration/code after staging verification; do not switch to Google-only mode without real Google credentials.
- Confirm the GitHub repository visibility remains Private and add collaborators by exact GitHub usernames. Email addresses alone are not safe identifiers for repository permissions.
- Trinity AI Studio currently builds sandboxed/versioned HTML. GitHub editing, Cloudflare/Firebase publishing, integrations and the API key sales/billing gateway are not implemented. Build these as separate scoped features; never expose upstream provider secrets to customers.
- The project-status JSON may contain local user edits; inspect before changing or staging it.
