[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-f0-9]{40}$')]
  [string]$SourceCommit,
  [string]$BridgeRoot = 'C:\Users\saboi\Documents\Codex\Morhfeus\Trinity\trinity-pc-bridge'
)

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This setup requires Windows.' }
$BridgeRoot = [IO.Path]::GetFullPath($BridgeRoot)
$bridge = Join-Path $BridgeRoot 'bridge.mjs'
$helper = Join-Path $BridgeRoot 'local-model.mjs'
$launcher = Join-Path $BridgeRoot 'Start-TrinityBridge.ps1'
$helperHash = 'DFD432E19CCE4C20E1068F332544FEBFAF40E2D4E172889F8CBB772A6B239CCA'
foreach ($path in @($BridgeRoot, $bridge, $launcher, (Join-Path $BridgeRoot '.env'))) {
  if (!(Test-Path -LiteralPath $path)) { throw "Missing required path: $path. No project files changed." }
}
function Assert-NoLink([string]$path) {
  $cursor = $path
  while ($cursor) {
    if ((Test-Path -LiteralPath $cursor) -and
        ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
      throw 'A setup path uses a junction or symbolic link. No automatic update is allowed.'
    }
    $parent = Split-Path -Parent $cursor
    if ($parent -eq $cursor) { break }
    $cursor = $parent
  }
}
Assert-NoLink $BridgeRoot
Assert-NoLink $bridge
Assert-NoLink $launcher
if (Test-Path -LiteralPath $helper) { Assert-NoLink $helper }
$node = (Get-Command node -CommandType Application -ErrorAction Stop).Source
$nodeVersion = & $node --version
$versionMatch = [regex]::Match([string]$nodeVersion, '^v(\d+)\.')
if ($LASTEXITCODE -ne 0 -or !$versionMatch.Success -or [int]$versionMatch.Groups[1].Value -lt 22) {
  throw 'Node.js 22 or newer is required.'
}

# Read source code only, never .env or credential contents.
$originalHash = (Get-FileHash -LiteralPath $bridge -Algorithm SHA256).Hash
$originalBytes = [IO.File]::ReadAllBytes($bridge)
$hasBom = $originalBytes.Length -ge 3 -and $originalBytes[0] -eq 239 -and $originalBytes[1] -eq 187 -and $originalBytes[2] -eq 191
$source = [IO.File]::ReadAllText($bridge, [Text.Encoding]::UTF8)
$old = "receipt = { response:'[lok" + [char]0xE1 + "lny model nie je nakonfigurovan" + [char]0xFD + "]', model:'none' }; break;"
$new = "receipt = await (await import('./local-model.mjs')).runLocalInference(payload); break;"
$oldCount = [regex]::Matches($source, [regex]::Escape($old)).Count
$newCount = [regex]::Matches($source, [regex]::Escape($new)).Count
if (!(($oldCount -eq 1 -and $newCount -eq 0) -or ($oldCount -eq 0 -and $newCount -eq 1))) {
  throw 'Bridge source differs from the verified patch. Existing edits were preserved; manual review is required.'
}
if ((Test-Path -LiteralPath $helper) -and ((Get-FileHash -LiteralPath $helper -Algorithm SHA256).Hash -ne $helperHash)) {
  throw 'local-model.mjs contains different code. It will not be overwritten.'
}
$allBridges = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine -match '[\\/]trinity-pc-bridge[\\/]bridge\.mjs' })
$matching = @($allBridges | Where-Object { $_.CommandLine -match [regex]::Escape($bridge) })
if ($allBridges.Count -ne $matching.Count -or $matching.Count -gt 1) {
  throw 'A different or duplicate legacy bridge is running. No process was stopped; its location must be checked first.'
}

$ollama = Get-Command ollama -CommandType Application -ErrorAction SilentlyContinue
$ollamaPath = if ($ollama) { $ollama.Source } else { Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe' }
if (!(Test-Path -LiteralPath $ollamaPath)) {
  throw 'Install Ollama for Windows from https://ollama.com/download/windows, then rerun this setup.'
}
function Get-OllamaModels {
  Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5 -MaximumRedirection 0
}
try { $tags = Get-OllamaModels } catch {
  $previousHost = $env:OLLAMA_HOST
  try {
    $env:OLLAMA_HOST = '127.0.0.1:11434'
    Start-Process -FilePath $ollamaPath -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
  } finally {
    if ($null -eq $previousHost) { Remove-Item Env:\OLLAMA_HOST -ErrorAction SilentlyContinue }
    else { $env:OLLAMA_HOST = $previousHost }
  }
  $tags = $null
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    try { $tags = Get-OllamaModels; break } catch {}
  }
  if ($null -eq $tags) { throw 'Ollama did not start on 127.0.0.1:11434.' }
}
if (!(@($tags.models | ForEach-Object { $_.name }) -contains 'qwen3:4b-instruct')) {
  Write-Host 'Downloading qwen3:4b-instruct (about 2.5 GB). Existing models will not be deleted.'
  $previousHost = $env:OLLAMA_HOST
  try {
    $env:OLLAMA_HOST = '127.0.0.1:11434'
    & $ollamaPath pull 'qwen3:4b-instruct'
    if ($LASTEXITCODE -ne 0) { throw 'Ollama model download failed.' }
  } finally {
    if ($null -eq $previousHost) { Remove-Item Env:\OLLAMA_HOST -ErrorAction SilentlyContinue }
    else { $env:OLLAMA_HOST = $previousHost }
  }
}

# Verify the real configured model before changing the bridge.
$body = @{
  model = 'qwen3:4b-instruct'; stream = $false; keep_alive = '30m'
  messages = @(@{ role = 'user'; content = 'Reply with only OK.' })
  options = @{ num_predict = 8; num_ctx = 4096; num_thread = 6; temperature = 0 }
} | ConvertTo-Json -Depth 6 -Compress
$reply = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/chat' -Method Post `
  -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) `
  -TimeoutSec 75 -MaximumRedirection 0
if ($reply.done -ne $true -or $reply.model -ne 'qwen3:4b-instruct' -or [string]::IsNullOrWhiteSpace($reply.message.content)) {
  throw 'Ollama did not return a completed response from the configured model.'
}
Write-Host 'OLLAMA_TEST_OK: qwen3:4b-instruct returned a real response.'

$tempHelper = Join-Path $BridgeRoot ('.local-model-' + [guid]::NewGuid().ToString('N') + '.tmp')
$tempBridge = Join-Path $BridgeRoot ('.bridge-' + [guid]::NewGuid().ToString('N') + '.tmp.mjs')
try {
  if (!(Test-Path -LiteralPath $helper)) {
    $url = "https://raw.githubusercontent.com/uscolective-byte/trinity-morhfeus/$SourceCommit/Trinity/trinity-pc-bridge/local-model.mjs"
    Invoke-WebRequest -Uri $url -UseBasicParsing -OutFile $tempHelper -MaximumRedirection 0
    if ((Get-FileHash -LiteralPath $tempHelper -Algorithm SHA256).Hash -ne $helperHash) {
      throw 'Downloaded helper checksum does not match. Bridge was not changed.'
    }
    [IO.File]::Move($tempHelper, $helper)
  }
  if ($oldCount -eq 1) {
    [IO.File]::WriteAllText($tempBridge, $source.Replace($old, $new), (New-Object Text.UTF8Encoding($hasBom)))
    & $node --check $tempBridge
    if ($LASTEXITCODE -ne 0) { throw 'Patched bridge failed the Node syntax check.' }
    if ((Get-FileHash -LiteralPath $bridge -Algorithm SHA256).Hash -ne $originalHash) {
      throw 'Bridge changed during setup. Existing edits were preserved.'
    }
    $backupRoot = Join-Path $env:LOCALAPPDATA 'Trinity\CodeBackups'
    Assert-NoLink $backupRoot
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    Assert-NoLink $backupRoot
    $backup = Join-Path $backupRoot ('bridge-' + [guid]::NewGuid().ToString('N') + '.mjs')
    [IO.File]::Replace($tempBridge, $bridge, $backup)
    Write-Host 'BRIDGE_PATCH_OK: one placeholder was replaced; an original-code backup was saved outside the project.'
  } else {
    Write-Host 'BRIDGE_PATCH_OK: the verified local-model call is already installed.'
  }
} finally {
  foreach ($temp in @($tempHelper, $tempBridge)) {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force }
  }
}

# Only restart this exact bridge. Never stop Wrangler, other node.exe processes or Ollama.
foreach ($process in $matching) {
  $current = Get-CimInstance Win32_Process -Filter ("ProcessId = " + $process.ProcessId)
  if ($current -and $current.CreationDate -eq $process.CreationDate -and
      $current.CommandLine -match [regex]::Escape($bridge)) {
    Stop-Process -Id $current.ProcessId -ErrorAction Stop
  } elseif ($current) {
    throw 'Bridge process identity changed during setup. No unrelated process was stopped.'
  }
}
if ($matching.Count) { Start-Sleep -Seconds 1 }
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File $launcher -NoDashboard -Silent
if ($LASTEXITCODE -ne 0) { throw 'Bridge restart failed. Local-model setup remains installed.' }
Write-Host 'BRIDGE_START_REQUESTED: verify the next Trinity chat response.'
Write-Host 'Cloud credentials, .env, permissions and tunnel settings were not modified.'
Write-Host 'This verifies local Ollama only; it does not claim that cloud chat or all MCP clients are connected.'