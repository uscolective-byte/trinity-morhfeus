@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Local-Gateway\Start-TrinityAgent.ps1" %*
exit /b %errorlevel%
