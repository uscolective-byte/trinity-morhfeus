$ErrorActionPreference = 'Stop'
$secretPath = Join-Path $PSScriptRoot '.credentials\access.dpapi'
if (-not (Test-Path -LiteralPath $secretPath)) { throw 'Tento pocitac nema ulozeny pristupovy kluc. Pouzi existujuci kluc Trinity.' }
$protected = (Get-Content -LiteralPath $secretPath -Raw).Trim() | ConvertTo-SecureString
$credential = [System.Net.NetworkCredential]::new('', $protected)
$headers=@{Authorization='Bearer '+$credential.Password}
$ticket=Invoke-RestMethod -Uri 'https://auru.dev/api/ops/login-ticket' -Method Post -Headers $headers -ContentType 'application/json' -Body '{}' -TimeoutSec 20
Start-Process ('https://auru.dev/#login='+$ticket.ticket)
Write-Host 'Trinity je otvorena a prihlasi ta automaticky. Nemusis pisat ziadny kluc.'
Write-Host 'Odkaz plati dve minuty a da sa pouzit iba raz. Trvaly kluc sa do URL ani schranky nekopiruje.'
