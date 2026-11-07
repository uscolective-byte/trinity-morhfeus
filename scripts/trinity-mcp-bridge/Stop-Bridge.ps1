# Stop-Bridge.ps1 - Gracefully terminate Trinity MCP Bridge daemon
$ErrorActionPreference = 'SilentlyContinue'

$BridgeDir = $PSScriptRoot
$LogDir = Join-Path $BridgeDir "logs"
$PidFile = Join-Path $LogDir "bridge.pid"

Write-Host "Stopping TRINITY MCP Bridge..."

$pidsToKill = @()

if (Test-Path $PidFile) {
  $savedPid = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue
  if ($savedPid -match '^\d+$') {
    $pidsToKill += [int]$savedPid
  }
}

$portConnections = Get-NetTCPConnection -LocalPort 3333 -ErrorAction SilentlyContinue
if ($portConnections) {
  $pidsToKill += ($portConnections | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 })
}

$nodeProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -match 'server\.mjs' }
if ($nodeProcs) {
  $pidsToKill += ($nodeProcs | Select-Object -ExpandProperty ProcessId)
}

$pidsToKill = $pidsToKill | Select-Object -Unique

foreach ($p in $pidsToKill) {
  $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
  if ($proc) {
    Write-Host "Terminating Process ID $p ($($proc.ProcessName))..."
    Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
  }
}

# Wait for port 3333 to release
$deadline = [DateTime]::UtcNow.AddSeconds(5)
while ([DateTime]::UtcNow -lt $deadline) {
  $conn = Get-NetTCPConnection -LocalPort 3333 -State Listen -ErrorAction SilentlyContinue
  if (-not $conn) { break }
  Start-Sleep -Milliseconds 200
}

if (Test-Path $PidFile) {
  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

Write-Host "TRINITY MCP Bridge stopped."
