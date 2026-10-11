[CmdletBinding()]
param(
  [ValidateSet('chatgpt', 'gemini', 'copilot', 'notion')]
  [string[]]$Clients = @('chatgpt', 'gemini', 'copilot', 'notion')
)

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Run this script on your Windows PC. Credentials use Windows DPAPI.' }
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$configPath = Join-Path $root 'wrangler.jsonc'
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$db = @($config.d1_databases | Where-Object { $_.binding -eq 'DB' })
if ($config.account_id -ne 'b60342e5e52f5646fbd4e913bb409334' -or $db.Count -ne 1 -or $db[0].database_id -ne 'ca8ea24e-f7db-431e-b8bf-97f713ae4533') {
  throw 'Unexpected Cloudflare account or database. Nothing was provisioned.'
}
$credentialDir = Join-Path $root '.credentials'
New-Item -ItemType Directory -Path $credentialDir -Force | Out-Null
$names = @{
  chatgpt = 'ChatGPT MCP Project'
  gemini = 'Gemini MCP Bridge'
  copilot = 'Copilot MCP Project'
  notion = 'Notion AI MCP Project'
}

Push-Location $root
try {
  foreach ($client in ($Clients | Select-Object -Unique)) {
    $credentialPath = Join-Path $credentialDir "$client-mcp.dpapi"
    if (Test-Path -LiteralPath $credentialPath) {
      Write-Host "$client : existing local credential kept. No key rotation or permission change."
      continue
    }
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $secret = 'trn_live_' + [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $digest = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($secret)) } finally { $sha.Dispose() }
    $hash = -join ($digest | ForEach-Object { $_.ToString('x2') })
    $id = [Guid]::NewGuid().ToString()
    $prefix = $secret.Substring(0, 17)
    $name = $names[$client]
    $owner = 'saboivan2008@gmail.com'
    $expires = [DateTimeOffset]::UtcNow.AddDays(90).ToString('yyyy-MM-dd HH:mm:ss')
    $tempPath = Join-Path $credentialDir "$client-mcp.$id.tmp"
    $createdInD1 = $false
    try {
      $protected = ConvertFrom-SecureString (ConvertTo-SecureString $secret -AsPlainText -Force)
      [IO.File]::WriteAllText($tempPath, $protected, [Text.Encoding]::ASCII)
      $sql = "INSERT INTO ops_api_access_keys(id,owner_id,name,key_hash,key_prefix,scopes_json,rate_limit_per_minute,status,expires_at) VALUES('$id','$owner','$name','$hash','$prefix',json_array('mcp:read','mcp:write'),60,'active','$expires');"
      $wranglerOutput = & npx.cmd wrangler d1 execute trinity-v03 --remote --config wrangler.jsonc --command $sql 2>&1
      if ($LASTEXITCODE -ne 0) { throw 'Cloudflare refused credential provisioning. Check Wrangler login and account access.' }
      $createdInD1 = $true
      Move-Item -LiteralPath $tempPath -Destination $credentialPath -ErrorAction Stop
      Write-Host "$client : separate project credential created, encrypted with Windows DPAPI, valid for 90 days."
    } catch {
      if ($createdInD1) {
        $revokeSQL = "UPDATE ops_api_access_keys SET status='revoked',revoked_at=datetime('now') WHERE id='$id' AND owner_id='$owner';"
        try {
          $revokeOutput = & npx.cmd wrangler d1 execute trinity-v03 --remote --config wrangler.jsonc --command $revokeSQL 2>&1
          if ($LASTEXITCODE -ne 0) { Write-Warning "Revoke the newly created credential ID $id in Trinity settings; local credential storage failed." }
        } catch { Write-Warning "Revoke the newly created credential ID $id in Trinity settings; local credential storage failed." }
      }
      throw
    } finally {
      if (Test-Path -LiteralPath $tempPath) { Remove-Item -LiteralPath $tempPath -Force }
      $secret = $null
      $protected = $null
      [Array]::Clear($bytes, 0, $bytes.Length)
    }
  }
  Write-Host 'Project MCP scope: read + write. Existing login, PC allowlists and sensitive-action approval are unchanged.'
  Write-Host 'Endpoint: https://auru.space/mcp'
  Write-Host 'No token values were printed. Client connection/discovery must still be completed separately.'
} finally { Pop-Location }
