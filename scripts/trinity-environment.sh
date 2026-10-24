#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TASK_ROOT"
case "${1:-check}" in
  setup)
    npm run setup
    ;;
  check)
    npm run check
    ;;
  login)
    cd Trinity
    npx --no-install wrangler login --device --browser=false
    ;;
  deploy)
    node scripts/source-policy.mjs
    git fetch origin main
    test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
    bash "$TASK_ROOT/scripts/trinity-environment.sh" check
    # Unlike whoami, this command fails when deployment credentials are unavailable.
    (cd Trinity && npx --no-install wrangler deployments list --name trinity > /dev/null)
    TASK_RELEASE_SHA="$(git rev-parse HEAD)"
    umask 077
    mkdir -p .deployment-backups
    TASK_BACKUP="$TASK_ROOT/.deployment-backups/trinity-$(date -u +%Y%m%dT%H%M%SZ).sql"
    (cd Trinity && npx --no-install wrangler d1 export trinity-v03 --remote --env="" --output "$TASK_BACKUP")
    test -s "$TASK_BACKUP"
    TASK_DEV_BACKUP="$TASK_ROOT/.deployment-backups/trinity-development-$(date -u +%Y%m%dT%H%M%SZ).sql"
    (cd Trinity && npx --no-install wrangler d1 export trinity-development --remote --env development --output "$TASK_DEV_BACKUP")
    test -s "$TASK_DEV_BACKUP"
    (cd Knowledge-Worker && npx --no-install wrangler deploy)
    (cd Integrations-Worker && npx --no-install wrangler deploy)
    (cd Trinity && npm run migrate:development && npm run deploy:development -- --tag "$TASK_RELEASE_SHA" && node scripts/verify-deployment.mjs https://auru.dev "$TASK_RELEASE_SHA")
    (cd Trinity && npx --no-install wrangler d1 migrations apply trinity-v03 --remote --env="" && npm run deploy -- --tag "$TASK_RELEASE_SHA" && node scripts/verify-deployment.mjs https://auru.space "$TASK_RELEASE_SHA")
    printf '%s\n' 'Deployment commands completed. Verify authenticated readiness and live provider receipts before declaring integrations operational.'
    ;;
  *) printf '%s\n' 'Usage: bash scripts/trinity-environment.sh setup|check|login|deploy' >&2; exit 2 ;;
esac
