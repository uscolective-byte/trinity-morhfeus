[CmdletBinding()]
param([ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,99}$')][string]$Model = 'qwen3:4b')
$ErrorActionPreference = 'Stop'
function Find-Ollama {
  $command = Get-Command ollama.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $known = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
  if (Test-Path -LiteralPath $known) { return $known }
  return $null
}
try {
  Write-Host 'Nastavenie lokalneho AI modelu Trinity. Prve stiahnutie potrebuje internet a niekolko GB miesta.'
  $ollama = Find-Ollama
  if (-not $ollama) {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) {
      Start-Process 'https://ollama.com/download/windows'
      throw 'Nainstaluj Ollama z otvorenej oficialnej stranky a spusti tento subor znovu.'
    }
    & $winget.Source install --id Ollama.Ollama --exact --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw 'Instalacia Ollama sa nedokoncila. Spusti tento subor znovu po jej dokonceni.' }
    $ollama = Find-Ollama
    if (-not $ollama) { throw 'Ollama sa nenasla. Dokonci instalaciu a spusti tento subor znovu.' }
  }
  $ready = $false
  try { $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2; $ready = $true } catch { }
  if (-not $ready) {
    Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden | Out-Null
    for ($i = 0; $i -lt 30; $i++) {
      Start-Sleep -Seconds 1
      try { $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2; $ready = $true; break } catch { }
    }
  }
  if (-not $ready) { throw 'Ollama neodpoveda. Otvor jej aplikaciu a skus znova.' }
  & $ollama pull $Model
  if ($LASTEXITCODE -ne 0) { throw 'Stiahnutie modelu zlyhalo. Over internet a volne miesto.' }
  Write-Host 'Overujem skutocnu odpoved modelu...'
  $body = @{ model=$Model; messages=@(@{role='user';content='Odpovedz jednym slovom: pripraveny'}); stream=$false; think=$false; options=@{num_predict=32;num_ctx=4096;num_thread=6} } | ConvertTo-Json -Depth 8
  $reply = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:11434/api/chat' -ContentType 'application/json' -Body $body -TimeoutSec 180
  if ($reply.done -ne $true -or [string]::IsNullOrWhiteSpace($reply.message.content)) { throw 'Model neposkytol dokoncenu odpoved.' }
  Write-Host ('Model odpovedal: ' + $reply.message.content)
  Write-Host 'Hotovo. Otvor Trinity a v Nastaveniach klikni Overit dostupnost.' -ForegroundColor Green
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
