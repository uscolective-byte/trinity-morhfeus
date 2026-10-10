$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
function Run-Step([string]$Directory, [string]$Command, [string[]]$Arguments) {
 Push-Location $Directory
 try { & $Command @Arguments; if ($LASTEXITCODE -ne 0) { throw "$Command failed in $Directory" } }
 finally { Pop-Location }
}
Run-Step 'Trinity' 'npm' @('ci','--ignore-scripts')
Run-Step 'Knowledge-Worker' 'npm' @('ci','--ignore-scripts')
Run-Step 'Integrations-Worker' 'npm' @('ci','--ignore-scripts')
Run-Step 'Knowledge-Worker' 'npm' @('test')
Run-Step 'Integrations-Worker' 'npm' @('run','build')
Run-Step 'Trinity' 'npx' @('wrangler','deploy','--config','wrangler.integrations.jsonc','--dry-run','--outdir','dist-integrations')
Run-Step 'Trinity' 'node' @('--test','tests/integration-providers.test.mjs','tests/integrations.runtime.mjs')
# Authenticate Cloudflare and configure provider secrets before running production deployment.
Run-Step 'Knowledge-Worker' 'npx' @('wrangler','deploy')
Run-Step 'Integrations-Worker' 'npx' @('wrangler','deploy')
Run-Step 'Trinity' 'npx' @('wrangler','d1','execute','DB','--remote','--file','migrations/0023_personality_continuity.sql')
Run-Step 'Trinity' 'npx' @('wrangler','deploy','--config','wrangler.integrations.jsonc')
