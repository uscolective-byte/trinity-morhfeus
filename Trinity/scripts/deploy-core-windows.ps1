[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-f0-9]{40}$')]
    [string]$Commit,
    [switch]$DeployProduction
)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program failed with exit code $LASTEXITCODE. Deployment stopped."
    }
}
foreach ($program in @('node', 'npm.cmd', 'npx.cmd')) {
    if (-not (Get-Command $program -ErrorAction SilentlyContinue)) {
        throw "Required executable is missing: $program"
    }
}
# The caller must supply the exact SHA of this checkout. Do not label unknown code.
$repo = Split-Path -Parent $project
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is required to verify the checkout SHA and clean working tree.'
}
Push-Location $repo
try {
    $head = (& git rev-parse HEAD)
    if ($LASTEXITCODE -ne 0 -or $head.Trim() -ne $Commit) {
        throw 'Checkout HEAD does not match -Commit.'
    }
    $dirty = (& git status --porcelain)
    if ($LASTEXITCODE -ne 0 -or $dirty) {
        throw 'Checkout must be clean before deployment.'
    }
} finally { Pop-Location }
Push-Location $project
try {
    Invoke-Checked -Program 'npx.cmd' -Arguments @('wrangler','whoami')
    Invoke-Checked -Program 'npm.cmd' -Arguments @('ci')
    Invoke-Checked -Program 'npm.cmd' -Arguments @('test')
    Invoke-Checked -Program 'npx.cmd' -Arguments @('wrangler','d1','migrations','apply','trinity-development','--remote','--env','development')
    Invoke-Checked -Program 'npm.cmd' -Arguments @('run','deploy:development','--','--tag',$Commit)
    Invoke-Checked -Program 'node' -Arguments @('scripts/verify-deployment.mjs','https://auru.dev',$Commit)
    if ($DeployProduction) {
        Invoke-Checked -Program 'npx.cmd' -Arguments @('wrangler','d1','migrations','apply','trinity-v03','--remote','--env=')
        Invoke-Checked -Program 'npm.cmd' -Arguments @('run','deploy','--','--tag',$Commit)
        Invoke-Checked -Program 'node' -Arguments @('scripts/verify-deployment.mjs','https://auru.space',$Commit)
    }
    Write-Host 'Core deployment and readiness checks completed.' -ForegroundColor Green
} finally { Pop-Location }
