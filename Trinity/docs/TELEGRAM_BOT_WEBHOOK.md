# Trinity Telegram Bot — incoming webhook

## Endpoint (not live until merged and deployed)

- Production: `POST https://auru.space/api/integrations/telegram/webhook`
- Development: `POST https://auru.dev/api/integrations/telegram/webhook` (use a **separate development bot**, as a Telegram bot supports only one active webhook).
- Headers: `Content-Type: application/json` and `X-Telegram-Bot-Api-Secret-Token`.
- Only messages in private chats whose numeric chat IDs are allowlisted are accepted.
- `/start`, `/help`, `/ping`, `/status`, `/ask <question>` and plain questions are supported.
- Inbound chat can ask the chat model but cannot call tools, run system commands, modify code, deploy, or read secrets.

## Security prerequisites

A previous Bot Token appeared in committed source code. **Revoke it in BotFather first**, including when a code hotfix has already removed the plaintext token; old Git history still retains it. Do not send a replacement token in chats, issues, source files, CI logs or PR comments.

Environment-specific Cloudflare Worker secrets:

| Name | Meaning |
|---|---|
| `TELEGRAM_BOT_TOKEN` | New BotFather token. Required. |
| `TELEGRAM_WEBHOOK_SECRET` | Separate randomly generated 24-256 character `[A-Za-z0-9_-]` secret used in Telegram webhook header. Required. |
| `TELEGRAM_CHAT_ID` | Numeric private chat ID of the operator. Required unless the allowed-list alternative is set. |
| `TELEGRAM_ALLOWED_CHAT_IDS` | Optional comma-separated numeric chat IDs. When present, overrides `TELEGRAM_CHAT_ID`. |

This handler fails closed until all credentials, header verification and a numeric chat allowlist are present. Never use the Telegram Bot Token as the webhook secret.

## Configure production (PowerShell 7)

Run from the repository's `Trinity/` directory **after** BotFather has issued a replacement token. Send `/start` to the bot on Telegram. If no webhook has been configured yet, you can find the numeric chat ID by calling Telegram `getUpdates`.

```powershell
$botToken = Read-Host -MaskInput "NEW Telegram bot token"
$chatId = Read-Host -MaskInput "Your numeric Telegram private chat ID"
$webhookSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

$botToken | npx.cmd wrangler secret put TELEGRAM_BOT_TOKEN --env=""
$chatId | npx.cmd wrangler secret put TELEGRAM_CHAT_ID --env=""
$webhookSecret | npx.cmd wrangler secret put TELEGRAM_WEBHOOK_SECRET --env=""
```

The final three commands configure Cloudflare bindings; they do not deploy code or register Telegram's webhook. Keep PowerShell variables only within this setup session; clear them when finished. Ensure Wrangler is logged into the **correct Cloudflare account** before setting secrets.

Deploy only after the PR is tested and merged. Verify the deployed source commit and ensure the three bindings appear as configured (without exposing values). Then register the webhook:

```powershell
$payload = @{
    url = 'https://auru.space/api/integrations/telegram/webhook'
    secret_token = $webhookSecret
    allowed_updates = @('message')
    drop_pending_updates = $true
} | ConvertTo-Json
Invoke-RestMethod -Uri ("https://api.telegram.org/bot{0}/setWebhook" -f $botToken) -Method Post -ContentType 'application/json' -Body $payload
Invoke-RestMethod -Uri ("https://api.telegram.org/bot{0}/getWebhookInfo" -f $botToken)
Remove-Variable botToken, chatId, webhookSecret, payload
```

To obtain chat ID before webhook activation, run `Invoke-RestMethod -Uri ("https://api.telegram.org/bot{0}/getUpdates" -f $botToken)` after messaging the bot, and read `result[].message.chat.id`. `getUpdates` cannot be used while a webhook is active. Avoid printing bot tokens or entire provider response bodies to shared logs.

## Verification

1. Send `/ping` from the allowlisted private Telegram account. The bot should reply. This proves the webhook-to-Telegram roundtrip but **not** the AI integration.
2. Send `/ask Ahoj`. Confirm that an actual AI response was received, and that model/provider status is correct.
3. Verify wrong webhook-secret headers are rejected (403), unknown chats are ignored, and missing configuration fails closed (503).
4. Use Telegram `getWebhookInfo` to inspect delivery status and pending updates. Do not claim live functionality without these checks.

**Note:** This initial integration is text-only. It does not grant the Telegram account administrative privileges or access to tools, GitHub, Cloudflare deployments, payments or the local PC. Those actions require a separate authorization design.
