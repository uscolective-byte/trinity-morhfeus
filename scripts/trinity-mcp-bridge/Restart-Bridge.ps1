# Safe Trinity MCP bridge start/restart. Requires a supplied per-installation secret.
$ErrorActionPreference = 'Stop'
$bridgeDir = $PSScriptRoot
$port = 3333
if ([string]::IsNullOrWhiteSpace($env:TRINITY_TOKEN) -or $env:TRINITY_TOKEN.Length -lt 32) {
  throw 'Set TRINITY_TOKEN (minimum 32 characters) securely before starting the bridge.'
}
try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 2
  if ($health.status -eq 'ok' -and $health.service -eq 'trinity-mcp-bridge') {
    Write-Host 'Trinity MCP bridge is already healthy; no process terminated.'
    exit 0
  }
} catch { }
$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listener) { throw "Port $port belongs to an existing process; refusing to terminate it automatically." }
$logDir = Join-Path $bridgeDir 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$env:TRINITY_WORKSPACE = Split-Path -Parent $bridgeDir
$env:TRINITY_PORT = [string]$port
$p = Start-Process -FilePath 'node.exe' -ArgumentList 'server.mjs' -WorkingDirectory $bridgeDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'bridge.out.log') -RedirectStandardError (Join-Path $logDir 'bridge.err.log')
$healthy = $false
for ($i=0; $i -lt 20; $i++) {
  Start-Sleep -Milliseconds 350
  if ($p.HasExited) { break }
  try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 1
    if ($h.status -eq 'ok' -and $h.service -eq 'trinity-mcp-bridge') { $healthy = $true; break }
  } catch { }
}
if (-not $healthy) { throw 'Bridge startup failed; inspect logs/bridge.err.log.' }
Set-Content -LiteralPath (Join-Path $logDir 'bridge.pid') -Value $p.Id
Write-Host "Bridge healthy. PID: $($p.Id)"
