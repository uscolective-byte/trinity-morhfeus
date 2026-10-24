@echo off
chcp 65001 >nul
title TRINITY INSTALL ALL & SETUP ENVIRONMENT
cls
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-all.ps1" %*
if errorlevel 1 (
  echo.
  echo [CHYBA] Inštalácia zlyhala. Stlačte ľubovoľnú klávesu...
  pause >nul
) else (
  echo.
  echo [HOTOVO] Inštalácia úspešná. Stlačte ľubovoľnú klávesu...
  pause >nul
)
