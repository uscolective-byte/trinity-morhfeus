@echo off
title Trinity PC Bridge Daemon
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Trinity-PC-Bridge.ps1"
pause
