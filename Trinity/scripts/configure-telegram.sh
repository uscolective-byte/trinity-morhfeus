#!/usr/bin/env bash
set -euo pipefail
# Run from Trinity after deploying this branch. No credential is put into argv.
target="${1:-development}"
if [[ "$target" != "development" && "$target" != "production" ]]; then
  echo "Usage: bash scripts/configure-telegram.sh development|production" >&2
  exit 1
fi
args=()
if [[ "$target" == "development" ]]; then args=(--env development); else args=(--env ""); fi
echo "Enter the bot token from @BotFather into Wrangler's secret prompt."
npx wrangler secret put TELEGRAM_BOT_TOKEN "${args[@]}"
echo "Enter your numeric Telegram user ID. This is NOT your phone number."
npx wrangler secret put TELEGRAM_OWNER_USER_ID "${args[@]}"
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))" | npx wrangler secret put TELEGRAM_WEBHOOK_SECRET "${args[@]}"
echo "Secrets stored. Open Trinity Settings as owner, then Telegram -> verify bot and enable webhook."
echo "Send a private message to the bot to verify the complete flow."
