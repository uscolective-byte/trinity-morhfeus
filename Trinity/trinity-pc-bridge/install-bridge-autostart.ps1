# ═══════════════════════════════════════════════
# Trinity PC Bridge — Auto-start pri prihlásení
# Spusti raz ako administrátor:
#   powershell -File "install-bridge-autostart.ps1"
# ═══════════════════════════════════════════════

param(
  [string]$BridgePath = $PSScriptRoot,
  [switch]$Remove
)

$TaskName    = "TrinityPCBridge"
$Description = "Trinity AI — Lokálny PC Bridge (NextGen)"
$NodePath    = (Get-Command acnode -ErrorAction SilentlyContinue)
$ScriptPath  = Join-Path $BridgePath "bridge.mjs"

if ($Remove) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "✓ Task '$TaskName' odstránený." -ForegroundColor Green
  exit 0
}

if (-not $NodePath) {
  Write-Error "Node.js nie je nainštalovaný alebo nie je v PATH."
  exit 1
}
if (-not (Test-Path $ScriptPath)) {
  Write-Error "bridge.mjs neexistuje: $ScriptPath"
  exit 1
}

# Vytvor akciu
$Action = New-ScheduledTaskAction `
  -Execute $NodePath `
  -Argument "--experimental-vm-modules `"$ScriptPath`"" `
  -WorkingDirectory $BridgePath

# Spusti pri prihlásení + delay 30s (čaká na sieť)
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Trigger.Delay = "PT30S"

# Nastavenia
$Settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit 0 `
  -RestartCount 5 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable

# Registrácia
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Limited -LogonType Interactive
Register-ScheduledTask `
  -TaskName    $TaskName `
  -Description $Description `
  -Action      $Action `
  -Trigger     $Trigger `
  -Settings    $Settings `
  -Principal   $Principal `
  -Force | Out-Null

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Trinity PC Bridge — Auto-start nainštalovaný" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Task: $TaskName"
Write-Host "  Script: $ScriptPath"
Write-Host "  Spustí sa pri každom prihlásení (delay 30s)"
Write-Host ""
Write-Host "  Príkazy:" -ForegroundColor Yellow
Write-Host "    Spustiť:   Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "    Zastaviť:  Stop-ScheduledTask  -TaskName '$TaskName'"
Write-Host "    Odstrániť: .\install-bridge-autostart.ps1 -Remove"
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✓ Hotovo. Most sa automaticky spustí pri ďalšom prihlásení." -ForegroundColor Green

# Spustíme hneď
$response = Read-Host "Spustiť most teraz? (y/n)"
if ($response -eq 'y') {
  Start-ScheduledTask -TaskName $TaskName
  Write-Host "✓ Most spustený." -ForegroundColor Green
}
