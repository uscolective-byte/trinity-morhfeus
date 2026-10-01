param([string]$Config = 'wrangler.jsonc')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot)
$folder=Join-Path $PWD '.credentials'
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$path=Join-Path $folder 'access.dpapi'
if (Test-Path -LiteralPath $path) {
  $secure=(Get-Content -LiteralPath $path -Raw).Trim() | ConvertTo-SecureString
  $key=[System.Net.NetworkCredential]::new('', $secure).Password
} else {
  $bytes=New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $key=[Convert]::ToBase64String($bytes)
  $key | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath $path
}
# Only secret input is sent on stdin; never print it or put it in command arguments.
$key | & .\node_modules\.bin\wrangler.cmd secret put TRINITY_OPS_KEY --config $Config
if ($LASTEXITCODE -ne 0) { throw 'Nastavenie pristupu zlyhalo.' }
$key=$null
