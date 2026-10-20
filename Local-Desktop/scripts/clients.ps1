$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$node=Join-Path $root 'runtime\node.exe'
$entry=@{command=$node;args=@((Join-Path $root 'scripts\mcp-stdio.mjs'))}
function Merge-Server([string]$File,[string]$Section){
 $config=if(Test-Path -LiteralPath $File){Get-Content -LiteralPath $File -Raw|ConvertFrom-Json}else{[pscustomobject]@{}}
 if(-not $config.PSObject.Properties[$Section]){$config|Add-Member -NotePropertyName $Section -NotePropertyValue ([pscustomobject]@{})}
 $config.$Section|Add-Member -NotePropertyName 'trinity-local' -NotePropertyValue $entry -Force
 New-Item -ItemType Directory -Force -Path (Split-Path $File)|Out-Null
 if(Test-Path -LiteralPath $File){Copy-Item -LiteralPath $File -Destination ($File+'.backup-'+[Guid]::NewGuid().ToString('N'))}
 [IO.File]::WriteAllText($File,($config|ConvertTo-Json -Depth 40),[Text.UTF8Encoding]::new($false))
}
Merge-Server (Join-Path $root '.gemini\settings.json') 'mcpServers'
Merge-Server (Join-Path $root '.mcp.json') 'mcpServers'
Write-Host 'Projektove MCP konfiguracie pre Gemini CLI a GitHub Copilot su pripravene.'
Write-Host 'Otvor tento priecinok v klientovi a prihlas sa do svojho uctu. Trinity musi bezat.'
Write-Host 'Zapis cez MCP zapnes v Trinity -> Prepojenia. Prihlasenie a instalacia klientov su samostatne.'
