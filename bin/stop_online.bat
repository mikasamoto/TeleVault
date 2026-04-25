@echo off
title TeleVault - Stop Online Mode
echo ---------------------------------------------------
echo TeleVault - Stopping Online Mode...
echo ---------------------------------------------------
echo.

:: Move to parent directory
cd /d "%~dp0.."

REM 1. Stop the Node.js server
echo [1/2] Stopping Node.js server...
taskkill /f /fi "windowtitle eq TeleVault Server" /t >nul 2>&1

REM 2. Stop the Cloudflare Tunnel
echo [2/2] Stopping Cloudflare Tunnel...
taskkill /f /im cloudflared.exe /t >nul 2>&1

echo.
echo ---------------------------------------------------
echo ✅ SUCCESS! All online processes have been stopped.
echo ---------------------------------------------------
echo.
pause
