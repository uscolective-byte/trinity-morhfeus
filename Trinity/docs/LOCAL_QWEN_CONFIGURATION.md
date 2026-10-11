# Local Qwen configuration

## Confirmed code defect

The NextGen Windows bridge previously completed `read / local-inference` with the
literal text `[lokálny model nie je nakonfigurovaný]` and `model: none`.
This is a placeholder response, not evidence that Ollama is missing or misconfigured.
The separate `Local-Gateway` implementation already has a real local inference path.

The patch replaces only that NextGen branch with real Ollama inference:

- model `qwen3:4b-instruct`;
- fixed loopback endpoint `http://127.0.0.1:11434/api/chat`;
- 6 CPU threads, 4096-token context, at most 600 output tokens;
- 30-minute keep-alive;
- 75-second timeout, below the cloud action's 90-second claim lease;
- no arbitrary endpoint, cloud fallback, shell action or API key;
- successful receipt only for a completed, nonempty reply from the configured model;
- unavailable server, missing model, timeout and invalid replies fail the action.

## Windows setup

Run `scripts/configure-local-qwen.ps1 -SourceCommit <full reviewed commit SHA>`.
Use `-BridgeRoot` only when the actual installed NextGen bridge is in another folder.

The script:

1. Checks the existing bridge, launcher and configuration file without reading
   `.env` or credential contents.
2. Refuses unexpected source changes, a modified helper, linked paths or a different
   running NextGen bridge.
3. Starts an already-installed Ollama on loopback if necessary; downloads only the
   requested model if missing (approximately 2.5 GB).
4. Performs a real, short local inference test before patching the bridge.
5. Downloads the helper from an immutable commit and verifies its SHA-256.
6. Changes one exact placeholder line, preserving the remaining local source and
   original UTF-8 BOM/newlines. Saves an original-code backup under
   `%LOCALAPPDATA%\Trinity\CodeBackups`, outside the repository.
7. Restarts only the exact target NextGen bridge, never all Node processes.

It does not rotate credentials, overwrite `.env`, change Cloudflare secrets, deploy
a Worker, configure a tunnel, install an autostart service or grant new permissions.
If Ollama is not installed, use the official Windows installer and rerun setup.

## Verification and boundaries

`OLLAMA_TEST_OK` proves a real local model reply. `BRIDGE_START_REQUESTED` only
reports that the launcher was run; it does not prove cloud authorization.
Test the next chat with the local engine and inspect its model/workflow receipt.
Do not send keys or `.env` contents into chat.

The production UI, local Wrangler UI and PC service are separate runtimes.
Wrangler local D1 does not automatically share the production action queue or
production secrets. A local model may work while a particular cloud gateway's
authentication still fails. Do not rotate a shared gateway secret merely to hide
this placeholder error.

The helper and mock-based tests can be verified outside Windows. The setup script,
actual PC model and end-to-end cloud chat still require verification on the owner PC.