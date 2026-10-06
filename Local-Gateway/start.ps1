$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:MORHFEUS_ROOT = (Resolve-Path (Join-Path $root '..')).Path
function Read-ProtectedToken([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  $secure = ConvertTo-SecureString ((Get-Content -LiteralPath $path -Raw).Trim())
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { if ($ptr -and $ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) } }
}
$localKeyPath = Join-Path $root '.credentials\local-token.dpapi'
$env:TRINITY_LOCAL_TOKEN = Read-ProtectedToken $localKeyPath
if (-not $env:TRINITY_LOCAL_TOKEN) { throw 'Chýba chránený lokálny token. Spusti setup.ps1.' }
$cloudKeyPath = Join-Path $root '.credentials\gateway-key.dpapi'
if (Test-Path -LiteralPath $cloudKeyPath) {
  $env:TRINITY_GATEWAY_KEY = Read-ProtectedToken $cloudKeyPath
  $env:TRINITY_CLOUD_URL = 'https://auru.dev'
}
if ($env:TRINITY_GATEWAY_KEY) {
  $env:TRINITY_PC_BRIDGE_KEY = $env:TRINITY_GATEWAY_KEY
  $env:TRINITY_PC_BRIDGE_URL = 'https://auru.dev/api/system/pc-bridge'
}
Set-Location $root
try {
  node src/server.mjs
}
finally {
  Remove-Item Env:\TRINITY_LOCAL_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:\TRINITY_GATEWAY_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:\TRINITY_PC_BRIDGE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:\TRINITY_CLOUD_URL -ErrorAction SilentlyContinue
  Remove-Item Env:\TRINITY_PC_BRIDGE_URL -ErrorAction SilentlyContinue
}
