# Trinity Sovereign AI OS - Unified Master Launcher
[CmdletBinding()]
param([switch]$OpenBrowser)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Magenta
Write-Host "       TRINITY SOVEREIGN AI OS - ALL SYSTEMS GO          " -ForegroundColor Magenta
Write-Host "==========================================================" -ForegroundColor Magenta

# 1. Start PC Bridge (Local-Gateway + Local-Desktop)
& (Join-Path $repoRoot 'Start-Trinity-PC-Bridge.ps1')

# 2. Open Trinity Production URL
Write-Host "`nOtváram Trinity Sovereign Control Center..." -ForegroundColor Green
$targetUrl = "https://auru.space"
Start-Process $targetUrl

Write-Host "`nTrinity OS je pripravená na adrese: $targetUrl" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Magenta
