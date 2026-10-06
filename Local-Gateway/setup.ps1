$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$credentials = Join-Path $root '.credentials'
New-Item -ItemType Directory -Path $credentials -Force | Out-Null
function New-ProtectedToken([string]$target) {
  if (Test-Path -LiteralPath $target) { return }
  $bytes = New-Object byte[] 48
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  }
  finally {
    $generator.Dispose()
  }
  $plain = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
  $secure = ConvertTo-SecureString $plain -AsPlainText -Force
  $secure | ConvertFrom-SecureString | Set-Content -LiteralPath $target -Encoding UTF8 -NoNewline
  $plain = $null
}
New-ProtectedToken (Join-Path $credentials 'local-token.dpapi')
Write-Host 'Trinity Local Gateway je pripravená. Lokálny prístupový token je chránený účtom Windows.'
