# Trinity

Use Slovak when communicating with the owner. The canonical branch is `main`.
The current Worker source is `Trinity/`; historical copies and prototypes are not deployment targets.

- Production: Worker `trinity`, domain `https://auru.space`.
- Development: Worker `trinity-development`, domain `https://auru.dev`.
- Development has its own D1, KV, R2, Durable Objects and Workflow. Never substitute production resources to make a development check pass.
- Start with the `trinity_status` MCP tool and inspect the real source and deployment version before editing.
- Prefer the connected `trinity` MCP server for remote status, tasks and bounded project actions. A queued task is not a completed action; poll `get_task` and check its receipt.
- Read existing changes before editing. Preserve dirty worktrees, local backups and stashes. Do not merge old prototypes wholesale into the product.
- Keep authentication, approvals, origin checks and secret protection enabled. Never print or commit credentials or `.credentials`, `.env`, `.dev.vars`, or local configuration containing tokens.
- Run `npm test` in `Trinity/`. Build development with `npm run build:development`. Deploy the development environment first and verify it before production.
- Tag deployments with the exact Git commit using Wrangler `--tag`. `/health` reports that tag and the Cloudflare version ID.
- Browser availability, readiness, external provider inference, and PC connectivity are separate claims and need separate evidence.

For a personal Google AI Pro subscription use the official Antigravity CLI (`agy`) with Google account sign-in. Google ended personal-account access through the older Gemini CLI on 18 June 2026. This subscription is separate from the Gemini API credential used by the deployed Worker. The same scoped Trinity MCP bridge is configured in the supported client.
[](https://)