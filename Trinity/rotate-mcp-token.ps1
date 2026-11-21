# Trinity — Bezpečná rotácia MCP Tokenu (Zneškodnenie starého + Vytvorenie nového)
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     TRINITY — ROTÁCIA A ZNEŠKODNENIE MCP TOKENU          " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vygenerovanie 32 bajtov kryptografickej náhodnosti
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$material = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
$newSecret = "trn_live_$material"

# 2. SHA-256 hash pre D1 databázu
$sha = [Security.Cryptography.SHA256]::Create()
try { $digest = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($newSecret)) } finally { $sha.Dispose() }
$newHash = -join ($digest | ForEach-Object { $_.ToString('x2') })

$id = [Guid]::NewGuid().ToString()
$newPrefix = $newSecret.Substring(0, 17)
$owner = 'saboivan2008@gmail.com'
$expires = [DateTimeOffset]::UtcNow.AddDays(180).ToString('yyyy-MM-dd HH:mm:ss')

# 3. SQL príkazy: zneškodnenie starého tokenu a vloženie nového
$sqlRevoke = "UPDATE ops_api_access_keys SET status='revoked', revoked_at=datetime('now') WHERE key_prefix='trn_live_S9ec0ut_' OR status='active' AND name LIKE '%MCP%';"
$sqlInsert = "INSERT INTO ops_api_access_keys(id, owner_id, name, key_hash, key_prefix, scopes_json, rate_limit_per_minute, status, expires_at) VALUES('$id', '$owner', 'Production Live MCP Key (Rotated)', '$newHash', '$newPrefix', json_array('mcp:read','mcp:write','api:invoke'), 120, 'active', '$expires');"
$fullSql = "$sqlRevoke $sqlInsert"

Write-Host "[1/2] Zneškodňujem starý token a aktivujem nový v D1 (trinity-v03)..." -ForegroundColor Yellow

Push-Location $root
try {
    $out = & npx.cmd wrangler d1 execute trinity-v03 --remote --command $fullSql 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Chyba pri zápise do D1:" -ForegroundColor Red
        Write-Host $out
        exit 1
    }
    Write-Host "  ✓ Starý token bol okamžite zneškodnený (status: revoked)." -ForegroundColor Green
    Write-Host "  ✓ Nový token bol aktivovaný v D1 databáze." -ForegroundColor Green
} finally {
    Pop-Location
}

# Uloženie do DPAPI
$credentialDir = Join-Path $root '.credentials'
New-Item -ItemType Directory -Path $credentialDir -Force | Out-Null
$protected = ConvertFrom-SecureString (ConvertTo-SecureString $newSecret -AsPlainText -Force)
Set-Content -LiteralPath (Join-Path $credentialDir "gemini-mcp.dpapi") -Value $protected -NoNewline

Write-Host ""
Write-Host "[2/2] TVOJ NOVÝ BEZPEČNÝ MCP KONFIGURAČNÝ BLOK:" -ForegroundColor Cyan
Write-Host "----------------------------------------------------------" -ForegroundColor Gray
$configJson = @"
{
  "mcpServers": {
    "trinity": {
      "serverUrl": "https://auru.space/mcp",
      "headers": {
        "Authorization": "Bearer $newSecret"
      }
    }
  }
}
"@
Write-Host $configJson -ForegroundColor White
Write-Host "----------------------------------------------------------" -ForegroundColor Gray
Write-Host "Tento nový konfiguračný blok vlož do svojho MCP klienta." -ForegroundColor Green
Write-Host "Starý token z chatu je od tejto sekundy mŕtvy a nefunkčný." -ForegroundColor Green
Write-Host ""
