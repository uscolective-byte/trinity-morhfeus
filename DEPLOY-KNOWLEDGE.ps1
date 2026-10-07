$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
function Run-Step([string]$Directory, [string[]]$Arguments) {
  Push-Location $Directory
  try { & npm @Arguments; if ($LASTEXITCODE -ne 0) { throw "npm failed in $Directory" } }
  finally { Pop-Location }
}
Run-Step 'Capacity-Worker' @('ci','--ignore-scripts')
Run-Step 'Capacity-Worker' @('test')
Run-Step 'Knowledge-Worker' @('ci','--ignore-scripts')
Run-Step 'Knowledge-Worker' @('test')
Run-Step 'Trinity' @('ci','--ignore-scripts')
Run-Step 'Trinity' @('test')
Push-Location 'Trinity'
try {
  & npx wrangler deploy --config wrangler.knowledge.jsonc --dry-run --outdir dist-knowledge
  if ($LASTEXITCODE -ne 0) { throw 'Extension build failed' }
  & node --test tests/knowledge.integration.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Integration tests failed' }
} finally { Pop-Location }
# Requires prior `npx wrangler login`. Never paste credentials into this file.
Push-Location 'Capacity-Worker'
try { & npx wrangler deploy; if ($LASTEXITCODE -ne 0) { throw 'Capacity deployment failed' } }
finally { Pop-Location }
Push-Location 'Knowledge-Worker'
try { & npx wrangler deploy; if ($LASTEXITCODE -ne 0) { throw 'Knowledge deployment failed' } }
finally { Pop-Location }
Push-Location 'Trinity'
try {
  & npx wrangler d1 execute DB --remote --file migrations/0023_personality_continuity.sql
  if ($LASTEXITCODE -ne 0) { throw 'Profile migration failed' }
  & npx wrangler deploy --config wrangler.knowledge.jsonc
  if ($LASTEXITCODE -ne 0) { throw 'Trinity deployment failed' }
} finally { Pop-Location }
