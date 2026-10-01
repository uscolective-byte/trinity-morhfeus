$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$protected = (Get-Content -LiteralPath (Join-Path $root '.credentials\local-token.dpapi') -Raw).Trim()
$secure = ConvertTo-SecureString $protected
$ptr = [IntPtr]::Zero
try {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $env:TRINITY_LOCAL_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $env:MORHFEUS_ROOT = (Resolve-Path (Join-Path $root '..')).Path
  $cloudKeyPath = Join-Path $root '.credentials\gateway-key.dpapi'
  if (Test-Path -LiteralPath $cloudKeyPath) {
    $cloudSecure = ConvertTo-SecureString ((Get-Content -LiteralPath $cloudKeyPath -Raw).Trim())
    $cloudPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($cloudSecure)
    $env:TRINITY_GATEWAY_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($cloudPtr)
    $env:TRINITY_CLOUD_URL = 'https://auru.dev'
  }
  Set-Location $root
  node src/server.mjs
} finally {
  if ($cloudPtr -and $cloudPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($cloudPtr) }
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  Remove-Item Env:\TRINITY_LOCAL_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:\TRINITY_GATEWAY_KEY -ErrorAction SilentlyContinue
}
