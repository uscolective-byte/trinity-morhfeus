[CmdletBinding()]
param([ValidateSet('desktop','doctor','start')][string]$Action='desktop',[string]$Message='')
$ErrorActionPreference='Stop'
$gateway=$PSScriptRoot
$repository=Split-Path -Parent $gateway
$node=(Get-Command node.exe -ErrorAction Stop).Source
if($Action -ne 'desktop') {
  $entry=Join-Path $gateway 'src/trinity123/cli.mjs'
  if($Message){& $node $entry $Action $Message}else{& $node $entry $Action}
  exit $LASTEXITCODE
}
$desktop=Join-Path $repository 'Local-Desktop'
$data=Join-Path $desktop 'Data'
$launchFile=Join-Path $data 'launch.json'
New-Item -ItemType Directory -Force -Path $data|Out-Null
function Select-Trinity($state) {
  $base='http://127.0.0.1:'+[int]$state.port
  $health=Invoke-RestMethod ($base+'/health') -TimeoutSec 3
  if($health.service -ne 'Trinity Local Desktop'){throw 'Na porte nebeží Trinity Local Desktop.'}
  $fragment=([Uri]$state.url).Fragment.TrimStart('#')
  $localToken=($fragment -split 'token=',2)[1]
  $headers=@{Authorization='Bearer '+$localToken}
  [void](Invoke-RestMethod ($base+'/api/connections') -Method Post -Headers $headers -ContentType 'application/json' -Body '{"provider":"trinity"}' -TimeoutSec 15)
  return $base
}
$state=$null
if(Test-Path -LiteralPath $launchFile){
  try{$candidate=Get-Content -Raw -LiteralPath $launchFile|ConvertFrom-Json;$base=Select-Trinity $candidate;$state=$candidate}catch{}
}
if(-not $state){
  $port=$null
  foreach($candidatePort in 8795..8805){$probe=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$candidatePort);try{$probe.Start();$port=$candidatePort;break}catch{}finally{$probe.Stop()}}
  if(-not $port){throw 'Nie je dostupný port pre lokálnu Trinity.'}
  $env:TRINITY_DESKTOP_PORT=[string]$port
  $process=Start-Process -FilePath $node -ArgumentList @(('"'+(Join-Path $desktop 'server.mjs')+'"')) -WorkingDirectory $desktop -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $data 'agent-server.log') -RedirectStandardError (Join-Path $data 'agent-error.log')
  for($attempt=0;$attempt -lt 60;$attempt++){
    Start-Sleep -Milliseconds 250
    $process.Refresh();if($process.HasExited){throw 'Lokálny chat sa zastavil; pozri Data/agent-error.log.'}
    if(Test-Path -LiteralPath $launchFile){$candidate=Get-Content -Raw -LiteralPath $launchFile|ConvertFrom-Json;if($candidate.pid -eq $process.Id){$base=Select-Trinity $candidate;$state=$candidate;break}}
  }
  if(-not $state){throw 'Lokálny chat nepotvrdil spustenie.'}
}
# The authentication fragment is consumed locally by the existing desktop UI.
Start-Process $state.url
Write-Output ('Trinity Local Desktop: '+$base+' (provider Trinity)')
