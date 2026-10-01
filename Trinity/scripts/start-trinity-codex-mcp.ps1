$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$protected = (Get-Content -LiteralPath (Join-Path $root '.credentials\access.dpapi') -Raw).Trim()
$secure = ConvertTo-SecureString $protected
$ptr = [IntPtr]::Zero
try {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $env:TRINITY_MCP_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $env:TRINITY_MCP_URL = 'https://auru.dev'
  Set-Location $root
  node scripts/trinity-codex-mcp.mjs
} finally {
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  Remove-Item Env:\TRINITY_MCP_TOKEN -ErrorAction SilentlyContinue
}
