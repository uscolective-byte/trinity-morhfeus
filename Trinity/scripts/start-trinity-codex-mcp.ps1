[CmdletBinding()]
param(
  [ValidatePattern('^[a-z0-9-]+$')][string]$CredentialName = 'gemini-mcp',
  [string]$Origin
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$credentialPath = Join-Path $root ".credentials\$CredentialName.dpapi"

$accessEnvPath = if ($env:SHARED_ENV_PATH) { $env:SHARED_ENV_PATH } else { Join-Path $HOME '.env' }
$envToken = [Environment]::GetEnvironmentVariable('TRINITY_MCP_API_KEY', 'Process')
if (-not $envToken) { $envToken = [Environment]::GetEnvironmentVariable('TRINITY_MCP_TOKEN', 'Process') }
$accessId = $null
$accessSecret = $null
$managedEnvironmentNames = @(
  'TRINITY_MCP_TOKEN', 'TRINITY_MCP_API_KEY', 'TRINITY_MCP_URL',
  'CLOUDFLARE_ACCESS_CLIENT_ID', 'CLOUDFLARE_ACCESS_CLIENT_SECRET',
  'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET'
)
$originalEnvironment = @{}
foreach ($name in $managedEnvironmentNames) {
  $originalEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

if (Test-Path -LiteralPath $accessEnvPath) {
  foreach ($line in Get-Content -LiteralPath $accessEnvPath) {
    if ($line -match '^\s*(CLOUDFLARE_ACCESS_CLIENT_ID|CF_ACCESS_CLIENT_ID)\s*=\s*(.*?)\s*$') {
      $accessId = $Matches[2].Trim('"').Trim("'")
    }
    if ($line -match '^\s*(CLOUDFLARE_ACCESS_CLIENT_SECRET|CF_ACCESS_CLIENT_SECRET)\s*=\s*(.*?)\s*$') {
      $accessSecret = $Matches[2].Trim('"').Trim("'")
    }
    if ($line -match '^\s*(TRINITY_MCP_API_KEY|TRINITY_MCP_TOKEN)\s*=\s*(.*?)\s*$') {
      $envToken = $Matches[2].Trim('"').Trim("'")
    }
  }
}

# Resolve process or environment values
if (-not $accessId) { $accessId = [Environment]::GetEnvironmentVariable('CLOUDFLARE_ACCESS_CLIENT_ID', 'Process'); if (-not $accessId) { $accessId = [Environment]::GetEnvironmentVariable('CF_ACCESS_CLIENT_ID', 'Process') } }
if (-not $accessSecret) { $accessSecret = [Environment]::GetEnvironmentVariable('CLOUDFLARE_ACCESS_CLIENT_SECRET', 'Process'); if (-not $accessSecret) { $accessSecret = [Environment]::GetEnvironmentVariable('CF_ACCESS_CLIENT_SECRET', 'Process') } }

$ptr = [IntPtr]::Zero
try {
  # Set both aliases for the child process; restore the caller's values below.
  if ($accessId) {
    [Environment]::SetEnvironmentVariable('CLOUDFLARE_ACCESS_CLIENT_ID', $accessId, 'Process')
    [Environment]::SetEnvironmentVariable('CF_ACCESS_CLIENT_ID', $accessId, 'Process')
  }
  if ($accessSecret) {
    [Environment]::SetEnvironmentVariable('CLOUDFLARE_ACCESS_CLIENT_SECRET', $accessSecret, 'Process')
    [Environment]::SetEnvironmentVariable('CF_ACCESS_CLIENT_SECRET', $accessSecret, 'Process')
  }

  if ($envToken) {
    $env:TRINITY_MCP_TOKEN = $envToken
    $env:TRINITY_MCP_API_KEY = $envToken
  } elseif (Test-Path -LiteralPath $credentialPath) {
    $protected = (Get-Content -LiteralPath $credentialPath -Raw).Trim()
    $secure = ConvertTo-SecureString $protected
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $tokenVal = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    $env:TRINITY_MCP_TOKEN = $tokenVal
    $env:TRINITY_MCP_API_KEY = $tokenVal
  } else {
    throw "Trinity MCP credential missing: Neither '$accessEnvPath' (TRINITY_MCP_API_KEY) nor '$credentialPath' exists."
  }

  if ($Origin) {
    $env:TRINITY_MCP_URL = $Origin
  } elseif (-not $env:TRINITY_MCP_URL) {
    $env:TRINITY_MCP_URL = 'https://auru.space'
  }

  Set-Location $root
  node scripts/trinity-codex-mcp.mjs
} finally {
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  foreach ($name in $managedEnvironmentNames) {
    $originalValue = $originalEnvironment[$name]
    if ($null -eq $originalValue) {
      Remove-Item -LiteralPath "Env:\$name" -ErrorAction SilentlyContinue
    } else {
      [Environment]::SetEnvironmentVariable($name, $originalValue, 'Process')
    }
  }
}
