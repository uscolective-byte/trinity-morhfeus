$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:MORHFEUS_ROOT = (Resolve-Path (Join-Path $root '..')).Path
$cloudKeyPath = Join-Path $root '.credentials\gateway-key.dpapi'
if (Test-Path -LiteralPath $cloudKeyPath) {
  $cloudSecure = ConvertTo-SecureString ((Get-Content -LiteralPath $cloudKeyPath -Raw).Trim())
  $cloudPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($cloudSecure)
  try {
    $env:TRINITY_GATEWAY_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($cloudPtr)
    $env:TRINITY_CLOUD_URL = 'https://auru.dev'
  }
  finally {
    if ($cloudPtr -and $cloudPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($cloudPtr) }
  }
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
}
