@echo off
setlocal

REM Optional persistent desktop shortcut for users who launch by double-click.
REM The shortcut points to a stable copy in the current user's AppData folder.
REM No administrator privileges, scheduled tasks, or startup registration.
set "DC_LAUNCH_SOURCE=%~f0"

REM Only skip the prompt if the existing shortcut still points to the valid saved launcher.
powershell.exe -NoProfile -Command "$folder=Join-Path $env:LOCALAPPDATA 'DesktopCommander\Remote'; $target=Join-Path $folder 'DesktopCommander-Remote.cmd'; $link=Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Desktop Commander Remote.lnk'; if((Test-Path -LiteralPath $target) -and (Test-Path -LiteralPath $link) -and ((New-Object -ComObject WScript.Shell).CreateShortcut($link).TargetPath -eq $target)){exit 0}else{exit 1}" >nul 2>&1
if not errorlevel 1 goto ensure_icon

echo.
echo Would you like to add Desktop Commander Remote to your desktop?
echo This creates a shortcut so you can launch it again without finding this download.
choice /C YN /N /M "Create desktop shortcut? [Y/N] "
if errorlevel 2 goto launch
if errorlevel 1 goto create_shortcut
goto launch

:create_shortcut
REM Copy the downloaded file to a stable, user-writable location, then create .lnk.
REM PowerShell reads paths from the environment to avoid CMD quoting issues.
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $folder=Join-Path $env:LOCALAPPDATA 'DesktopCommander\Remote'; $target=Join-Path $folder 'DesktopCommander-Remote.cmd'; $link=Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Desktop Commander Remote.lnk'; New-Item -ItemType Directory -Path $folder -Force | Out-Null; if($env:DC_LAUNCH_SOURCE -ne $target){Copy-Item -LiteralPath $env:DC_LAUNCH_SOURCE -Destination $target -Force}; $shortcut=(New-Object -ComObject WScript.Shell).CreateShortcut($link); $shortcut.TargetPath=$target; $shortcut.WorkingDirectory=$folder; $shortcut.Description='Start Desktop Commander Remote'; $shortcut.Save(); Write-Host 'Desktop shortcut created.'"
if errorlevel 1 (
    echo Could not create the desktop shortcut. You can still start Desktop Commander below.
    goto launch
)
goto ensure_icon

:ensure_icon
REM Use Desktop Commander's public PNG to create a local ICO (Windows shortcuts
REM require .ico or .exe, not a PNG). Existing links are upgraded without asking.
REM Icon download failures must never prevent the remote launcher from starting.
powershell.exe -NoProfile -Command "try { $ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Drawing; $folder=Join-Path $env:LOCALAPPDATA 'DesktopCommander\Remote'; $ico=Join-Path $folder 'DesktopCommander.ico'; $link=Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Desktop Commander Remote.lnk'; if(!(Test-Path -LiteralPath $ico)){ $url='https://raw.githubusercontent.com/wonderwhy-er/DesktopCommanderMCP/main/icon.png'; $client=New-Object System.Net.WebClient; $data=$client.DownloadData($url); if($data.Length -gt 1048576){throw 'Icon asset too large'}; $inputStream=New-Object System.IO.MemoryStream(,$data); $image=[System.Drawing.Image]::FromStream($inputStream); $bmp=New-Object System.Drawing.Bitmap(256,256); $g=[System.Drawing.Graphics]::FromImage($bmp); $g.DrawImage($image,0,0,256,256); $g.Dispose(); $pngStream=New-Object System.IO.MemoryStream; $bmp.Save($pngStream,[System.Drawing.Imaging.ImageFormat]::Png); $png=$pngStream.ToArray(); $pngStream.Dispose(); $bmp.Dispose(); $image.Dispose(); $inputStream.Dispose(); $header=[byte[]](0,0,1,0,1,0,0,0,0,0,1,0,32,0); $bytes=New-Object byte[] (22+$png.Length); [Array]::Copy($header,0,$bytes,0,14); [Array]::Copy([BitConverter]::GetBytes([int]$png.Length),0,$bytes,14,4); [Array]::Copy([BitConverter]::GetBytes([int]22),0,$bytes,18,4); [Array]::Copy($png,0,$bytes,22,$png.Length); [System.IO.File]::WriteAllBytes($ico,$bytes) }; if(Test-Path -LiteralPath $link){ $sc=(New-Object -ComObject WScript.Shell).CreateShortcut($link); if($sc.IconLocation -ne ($ico+',0')){ $sc.IconLocation=$ico+',0'; $sc.Save(); Write-Host 'Desktop Commander shortcut icon updated.' } } } catch { Write-Host 'Desktop icon unavailable; shortcut remains usable.' }"

:launch
REM Existing public PowerShell bootstrap: checks Node.js, asks before installing it,
REM and starts Remote Desktop Commander as the current user.
powershell.exe -NoProfile -Command "irm -ErrorAction Stop https://raw.githubusercontent.com/wonderwhy-er/DesktopCommanderMCP/main/scripts/remote/remote-windows.ps1 | iex"

REM Preserve the launcher exit status for callers.
exit /b %ERRORLEVEL%
