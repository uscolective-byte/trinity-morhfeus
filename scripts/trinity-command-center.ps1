# ==============================================================================
# TRINITY COMMAND CENTER & SCRIPT RUNNER (WINDOWS)
# ==============================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $PSScriptRoot

# Nastavenie prostredia
$localPython = Join-Path $env:LOCALAPPDATA "Python\bin\python.exe"
if (Test-Path $localPython) {
  $env:TRINITY_PYTHON_PATH = $localPython
}

function Show-Header {
  Clear-Host
  Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
  Write-Host "║                 ✦ TRINITY COMMAND CENTER ✦                         ║" -ForegroundColor Yellow
  Write-Host "║           Autonómne prostredie a riadiace centrum pre PC           ║" -ForegroundColor DarkGray
  Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
  Write-Host "  Repo: $root" -ForegroundColor DarkGray
  Write-Host "  Čas:  $(Get-Date -Format 'dd.MM.yyyy HH:mm:ss')" -ForegroundColor DarkGray
  Write-Host "──────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
}

while ($true) {
  Show-Header
  Write-Host ""
  Write-Host "  LOKÁLNE SLUŽBY & RUNTIME:" -ForegroundColor White
  Write-Host "   [1] 🖥️  Spustiť Trinity Local Desktop (localhost:31415)" -ForegroundColor Green
  Write-Host "   [2] 🌉  Spustiť Local Gateway PC Bridge (localhost:8787)" -ForegroundColor Green
  Write-Host "   [3] 💬  Spustiť Gemini Developer Agent CLI Chat" -ForegroundColor Green
  Write-Host ""
  Write-Host "  TESTY & KONTROLA INTEGRITY:" -ForegroundColor White
  Write-Host "   [4] 🧪  Spustiť kompletnú kontrolu celého systému (check pipeline)" -ForegroundColor Cyan
  Write-Host "   [5] ⚡  Spustiť testy Trinity hlavného Workeru (301 testov)" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  CLOUDFLARE CLOUD & WEBY:" -ForegroundColor White
  Write-Host "   [6] 🌐  Otvoriť Trinity Produkciu v prehliadači (auru.space)" -ForegroundColor Magenta
  Write-Host "   [7] 🛠️  Otvoriť Trinity Development v prehliadači (auru.dev)" -ForegroundColor Magenta
  Write-Host "   [8] 🚀  Nasadiť na Produkciu (npm run deploy)" -ForegroundColor Yellow
  Write-Host "   [9] 📦  Nasadiť na Development (npm run deploy:development)" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  SPRÁVA PROSTREDIA:" -ForegroundColor White
  Write-Host "   [10] 🔄  Nainštalovať/aktualizovať všetky skripty a balíčky" -ForegroundColor White
  Write-Host "   [11] 💻  Otvoriť prekonfigurovaný PowerShell v Trinity repozitári" -ForegroundColor White
  Write-Host ""
  Write-Host "   [0]  ❌  Ukončiť" -ForegroundColor Red
  Write-Host ""
  Write-Host "──────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
  $choice = Read-Host "  Zadaj voľbu [0-11]"

  switch ($choice.Trim()) {
    '1' {
      Write-Host "`nSpúšťam Trinity Local Desktop na pozadí..." -ForegroundColor Green
      Start-Process cmd.exe -ArgumentList "/k cd /d `"$root\Local-Desktop`" && npm.cmd start"
    }
    '2' {
      Write-Host "`nSpúšťam Trinity Local Gateway PC Bridge na pozadí..." -ForegroundColor Green
      Start-Process cmd.exe -ArgumentList "/k cd /d `"$root\Local-Gateway`" && npm.cmd start"
    }
    '3' {
      Write-Host "`nSpúšťam Gemini Developer Agent CLI..." -ForegroundColor Green
      Push-Location $root
      node scripts/gemini-dev-chat.mjs
      Pop-Location
      Write-Host "`nStlačte Enter pre návrat do menu..."
      [void][Console]::ReadLine()
    }
    '4' {
      Write-Host "`nSpúšťam kompletnú kontrolu celého ekosystému..." -ForegroundColor Cyan
      Push-Location $root
      npm.cmd run check
      Pop-Location
      Write-Host "`nStlačte Enter pre návrat do menu..."
      [void][Console]::ReadLine()
    }
    '5' {
      Write-Host "`nSpúšťam testy Trinity Workeru..." -ForegroundColor Cyan
      Push-Location "$root\Trinity"
      npm.cmd test
      Pop-Location
      Write-Host "`nStlačte Enter pre návrat do menu..."
      [void][Console]::ReadLine()
    }
    '6' {
      Write-Host "`nOtváram Produkciu: https://auru.space" -ForegroundColor Magenta
      Push-Location "$root\Trinity"
      powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$root\Trinity\OTVORIT-TRINITY.ps1" -Environment production
      Pop-Location
    }
    '7' {
      Write-Host "`nOtváram Development: https://auru.dev" -ForegroundColor Magenta
      Push-Location "$root\Trinity"
      powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$root\Trinity\OTVORIT-TRINITY.ps1" -Environment development
      Pop-Location
    }
    '8' {
      Write-Host "`nNasadzujem Trinity na PRODUKCIU (auru.space)..." -ForegroundColor Yellow
      Push-Location "$root\Trinity"
      npm.cmd run deploy
      Pop-Location
      Write-Host "`nStlačte Enter pre návrat do menu..."
      [void][Console]::ReadLine()
    }
    '9' {
      Write-Host "`nNasadzujem Trinity na DEVELOPMENT (auru.dev)..." -ForegroundColor Yellow
      Push-Location "$root\Trinity"
      npm.cmd run deploy:development
      Pop-Location
      Write-Host "`nStlačte Enter pre návrat do menu..."
      [void][Console]::ReadLine()
    }
    '10' {
      Write-Host "`nInštalujem všetky závislosti..." -ForegroundColor White
      & "$root\scripts\install-all.ps1"
      Write-Host "`nStlačte Enter pre návrat do menu..."
      [void][Console]::ReadLine()
    }
    '11' {
      Write-Host "`nOtváram novú konzolu PowerShell..." -ForegroundColor White
      Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "cd `"$root`"; Write-Host 'Vitaj v Trinity Developer Console!' -ForegroundColor Yellow; `$env:TRINITY_PYTHON_PATH='$localPython'"
    }
    '0' {
      Write-Host "`nDovidenia!" -ForegroundColor Cyan
      break
    }
    default {
      Write-Host "`nNeplatná voľba, skúste znova." -ForegroundColor Red
      Start-Sleep -Seconds 1
    }
  }
}
