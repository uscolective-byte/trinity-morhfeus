[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('chatgpt', 'gemini', 'copilot', 'notion')]
  [string]$Client,
  [switch]$HeaderValue
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This command requires Windows DPAPI and the Windows clipboard.' }
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$credentialPath = Join-Path $root ".credentials\$Client-mcp.dpapi"
if (-not (Test-Path -LiteralPath $credentialPath)) { throw 'Client credential is not provisioned.' }
$protected = (Get-Content -LiteralPath $credentialPath -Raw).Trim()
$secure = ConvertTo-SecureString $protected
$ptr = [IntPtr]::Zero
try {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  if (-not $plain.StartsWith('trn_live_') -or $plain.Length -lt 40) { throw 'Unexpected credential format.' }
  if ($HeaderValue) { Set-Clipboard -Value "Bearer $plain" } else { Set-Clipboard -Value $plain }
  Write-Host "$Client : credential copied to clipboard without printing it. Paste only into the private authentication field, never into chat."
} finally {
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  $plain = $null
}
