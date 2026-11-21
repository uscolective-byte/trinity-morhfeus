# ═══════════════════════════════════════════════════════════
# TRINITY v7.0.0 — Zero Local Footprint Deployment
# PowerShell — bez trvalých node_modules
# ═══════════════════════════════════════════════════════════

param(
    [string]$Env = "production",
    [switch]$SkipBuild,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Write-Host ""
Write-Host "[TRINITY] v7.0.0 — Zero Local Footprint Deploy" -ForegroundColor Cyan
Write-Host "[TRINITY] Environment: $Env" -ForegroundColor Gray
Write-Host ""

# ─── 1. VALIDÁCIA SYNTAXE ───
Write-Host "[1/5] Validujem Worker syntax..." -ForegroundColor Cyan
$workerFile = if (Test-Path "$ProjectRoot\src\worker-v7.js") { "src\worker-v7.js" } else { "src\worker.js" }
$workerPath = Join-Path $ProjectRoot $workerFile

if (Get-Command node -ErrorAction SilentlyContinue) {
    node --check $workerPath 2>&1 | ForEach-Object {
        if ($_ -match "Error") {
            Write-Host "  ✗ Syntax error: $_" -ForegroundColor Red
            exit 1
        }
    }
    Write-Host "  ✓ Syntax OK" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Node.js not found — skipping syntax check" -ForegroundColor Yellow
}

# ─── 2. KONTROLA ŠTRUKTÚRY ───
Write-Host "[2/5] Kontrolujem adresárovú štruktúru..." -ForegroundColor Cyan

$requiredDirs = @("src", "src\lib", "src\services", "public")
$requiredFiles = @(
    "wrangler.jsonc",
    "src\lib\router.js",
    "src\lib\d1.js",
    "src\lib\contracts.js",
    "src\lib\stream-guard.js",
    "src\services\dispatcher.js"
)

foreach ($dir in $requiredDirs) {
    $path = Join-Path $ProjectRoot $dir
    if (-not (Test-Path $path)) {
        Write-Host "  ✗ Missing: $dir/" -ForegroundColor Red
        exit 1
    }
}

foreach ($file in $requiredFiles) {
    $path = Join-Path $ProjectRoot $file
    if (-not (Test-Path $path)) {
        Write-Host "  ✗ Missing: $file" -ForegroundColor Red
        exit 1
    }
}

# Skontroluj public/ assets
$publicDir = Join-Path $ProjectRoot "public"
if (Test-Path $publicDir) {
    $assets = Get-ChildItem $publicDir -Recurse -File
    $assetsSize = ($assets | Measure-Object -Property Length -Sum).Sum / 1KB
    Write-Host "  ✓ $($assets.Count) static assets ($([math]::Round($assetsSize, 1)) KB)" -ForegroundColor Green
} else {
    Write-Host "  ⚠ public/ not found — no static assets" -ForegroundColor Yellow
}

Write-Host "  ✓ Štruktúra OK" -ForegroundColor Green

# ─── 3. BUILD (esbuild cez npx) ───
if (-not $SkipBuild) {
    Write-Host "[3/5] Bundling cez esbuild..." -ForegroundColor Cyan

    $distDir = Join-Path $ProjectRoot "dist"
    if (Test-Path $distDir) { Remove-Item -Recurse -Force $distDir }
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null

    $esbuildArgs = @(
        "--yes", "esbuild",
        $workerPath,
        "--bundle",
        "--minify",
        "--format=esm",
        "--platform=browser",
        "--target=es2022",
        "--outfile=dist/worker.js",
        "--external:cloudflare:*",
        "--external:node:*",
        "--external:@cloudflare/puppeteer"
    )

    if ($DryRun) {
        Write-Host "  [DRY RUN] npx $($esbuildArgs -join ' ')" -ForegroundColor Yellow
    } else {
        & npx @esbuildArgs 2>&1 | ForEach-Object {
            if ($_ -match "error") {
                Write-Host "  ✗ $_" -ForegroundColor Red
                exit 1
            }
        }

        $bundleSize = (Get-Item "$distDir\worker.js").Length / 1MB
        $sizeStr = "{0:N2}" -f $bundleSize
        $color = if ($bundleSize -lt 0.65) { "Green" } elseif ($bundleSize -lt 1) { "Yellow" } else { "Red" }
        Write-Host "  ✓ Bundle: $sizeStr MB" -ForegroundColor $color

        if ($bundleSize -gt 1) {
            Write-Host "  ⚠ Bundle > 1MB — zvážte ďalšiu optimalizáciu" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "[3/5] Build preskočený (--SkipBuild)" -ForegroundColor Yellow
}

# ─── 4. DEPLOY ───
Write-Host "[4/5] Nasadzujem na Cloudflare..." -ForegroundColor Cyan

$wranglerArgs = @("--yes", "wrangler", "deploy")
if ($Env -ne "production") {
    $wranglerArgs += @("--env", $Env)
}
if ($DryRun) {
    $wranglerArgs += @("--dry-run")
}

if ($DryRun) {
    Write-Host "  [DRY RUN] npx $($wranglerArgs -join ' ')" -ForegroundColor Yellow
} else {
    & npx @wranglerArgs 2>&1 | ForEach-Object {
        if ($_ -match "error|Error") {
            Write-Host "  ✗ $_" -ForegroundColor Red
        } elseif ($_ -match "Published|deployed|✅") {
            Write-Host "  ✓ $_" -ForegroundColor Green
        } else {
            Write-Host "  $_" -ForegroundColor Gray
        }
    }
}

# ─── 5. ČISTENIE (Zero Local Footprint) ───
Write-Host "[5/5] Čistenie lokálnych artefaktov..." -ForegroundColor Cyan

if (Test-Path $distDir) {
    Remove-Item -Recurse -Force $distDir
    Write-Host "  ✓ dist/ odstránené" -ForegroundColor Green
}

# Vyčistí npx cache (voliteľné)
$npmCache = Join-Path $env:LOCALAPPDATA "npm-cache\_npx"
if (Test-Path $npmCache) {
    $cacheSize = (Get-ChildItem $npmCache -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
    if ($cacheSize -gt 100) {
        Remove-Item -Recurse -Force $npmCache -ErrorAction SilentlyContinue
        Write-Host "  ✓ npx cache vyčistený ($([math]::Round($cacheSize, 1)) MB)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "[TRINITY] Deploy dokončený!" -ForegroundColor Green
Write-Host ""
Write-Host "  Statické assets → Cloudflare CDN (0 ms CPU)" -ForegroundColor Gray
Write-Host "  API → Worker runtime ($sizeStr MB)" -ForegroundColor Gray
Write-Host "  Zero Local Footprint — žiadne node_modules" -ForegroundColor Gray
Write-Host ""
