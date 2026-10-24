param(
  [ValidateSet('production', 'development')]
  [string]$Environment = 'production'
)
$ErrorActionPreference = 'Stop'

$targetUrl = if ($Environment -eq 'development') { 'https://auru.dev' } else { 'https://auru.space' }
$secretPath = Join-Path $PSScriptRoot '.credentials\access.dpapi'

if (-not (Test-Path -LiteralPath $secretPath)) {
  Write-Warning 'Tento pocitac nema lokalne ulozeny pristupovy kluc. Otvaram Trinity priamo.'
  Start-Process $targetUrl
  exit 0
}

try {
  $protected = (Get-Content -LiteralPath $secretPath -Raw).Trim() | ConvertTo-SecureString
  $credential = [System.Net.NetworkCredential]::new('', $protected)
  $headers = @{ Authorization = 'Bearer ' + $credential.Password }
  $ticket = Invoke-RestMethod -Uri "$targetUrl/api/ops/login-ticket" -Method Post -Headers $headers -ContentType 'application/json' -Body '{}' -TimeoutSec 15
  Start-Process ("$targetUrl/#login=" + $ticket.ticket)
  Write-Host "Trinity ($targetUrl) je otvorena a prihlasi ta automaticky."
  Write-Host "Odkaz plati dve minuty a da sa pouzit iba raz."
} catch {
  Write-Warning "Nepodarilo sa vygenerovat prihlasovaci listok cez $targetUrl. Otvaram stranku priamo."
  Start-Process $targetUrl
}
