$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
$secret=(Get-Content -LiteralPath '.credentials/access.dpapi' -Raw).Trim() | ConvertTo-SecureString
$env:TRINITY_TEST_KEY=[Net.NetworkCredential]::new('', $secret).Password
try { node scripts/live-test.mjs; exit $LASTEXITCODE } finally { Remove-Item Env:TRINITY_TEST_KEY }
