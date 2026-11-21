#!/bin/bash
# ═══════════════════════════════════════════════════════════
# TRINITY v7.0.0 — Zero Local Footprint Deployment (Bash)
# ═══════════════════════════════════════════════════════════

set -e

ENV="${1:-production}"
DRY_RUN=false
SKIP_BUILD=false

for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    --skip-build) SKIP_BUILD=true ;;
  esac
done

echo ""
echo "[TRINITY] v7.0.0 — Zero Local Footprint Deploy"
echo "[TRINITY] Environment: $ENV"
echo ""

# 1. Syntax check
echo "[1/5] Validujem Worker syntax..."
WORKER_FILE="src/worker-v7.js"
[ ! -f "$WORKER_FILE" ] && WORKER_FILE="src/worker.js"

if command -v node &> /dev/null; then
  node --check "$WORKER_FILE" && echo "  ✓ Syntax OK" || exit 1
else
  echo "  ⚠ Node.js not found — skipping"
fi

# 2. Structure check
echo "[2/5] Kontrolujem štruktúru..."
for dir in src src/lib src/services public; do
  [ ! -d "$dir" ] && echo "  ✗ Missing: $dir/" && exit 1
done

for file in wrangler.jsonc src/lib/router.js src/lib/d1.js src/lib/contracts.js src/lib/stream-guard.js src/services/dispatcher.js; do
  [ ! -f "$file" ] && echo "  ✗ Missing: $file" && exit 1
done

ASSETS_COUNT=$(find public -type f 2>/dev/null | wc -l | tr -d ' ')
echo "  ✓ $ASSETS_COUNT static assets"
echo "  ✓ Štruktúra OK"

# 3. Build
if [ "$SKIP_BUILD" = false ]; then
  echo "[3/5] Bundling cez esbuild..."
  rm -rf dist && mkdir -p dist

  if [ "$DRY_RUN" = true ]; then
    echo "  [DRY RUN] npx --yes esbuild $WORKER_FILE --bundle --minify --format=esm --platform=browser --target=es2022 --outfile=dist/worker.js --external:cloudflare:* --external:node:* --external:@cloudflare/puppeteer"
  else
    npx --yes esbuild "$WORKER_FILE" --bundle --minify --format=esm --platform=browser --target=es2022 --outfile=dist/worker.js '--external:cloudflare:*' '--external:node:*' '--external:@cloudflare/puppeteer' 2>&1

    SIZE=$(du -b dist/worker.js | cut -f1)
    SIZE_MB=$(echo "scale=2; $SIZE / 1048576" | bc)
    echo "  ✓ Bundle: ${SIZE_MB} MB"
  fi
fi

# 4. Deploy
echo "[4/5] Nasadzujem..."
if [ "$DRY_RUN" = true ]; then
  echo "  [DRY RUN] npx --yes wrangler deploy"
else
  npx --yes wrangler deploy
fi

# 5. Cleanup
echo "[5/5] Čistenie..."
rm -rf dist
echo "  ✓ dist/ odstránené"

echo ""
echo "[TRINITY] Deploy dokončený! Zero Local Footprint."
echo ""
