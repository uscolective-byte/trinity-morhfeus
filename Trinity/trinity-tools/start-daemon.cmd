@echo off
title Trinity PC Bridge Daemon
cd /d "%~dp0"
echo ========================================================
echo   TRINITY PC BRIDGE DAEMON (PORT 7777)
echo ========================================================
echo Spustam PC Bridge pre prepojenie s Trinity Workerom...
node pc-bridge-daemon.js
pause
