# Trinity ↔ Microsoft Copilot Studio

**State: implementation proposal only.** This repository change does not connect a Microsoft tenant, set any secret, deploy a Cloudflare Worker or verify a live Copilot conversation.

## Architecture

Copilot Studio custom connector → Microsoft Entra ID delegated OAuth 2.0 → **trinity-copilot-bridge** Worker → private Cloudflare service binding **TRINITY** → scoped Trinity API → existing **trinity** Worker.

The Worker verifies Microsoft v2.0 RS256 access-token signatures, issuer, tenant, token audience, client application (`azp`), user object ID (`oid`), expiry, and delegated `scp`. Tokens do not grant owner/admin privilege merely because a chat message claims it.

The following read operations require **Trinity.Read** delegated scope:

- `GET /v1/trinity/status` — minimal service status
- `GET /v1/trinity/readiness` — boolean readiness, no internal binding inventory
- `GET /v1/trinity/agents` — names and roles only

Optional commands require **Trinity.Execute** and a *separate* secret key. There is **no second text command SCHVÁĽ** for permitted non-admin tasks:

- `POST /v1/trinity/tasks` with JSON `{"message":"..." }` — queue one safe task
- `GET /v1/trinity/tasks/{id}` — poll status

A 202 response means *queued, not completed*. Remote tasks are run with `owner_mode:false`. High-risk requests are blocked by Trinity and **cannot issue arbitrary PC shell commands or deploys**. Only one allowlisted Entra user can activate task operations in this pilot.

## 1. Register Microsoft Entra apps

Use **Microsoft Entra admin center → App registrations**.

1. Create a *single-tenant* API registration, e.g. `Trinity Copilot API`. Under **Expose an API**, expose delegated scopes `Trinity.Read` and optionally `Trinity.Execute`. Record the API application ID, Application ID URI, tenant ID, and the trusted user's object ID.
2. Register a separate Copilot Studio / custom-connector client app. Grant delegated permissions to the custom API, get administrator consent when required, and use the Microsoft **on-behalf-of (OBO)** connector procedure.
3. Entra ID **client secrets** are configured only in Power Platform security settings or a secure vault; do not paste them into Trinity chat or commit them to GitHub.
4. The Worker expects a **v2.0 access token**, not an ID token. Set `ENTRA_AUDIENCE` to the exact access token `aud`. The `ENTRA_ALLOWED_CLIENT_IDS` must match the actual `azp` claim of approved client apps.

Microsoft: https://learn.microsoft.com/en-us/microsoft-copilot-studio/advanced-custom-connector-on-behalf-of

## 2. Create restricted Trinity API keys

In Trinity's authenticated admin interface create *two revocable keys*:

- One with only `mcp:read` → Worker secret **COPILOT_TRINITY_READ_KEY**.
- One with only `mcp:write` → Worker secret **COPILOT_TRINITY_TASK_KEY**, only if tasks are enabled.

These are server-to-server secrets and must **never** be placed in the public OpenAPI definition or in Copilot Studio.

The main Trinity Worker adds isolated `/api/integrations/copilot/agents`, `/api/integrations/copilot/tasks`, `/api/integrations/copilot/tasks/{id}` routes. All routes validate scoped API keys server-side and enforce rate limits for submissions/polling.

## 3. Configure Cloudflare separately from production Trinity

### Development pilot (start here)

Use `wrangler.staging.jsonc` for the first deployment. It names a separate `trinity-copilot-bridge-development` Worker, binds only `trinity-development` and sets `ENTRA_ENABLE_TASKS=false`. The default config below still targets production; do not use it for this pilot.

```sh
node --test tests/*.test.mjs
npx wrangler@4.149.0 deploy --config wrangler.staging.jsonc --dry-run --outdir dist-staging
```

Before actual deployment, verify that `trinity-development` exists and includes the scoped Copilot routes from this PR. Configure the real tenant, audience, user and client IDs and the read-only key on this separate Worker using secure platform configuration. No task key is required for this read-only pilot. Do not treat a successful build or configured binding as a verified Entra connection. Deploy only this staging configuration after authentication and review; import only the three read operations into the initial Copilot Studio tool.

The provided `wrangler.jsonc` binds `TRINITY` to service `trinity` and does **not** add any custom production route. In Worker Variables and Secrets set:

| Name | Role |
| --- | --- |
| ENTRA_TENANT_ID | Tenant GUID |
| ENTRA_AUDIENCE | Token `aud` — often `api://<API_APP_ID>` |
| ENTRA_ALLOWED_USER_OIDS | One trusted user object ID for commands |
| ENTRA_ALLOWED_CLIENT_IDS | Approved connector app ID(s) in `azp` |
| COPILOT_TRINITY_READ_KEY | Protected Worker secret |
| COPILOT_TRINITY_TASK_KEY | Optional protected Worker secret |
| ENTRA_ENABLE_TASKS | Set `true` only after approval and integration tests |

If required configuration is missing, the bridge fails closed. Do not add real credentials to `wrangler.jsonc`. Confirm the account's workers.dev host and service-binding permissions before deployment.

Local validation with Node 22+:

```sh
cd Copilot-Bridge-Worker
node --test tests/*.test.mjs
npx wrangler@4.149.0 deploy --dry-run --outdir dist
```

## 4. Configure Copilot Studio

1. Take `openapi.swagger.json` and replace `REPLACE_WITH_DEPLOYED_CLOUDFLARE_WORKER_HOST` with the actual deployed worker's hostname, **without** `https://`.
2. In Power Platform **Custom connectors**, import this Swagger 2.0 definition. Under **Security**, configure OAuth 2.0 with Microsoft Entra ID, single tenant, the connector client application, its securely held secret, your API Application ID URI, and delegated scopes. Add the connector-generated redirect URI to the Entra client app.
3. Add the custom connector to your Copilot Studio agent as a tool. Start with the read operations. Enable task operations only after identity and end-to-end tests succeed.
4. Verify read requests and a non-sensitive task (`queued → completed`) through the polling operation. Do not treat 200/202 alone as evidence of a completed action.
5. Publishing the Copilot agent and granting it access in Microsoft 365 are separate administrator actions.

Microsoft docs:
- https://learn.microsoft.com/en-us/connectors/custom-connectors
- https://learn.microsoft.com/en-us/connectors/custom-connectors/azure-active-directory-authentication

## Approval UX policy

Authenticated Trinity owners should not be asked to send a second `SCHVÁĽ` command for already authorized work. For actions needing independent risk review, respond with the exact action status and ID; the admin reviews them via an authenticated interface. Do not bypass Microsoft OAuth consent, allow model messages to declare admin identity, or auto-execute critical operations merely because a user dislikes approval dialogs.

## Known blockers

- The Copilot Bridge is **not deployed** and no Entra OAuth handshake has been verified.
- GitHub Actions are failing before runners allocate; unit tests/builds have **not** been confirmed passing.
- The `main` branch has no enforced required checks. Keep this integration in a **draft PR** until a security review, test evidence and staging verification are complete.
