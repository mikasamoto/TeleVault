@echo off
setlocal enabledelayedexpansion
title TeleVault Online Manager
echo ---------------------------------------------------
echo TeleVault - Professional Online Mode
echo ---------------------------------------------------
echo.

:: Move to parent directory
cd /d "%~dp0.."

REM 1. Cleanup old processes and logs
echo [0/3] Cleaning up old sessions...
taskkill /f /fi "windowtitle eq TeleVault Server" /t >nul 2>&1
taskkill /f /im cloudflared.exe /t >nul 2>&1
timeout /t 2 /nobreak >nul

if exist tunnel.log del /f /q tunnel.log
if exist server.log del /f /q server.log
if exist url_found.txt del /f /q url_found.txt

REM 2. Check for cloudflared
set CLOUD_CMD=cloudflared
if exist cloudflared.exe set CLOUD_CMD=cloudflared.exe
where %CLOUD_CMD% >nul 2>&1
if %errorlevel% neq 0 (
    if not exist cloudflared.exe (
        echo [ERROR] cloudflared not found. Run 'setup_online.bat' first.
        pause
        exit /b
    )
)

REM 3. Start Node.js server and log output
echo [1/3] Starting TeleVault Server (Port 3000)...
start /min "TeleVault Server" cmd /c "node index.js > server.log 2>&1"
timeout /t 5 /nobreak >nul

REM 4. Start Cloudflare Tunnel in background (Connecting to Port 3000)
echo [2/3] Starting Secure Tunnel...
start /b "" %CLOUD_CMD% tunnel --url http://127.0.0.1:3000 > tunnel.log 2>&1

echo [3/3] Generating your public link...
echo (This usually takes 5-10 seconds)
echo.

REM 5. Loop until URL is found in the log file
:WAIT_LOOP
timeout /t 1 /nobreak >nul
findstr /C:".trycloudflare.com" tunnel.log > url_found.txt
if %errorlevel% neq 0 goto :WAIT_LOOP

REM 6. Extract the URL from the log line
set "FINAL_URL=PENDING..."
for /f "tokens=1-10" %%a in (url_found.txt) do (
    for %%i in (%%a %%b %%c %%d %%e %%f %%g %%h %%i %%j) do (
        echo %%i | findstr "trycloudflare.com" > nul
        if !errorlevel! equ 0 set "FINAL_URL=%%i"
    )
)

REM Final Cleanup of the URL string
set "FINAL_URL=!FINAL_URL:|=!"
set "FINAL_URL=!FINAL_URL: =!"

echo ---------------------------------------------------
echo ✅ SUCCESS! TeleVault is now online.
echo.
echo 🌍 YOUR PUBLIC URL:
echo !FINAL_URL!
echo ---------------------------------------------------
echo.
echo NOTE: Keep this window OPEN to keep the link active.
echo To stop everything, just close this window.
echo ---------------------------------------------------

pause >nul
