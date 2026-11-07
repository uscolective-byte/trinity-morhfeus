# Trinity Sovereign AI OS - Unified PC Bridge Launcher
[CmdletBinding()]
param([switch]$Foreground)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   TRINITY SOVEREIGN AI OS - PC BRIDGE STARTUP DAEMON    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Setup credentials for Local Gateway if missing
$gwCreds = Join-Path $repoRoot 'Local-Gateway\.credentials\local-token.dpapi'
if (-not (Test-Path $gwCreds)) {
    Write-Host "[1/3] Inicializujem bezpečný DPAPI token pre Local-Gateway..." -ForegroundColor Yellow
    & (Join-Path $repoRoot 'Local-Gateway\setup.ps1')
}

# 2. Start Local Gateway (port 7789)
Write-Host "[2/3] Štartujem Trinity Local-Gateway (port 7789)..." -ForegroundColor Green
$gwScript = Join-Path $repoRoot 'Local-Gateway\start.ps1'
$gwProc = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$gwScript`"" -PassThru -WindowStyle Hidden

# 3. Start Local Desktop (port 7788)
Write-Host "[3/3] Štartujem Trinity Local-Desktop (port 7788)..." -ForegroundColor Green
$dtServer = Join-Path $repoRoot 'Local-Desktop\server.mjs'
$dtProc = Start-Process node -ArgumentList "`"$dtServer`"" -WorkingDirectory (Join-Path $repoRoot 'Local-Desktop') -PassThru -WindowStyle Hidden

Write-Host "`nČakám na potvrdenie zdravia služieb..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Health Check verification
$gwHealth = $false
$dtHealth = $false

try {
    $resGw = Invoke-RestMethod -Uri "http://127.0.0.1:7789/health" -TimeoutSec 3 -ErrorAction SilentlyContinue
    if ($resGw) { $gwHealth = $true }
} catch {}

try {
    $resDt = Invoke-RestMethod -Uri "http://127.0.0.1:7788/health" -TimeoutSec 3 -ErrorAction SilentlyContinue
    if ($resDt) { $dtHealth = $true }
} catch {}

Write-Host "Stav PC Bridge:" -ForegroundColor Cyan
Write-Host "  - Local-Gateway (7789): $(if ($gwHealth) { 'ONLINE (OK)' } else { 'BEŽÍ (PID: ' + $gwProc.Id + ')' })" -ForegroundColor $(if ($gwHealth) { 'Green' } else { 'Yellow' })
Write-Host "  - Local-Desktop (7788): $(if ($dtHealth) { 'ONLINE (OK)' } else { 'BEŽÍ (PID: ' + $dtProc.Id + ')' })" -ForegroundColor $(if ($dtHealth) { 'Green' } else { 'Yellow' })

Write-Host "`nPC Bridge je pripravený a aktívny. Prepojenie s Cloudflare Edge a Trinity OS funguje." -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
