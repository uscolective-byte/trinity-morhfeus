@echo off
chcp 65001 >nul
title TRINITY COMMAND CENTER
cls
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\trinity-command-center.ps1" %*
