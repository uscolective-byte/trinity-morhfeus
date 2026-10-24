[CmdletBinding()]
param(
  [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root = Split-Path -Parent $PSScriptRoot
Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  ✦ TRINITY MORPHEUS - PRÍPRAVA PROSTREDIA A INŠTALÁCIA SKRIPTOV" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Kontrola Node.js
Write-Host "[1/4] Kontrola behového prostredia..." -ForegroundColor White
$nodeVer = (node.exe -v).Trim()
Write-Host "  ✔ Node.js: $nodeVer" -ForegroundColor Green

# 2. Kontrola a nastavenie Python
$localPython = Join-Path $env:LOCALAPPDATA "Python\bin\python.exe"
if (Test-Path $localPython) {
  $env:TRINITY_PYTHON_PATH = $localPython
  Write-Host "  ✔ Python detegovaný: $localPython" -ForegroundColor Green
  Write-Host "    (nastavená premenná TRINITY_PYTHON_PATH)" -ForegroundColor DarkGray
} else {
  Write-Host "  ℹ Python beží zo systémovej cesty PATH" -ForegroundColor DarkGray
}

# 3. Kontrola Git
$gitVer = (git.exe --version).Trim()
Write-Host "  ✔ Git: $gitVer" -ForegroundColor Green

# 4. Inštalácia závislostí pre všetky projekty
Write-Host ""
Write-Host "[2/4] Inštalácia závislostí pre všetky projekty..." -ForegroundColor White

$projects = @(
  @{ Name = "Root Ekosystém"; Path = $root },
  @{ Name = "Trinity Hlavný Worker"; Path = (Join-Path $root "Trinity") },
  @{ Name = "Local-Desktop (Lokálny server)"; Path = (Join-Path $root "Local-Desktop") },
  @{ Name = "Local-Gateway (PC Bridge)"; Path = (Join-Path $root "Local-Gateway") },
  @{ Name = "Knowledge-Worker"; Path = (Join-Path $root "Knowledge-Worker") },
  @{ Name = "Capacity-Worker"; Path = (Join-Path $root "Capacity-Worker") },
  @{ Name = "Integrations-Worker"; Path = (Join-Path $root "Integrations-Worker") },
  @{ Name = "PC-Bridge-Worker"; Path = (Join-Path $root "PC-Bridge-Worker") },
  @{ Name = "Audit-Worker"; Path = (Join-Path $root "Audit-Worker") }
)

foreach ($proj in $projects) {
  $pPath = $proj.Path
  $pkgJson = Join-Path $pPath "package.json"
  if (Test-Path $pkgJson) {
    Write-Host "  → Inštalujem: $($proj.Name)..." -ForegroundColor Cyan
    Push-Location $pPath
    if (Test-Path "package-lock.json") {
      & cmd.exe /c npm.cmd ci --ignore-scripts --silent
    } else {
      & cmd.exe /c npm.cmd install --ignore-scripts --silent
    }
    Write-Host "    ✔ Dokončené" -ForegroundColor Green
    Pop-Location
  }
}

# 5. Overenie testov
if (-not $SkipTests) {
  Write-Host ""
  Write-Host "[3/4] Overenie funkčnosti všetkých skriptov a testov..." -ForegroundColor White
  Push-Location $root
  & cmd.exe /c node.exe scripts/project-pipeline.mjs check
  Write-Host ""
  Write-Host "  ✔ Všetky systémové testy a kontroly úspešne prešli!" -ForegroundColor Green
  Pop-Location
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  ✦ INŠTALÁCIA A NASTAVENIE PROSTREDIA ÚSPEŠNE DOKONČENÉ!" -ForegroundColor Green
Write-Host "  Teraz môžeš spustiť TRINITY-COMMAND-CENTER.cmd pre správu systému." -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""
