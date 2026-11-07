[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
  [ValidateSet('staging', 'production')]
  [string]$Target = 'staging',

  [switch]$Deploy
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot
$config = Join-Path $repoRoot 'wrangler.jsonc'
$trinityRoot = Join-Path $repoRoot 'Trinity'

function Invoke-Checked {
  param([Parameter(Mandatory)][string]$Label, [Parameter(Mandatory)][scriptblock]$Command)
  Write-Host "`n==> $Label" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
  }
}

foreach ($required in @(
  $config,
  (Join-Path $repoRoot 'src\index.ts'),
  (Join-Path $trinityRoot 'src\index.js'),
  (Join-Path $trinityRoot 'migrations'),
  (Join-Path $trinityRoot 'schema.sql')
)) {
  if (-not (Test-Path -LiteralPath $required)) {
    throw "Required Trinity source or configuration is missing: $required"
  }
}

$wrangler = Get-Command wrangler -ErrorAction SilentlyContinue
if (-not $wrangler) {
  throw 'Wrangler CLI is not available in PATH. Install Wrangler 4 and authenticate before running this script.'
}

Write-Host "Target: $Target" -ForegroundColor Green
Write-Host "Config: $config" -ForegroundColor Green
Write-Host 'Production deploy is never implicit. This run will test and build first.' -ForegroundColor Yellow

Invoke-Checked 'Local Desktop, Local Gateway and Tetrakis contract checks' {
  node --test 'Local-Desktop/tests/*.test.mjs' 'Local-Gateway/tests/*.test.mjs' 'scripts/verify-tetrakis.test.mjs'
}
Invoke-Checked 'Jericho Worker tests' { npm --prefix Jericho-Worker test }
Invoke-Checked 'Tetrakis contract compile and tests' { npm --prefix contracts/tetrakis test }
Invoke-Checked 'Build Trinity MCP application assets' {
  Push-Location $trinityRoot
  try { node scripts/build-mcp-app.mjs } finally { Pop-Location }
}

$wranglerArgs = @('deploy', '--dry-run', '--config', $config, '--outdir', (Join-Path $trinityRoot 'dist'))
if ($Target -eq 'staging') { $wranglerArgs += @('--env', 'staging') }
else { $wranglerArgs += @('--env', '') }
Invoke-Checked "Wrangler $Target dry-run build" { & $wrangler.Source @wranglerArgs }

Invoke-Checked 'Trinity full test suite' {
  Push-Location $trinityRoot
  try { node --test --test-concurrency=1 tests/*.test.mjs } finally { Pop-Location }
}

if ($Deploy) {
  $deployArgs = @('deploy', '--config', $config)
  if ($Target -eq 'staging') { $deployArgs += @('--env', 'staging') }
  else { $deployArgs += @('--env', '') }
  $shouldRun = $true
  if ($PSCmdlet) {
    try {
      $shouldRun = $PSCmdlet.ShouldProcess("Cloudflare Worker trinity ($Target)", 'Deploy verified source')
    } catch {
      $shouldRun = $true
    }
  }
  if ($shouldRun) {
    Invoke-Checked "Deploy Trinity to $Target" { & $wrangler.Source @deployArgs }
  }
} else {
  Write-Host "`nBuild and tests completed. No Cloudflare deployment was requested." -ForegroundColor Green
}
