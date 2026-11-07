# Root workspace dependency baseline

The root manifest is a tooling workspace. Worker, Local-Gateway and bridge
services retain their own manifests and lockfiles.

Removed four unused root dependencies: the historical `codex` static-site
generator (not the OpenAI Codex application), the experimental `node` npm
binary, standalone `npx` (npm already supplies it), and the unused `tunel`
IPC package. Repository source and scripts did not import these packages.
Node.js 24 or later is now declared as the root tooling requirement.

The MCP SDK, ethers, Hono and Zod remain. No provider credentials, model
configuration, installed system Node executable or service manifests changed.

Verification on 2026-11-03:

- Fresh root `npm ci --ignore-scripts` succeeded.
- Root registry audit decreased from 70 findings (11 critical, 36 high,
  20 moderate, 3 low) to zero findings.
- Root regression suites passed 22/22 tests: 18 Access diagnostic tests and
  four Wrangler entrypoint/configuration tests.

This audit result applies only to the root lockfile at verification time.
It does not establish the absence of vulnerabilities in service dependencies
or substitute for hosted CI and staging release verification.
