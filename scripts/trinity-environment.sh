#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$TASK_ROOT"
case "${1:-check}" in
  setup)
    node -e 'if(Number(process.versions.node.split(".")[0])<22)throw Error("Node.js 22+ required")'
    for project in Trinity Knowledge-Worker Integrations-Worker PC-Bridge-Worker Local-Gateway; do
      (cd "$project" && npm ci --ignore-scripts)
    done
    ;;
  check)
    (cd Trinity && npm test && npm audit --audit-level=high)
    (cd Knowledge-Worker && npm test)
    (cd Integrations-Worker && npm run build)
    (cd Trinity && npx --no-install wrangler deploy --config wrangler.integrations.jsonc --dry-run --outdir dist-integrations && node --test tests/integrations.runtime.mjs)
    node --test Audit-Worker/tests/*.test.mjs
    (cd PC-Bridge-Worker && npm test)
    (cd Local-Gateway && npm test)
    ;;
  login)
    cd Trinity
    npx --no-install wrangler login --device --browser=false
    ;;
  deploy)
    bash "$TASK_ROOT/scripts/trinity-environment.sh" check
    # Unlike whoami, this command fails when deployment credentials are unavailable.
    (cd Trinity && npx --no-install wrangler deployments list --name trinity > /dev/null)
    TASK_RELEASE_SHA="$(git rev-parse HEAD)"
    umask 077
    mkdir -p .deployment-backups
    TASK_BACKUP="$TASK_ROOT/.deployment-backups/trinity-$(date -u +%Y%m%dT%H%M%SZ).sql"
    (cd Trinity && npx --no-install wrangler d1 export DB --remote --output "$TASK_BACKUP")
    test -s "$TASK_BACKUP"
    (cd Knowledge-Worker && npx --no-install wrangler deploy)
    (cd Integrations-Worker && npx --no-install wrangler deploy)
    (cd Trinity && npx --no-install wrangler d1 migrations apply DB --remote && npm run deploy -- --tag "$TASK_RELEASE_SHA" && node scripts/verify-deployment.mjs https://auru.space "$TASK_RELEASE_SHA")
    printf '%s\n' 'Deployment commands completed. Verify authenticated readiness and live provider receipts before declaring integrations operational.'
    ;;
  *) printf '%s\n' 'Usage: bash scripts/trinity-environment.sh setup|check|login|deploy' >&2; exit 2 ;;
esac
