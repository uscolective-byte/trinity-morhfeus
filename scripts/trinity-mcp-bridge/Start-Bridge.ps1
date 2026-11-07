# Start-Bridge.ps1 - Start Trinity MCP Bridge daemon if not already healthy
$BridgeDir = $PSScriptRoot
if (-not $BridgeDir) {
  $BridgeDir = "C:\Users\saboi\Trinity-antigravity\trinity-mcp-bridge"
}

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:3333/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
  if ($health.status -eq "ok" -and $health.service -eq "trinity-mcp-bridge") {
    Write-Host "TRINITY MCP Bridge is already running and healthy on port 3333."
    exit 0
  }
} catch {
  # Server not running or not healthy, proceed to restart/start
}

Write-Host "TRINITY MCP Bridge is not running or needs initialization. Starting..."
& (Join-Path $BridgeDir "Restart-Bridge.ps1")
