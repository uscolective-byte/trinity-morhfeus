[CmdletBinding()]
param([ValidateSet('production','development')][string]$Environment = 'production')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
foreach ($name in @('TRINITY_GATEWAY_KEY','TRINITY_PC_BRIDGE_KEY','TRINITY_CLOUD_URL','TRINITY_PC_BRIDGE_URL')) {
  Remove-Item "Env:\$name" -ErrorAction SilentlyContinue
}
if (Test-Path 'C:\Users\saboi\.env') {
  foreach($line in [IO.File]::ReadAllLines('C:\Users\saboi\.env')){
    if($line -match '^\s*(CLOUDFLARE_ACCESS_CLIENT_ID|CLOUDFLARE_ACCESS_CLIENT_SECRET)=(.*)$'){
      Set-Item -Path ('Env:'+$Matches[1]) -Value $Matches[2].Trim()
    }
  }
}
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
$credentialFile = if ($Environment -eq 'development') { 'gateway-key-development.dpapi' } else { 'gateway-key.dpapi' }
$cloudKeyPath = Join-Path (Join-Path $root '.credentials') $credentialFile
if (Test-Path -LiteralPath $cloudKeyPath) {
  $env:TRINITY_GATEWAY_KEY = Read-ProtectedToken $cloudKeyPath
  $env:TRINITY_CLOUD_URL = if ($Environment -eq 'development') { 'https://auru.dev' } else { 'https://auru.space' }
}
if ($env:TRINITY_GATEWAY_KEY) {
  $env:TRINITY_PC_BRIDGE_KEY = $env:TRINITY_GATEWAY_KEY
  $env:TRINITY_PC_BRIDGE_URL = "$env:TRINITY_CLOUD_URL/api/system/pc-bridge"
}
Set-Location $root
$pythonCommand=Get-Command python.exe -ErrorAction SilentlyContinue
if($pythonCommand){$env:TRINITY_PYTHON_PATH=$pythonCommand.Source}
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
