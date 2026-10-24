# Gemini / Antigravity + Telegram tools

## Gemini and Antigravity

The existing Trinity MCP endpoint is `https://auru.space/mcp`. It exposes status, agent listing, job dispatch/status, memory search, service checks, and bounded project action proposals.

Workspace configuration added in this branch:
- `.agents/mcp_config.json` for Antigravity CLI/IDE.
- `.gemini/settings.json` for Gemini CLI.

Both start the repository's existing local stdio-to-MCP bridge from Windows. The bridge expects an already provisioned user-encrypted Gemini MCP credential managed by `Trinity/scripts/start-trinity-codex-mcp.ps1`. Credentials do not belong in project settings files.

Open the repository root in the relevant MCP-aware client, view its MCP server status, and verify by invoking `trinity_status`. Then invoke `list_agents`, optionally `dispatch_task`, and poll `get_task` for actual completion. Tool discovery or a queued job is not proof of execution.

Plain consumer Gemini web chat does not automatically load workspace MCP configurations. Use a compatible client such as Antigravity, or an independently authorized Gemini application that implements tool calling.

Write, deploy and PC operations must follow the existing action proposal and approval flow. Keep interactive MCP tool confirmation active.

## Telegram

After deployment, the endpoint is `POST https://auru.space/api/integrations/telegram/webhook`.

Allowed private Telegram accounts can use `/tools`, `/health`, `/agents`, `/services`, `/capabilities`, `/tasks`, `/ping`, and `/ask`. The first six are read-only operations. Several explicit Slovak status phrases map to them. General chat has no automatic privilege to execute tools or administrative actions.

The required production binding names are `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `TELEGRAM_CHAT_ID` (or `TELEGRAM_ALLOWED_CHAT_IDS`). Never place credential values in source, public issues or chat. Revoke the previously exposed bot token before activating the integration.

Detailed Telegram configuration: [Telegram webhook setup](TELEGRAM_BOT_WEBHOOK.md).

## Verification checklist

- Complete test suite and development build.
- Verify the real Antigravity MCP tool call and resulting Trinity response.
- Verify the deployed webhook URL with Telegram `/ping`, `/health`, then an AI-backed `/ask`.
- Report actual runtime errors instead of describing an unverified connection as live.
