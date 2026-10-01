$ErrorActionPreference = 'Stop'
Unregister-ScheduledTask -TaskName 'Trinity Local Gateway' -Confirm:$false -ErrorAction SilentlyContinue
Write-Output 'Automatické spúšťanie Trinity Local Gateway bolo odstránené.'
