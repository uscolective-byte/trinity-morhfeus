$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$node = Join-Path $root 'runtime\node.exe'
$data = Join-Path $root 'Data'
$launchFile = Join-Path $data 'launch.json'
try {
  if (-not (Test-Path -LiteralPath $node)) { throw 'Chyba runtime\node.exe. Rozbal cely balik vratane runtime.' }
  $expected = '9c9245166b4a8e182e0b797da9c20136117ff24368eaff1fec8343a123c8db0e'
  if ((Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Kontrola Node runtime zlyhala. Stiahni povodny balik znovu.' }
  New-Item -ItemType Directory -Force -Path $data | Out-Null
  if (Test-Path -LiteralPath $launchFile) {
    $oldRunning = $false
    try {
      $existing = Get-Content -LiteralPath $launchFile -Raw | ConvertFrom-Json
      $health = Invoke-RestMethod -Uri ("http://127.0.0.1:" + [int]$existing.port + '/health') -TimeoutSec 2
      if ($health.service -eq 'Trinity Local Desktop') {
        if ($health.version -eq '2.0.0') {
          Start-Process $existing.url
          Write-Host 'Trinity je uz spustena. Otvoril som jej okno.'
          exit 0
        }
        $oldRunning = $true
      }
    } catch { }
    if ($oldRunning) { throw 'Najprv ukonci starsiu Trinity jej tlacidlom Ukoncit Trinity a potom spusti novu verziu.' }
    Remove-Item -LiteralPath $launchFile -Force
  }
  $selected = $null
  foreach ($port in 8795..8805) {
    $probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
    try { $probe.Start(); $selected = $port; break } catch { } finally { $probe.Stop() }
  }
  if (-not $selected) { throw 'Porty 8795-8805 su obsadene.' }
  $env:TRINITY_DESKTOP_PORT = [string]$selected
  $process = Start-Process -FilePath $node -ArgumentList @(('"' + (Join-Path $root 'server.mjs') + '"')) -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $data 'server.log') -RedirectStandardError (Join-Path $data 'error.log')
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Milliseconds 250
    $process.Refresh()
    if ($process.HasExited) { throw 'Trinity sa zastavila. Podrobnosti su v Data\error.log.' }
    if (Test-Path -LiteralPath $launchFile) {
      try {
        $state = Get-Content -LiteralPath $launchFile -Raw | ConvertFrom-Json
        $health = Invoke-RestMethod -Uri ("http://127.0.0.1:" + [int]$state.port + '/health') -TimeoutSec 2
        if ($health.service -eq 'Trinity Local Desktop' -and $state.pid -eq $process.Id) {
          Start-Process $state.url
          Write-Host 'Trinity Local je spustena. Toto okno mozes zatvorit.'
          exit 0
        }
      } catch { }
    }
  }
  throw 'Trinity sa nestihla spustit. Pozri Data\error.log.'
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
