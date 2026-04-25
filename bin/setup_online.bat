@echo off
title TeleVault - Online Setup
echo ---------------------------------------------------
echo 📦 Downloading Cloudflare Sharing Tool...
echo ---------------------------------------------------
echo.

:: Move to parent directory
cd /d "%~dp0.."

:: Use curl to download the standalone exe
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -o cloudflared.exe

if %errorlevel% neq 0 (
    echo.
    echo ❌ ERROR: Download failed. Please check your internet connection.
    pause
    exit /b
)

echo.
echo ✅ Done! 'cloudflared.exe' downloaded successfully.
echo.
echo You can now run 'share_online.bat' to create your public link.
echo.
pause
