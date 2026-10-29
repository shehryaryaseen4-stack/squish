@echo off
rem Runs the gym app on this laptop for the gym's own WiFi: the dashboard, the
rem members' phones and the fingerprint/face machine all connect to this laptop.
rem No internet needed. Keep this window open while the gym is open.
title Gym server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed on this laptop.
  echo  Download the LTS version from https://nodejs.org , install it, then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0data" mkdir "%~dp0data"
set PORT=3100
set SEED=empty
set DATA_FILE=%~dp0data\db.json

echo.
echo  ==============================================================
echo   GYM SERVER IS STARTING  -  keep this window open
echo  ==============================================================
echo.
echo   On this laptop:   http://localhost:3100/admin
echo.
powershell -NoProfile -Command "$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } | Select-Object -ExpandProperty IPAddress; foreach ($ip in $ips) { Write-Host ('  Members'' phones (same WiFi):  http://' + $ip + ':3100'); Write-Host ('  Fingerprint/face machine:     Server IP ' + $ip + '   Port 3100   HTTPS off'); Write-Host '' }"
echo   First time: owner PIN 1234, front desk PIN 0000 (change them in Settings).
echo   If Windows asks about the firewall, tick "Private networks" and press Allow.
echo.

start "" "http://localhost:3100/admin"
node server.js
echo.
echo  The gym server stopped. Close this window, or press a key to start it again.
pause >nul
goto :eof
