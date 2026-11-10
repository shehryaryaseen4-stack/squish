#!/usr/bin/env bash
# Builds GymApp-Windows.zip: the gym app with its own Node.js, for one gym on a
# Windows laptop on the gym's WiFi. Unzip anywhere and double-click "Start Gym.bat".
#
#   scripts/build-windows-zip.sh OUT_DIR [NODE_VERSION]
#
# Node.js comes from nodejs.org and is checked against its SHA-256 list.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mkdir -p "${1:?usage: build-windows-zip.sh OUT_DIR [NODE_VERSION]}" && cd "$1" && pwd)"
NODE="${2:-v22.23.3}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Node.js $NODE for Windows"
curl -fsSL -o "$WORK/node.zip" "https://nodejs.org/dist/$NODE/node-$NODE-win-x64.zip"
curl -fsSL -o "$WORK/SHASUMS256.txt" "https://nodejs.org/dist/$NODE/SHASUMS256.txt"
(cd "$WORK" && grep " node-$NODE-win-x64.zip\$" SHASUMS256.txt | sed "s/node-$NODE-win-x64.zip/node.zip/" | sha256sum -c -)
unzip -q -j "$WORK/node.zip" "node-$NODE-win-x64/node.exe" "node-$NODE-win-x64/LICENSE" -d "$WORK/node"

APP="$WORK/GymApp"
mkdir -p "$APP/node" "$APP/app"
cp "$WORK/node/node.exe" "$APP/node/"
cp "$ROOT/scripts/windows/gym.ico" "$APP/gym.ico"
cp "$WORK/node/LICENSE" "$APP/node/LICENSE-nodejs.txt"
cp -r "$ROOT/server.js" "$ROOT/package.json" "$ROOT/lib" "$ROOT/public" "$ROOT/seed" "$APP/app/"

crlf() { sed 's/$/\r/'; }
crlf > "$APP/Start Gym.bat" <<'BAT'
@echo off
rem Starts the gym app on this computer. Keep this window open while the gym is open.
title Gym app
cd /d "%~dp0"
if not exist "%~dp0data" mkdir "%~dp0data"
set PORT=3100
set SEED=empty
set DATA_FILE=%~dp0data\db.json
echo.
echo  ==============================================================
echo   GYM APP IS RUNNING  -  keep this window open
echo  ==============================================================
echo.
echo   On this computer:   http://localhost:3100/admin
echo.
powershell -NoProfile -Command "$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' } | Select-Object -ExpandProperty IPAddress; foreach ($ip in $ips) { Write-Host ('  Members'' phones (same WiFi):  http://' + $ip + ':3100'); Write-Host ('  Fingerprint/face machine:     Server IP ' + $ip + '   Port 3100   HTTPS off'); Write-Host '' }"
echo   First time: owner PIN 1234, front desk PIN 0000 (change them in Settings).
echo   If Windows asks about the firewall, tick "Private networks" and press Allow.
echo.
if /i not "%~1"=="nobrowser" start "" "http://localhost:3100/admin"
"%~dp0node\node.exe" "%~dp0app\server.js"
echo.
echo  The gym app stopped. Press a key to close this window.
pause >nul
BAT

crlf > "$APP/Open Gym.bat" <<'BAT'
@echo off
rem What the "Gym Dashboard" icon runs: starts the gym app if it isn't running
rem (in a small window on the taskbar), then opens the dashboard in the browser.
rem No ( ) blocks here: the folder name may itself contain brackets, e.g. "GymApp (1)".
cd /d "%~dp0"
call :running
if not errorlevel 1 goto open
start "Gym app - keep open" /min "%~dp0Start Gym.bat" nobrowser
set /a tries=0
:wait
timeout /t 1 /nobreak >nul
call :running
if not errorlevel 1 goto open
set /a tries+=1
if %tries% lss 40 goto wait
:open
start "" "http://localhost:3100/admin"
exit /b
:running
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:3100/api/gym | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
exit /b %errorlevel%
BAT

crlf > "$APP/Setup - run once.bat" <<'BAT'
@echo off
rem One-time setup: lets Windows run these files, puts a "Gym Dashboard" icon on the
rem desktop, and (if you want) starts the gym app whenever this computer starts.
title Gym app setup
cd /d "%~dp0"
echo.
echo  Setting up the gym app in: "%~dp0"
echo.
powershell -NoProfile -Command "Get-ChildItem -LiteralPath '%~dp0' -Recurse | Unblock-File" >nul 2>nul
echo  [1/3] Files unblocked.
powershell -NoProfile -Command "$f='%~dp0'; $d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'Gym Dashboard.lnk')); $s.TargetPath=(Join-Path $f 'Open Gym.bat'); $s.WorkingDirectory=$f; $s.IconLocation=(Join-Path $f 'gym.ico'); $s.WindowStyle=7; $s.Description='Open the gym dashboard'; $s.Save()"
if errorlevel 1 goto noicon
echo  [2/3] "Gym Dashboard" icon added to the desktop.
goto boot
:noicon
echo  [2/3] Could not make the desktop icon. Right-click "Open Gym.bat", Send to, Desktop.
:boot
echo.
choice /c YN /m "  Start the gym app by itself when this computer starts"
if errorlevel 2 goto done
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
> "%STARTUP%\gym-app.bat" echo @echo off
>> "%STARTUP%\gym-app.bat" echo start "Gym app - keep open" /min "%~dp0Start Gym.bat" nobrowser
echo  [3/3] The gym app will start with Windows.
:done
echo.
echo  Done. From now on just double-click "Gym Dashboard" on the desktop.
echo.
pause
BAT

crlf > "$APP/Start Gym when PC starts.bat" <<'BAT'
@echo off
rem Run once: the gym app then starts by itself whenever this computer starts.
rem To undo: Win+R, type shell:startup, delete "gym-app.bat".
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
> "%STARTUP%\gym-app.bat" echo @echo off
>> "%STARTUP%\gym-app.bat" echo start "Gym app - keep open" /min "%~dp0Start Gym.bat" nobrowser
echo Done. The gym app will start when this computer starts.
pause
BAT

crlf > "$APP/Backup data.bat" <<'BAT'
@echo off
rem Copies the gym's data (members, fees, attendance, photos) to a dated folder in "backups".
cd /d "%~dp0"
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set STAMP=%%d
if not exist data ( echo No data yet. & pause & exit /b )
xcopy /e /i /q /y data "backups\%STAMP%" >nul
echo Backup saved in backups\%STAMP%
echo Copy the "backups" folder to a USB drive or Google Drive now and then.
pause
BAT

crlf > "$APP/README.txt" <<'TXT'
GYM APP - for one gym on this computer (no internet needed)
============================================================

FIRST TIME
  Double-click "Setup - run once.bat". It puts a "Gym Dashboard" icon on the
  desktop (and can start the app with Windows).

EVERY DAY
  Double-click "Gym Dashboard" on the desktop. It starts the app if needed
  (a small "Gym app - keep open" window on the taskbar: don't close it) and
  opens the dashboard in the browser.

START BY HAND
  Double-click "Start Gym.bat". A black window opens: keep it open.
  The dashboard opens in the browser. First time: owner PIN 1234,
  front desk PIN 0000. Change them, the gym name and the logo in Settings.
  If Windows asks about the firewall: tick "Private networks", press Allow.

MEMBERS' PHONES (on the gym WiFi)
  Open the address shown in the black window, e.g. http://192.168.1.5:3100

FINGERPRINT / FACE MACHINE
  Dashboard > Settings > Fingerprint & face machines > Add machine.
  Enter the IP and port it shows in the machine: COMM > Cloud Server Setting
  (HTTPS off). Then press Check.

KEEP IT WORKING
  - Give this computer a fixed IP in the router (DHCP reservation).
  - Power settings: never sleep when plugged in.
  - "Start Gym when PC starts.bat" (run once) starts the app with Windows.
  - "Backup data.bat" copies all data; keep copies on a USB or Google Drive.
  - All data is in the "data" folder. To move to a new computer, copy the
    whole GymApp folder.

URDU
  Pehli dafa "Setup - run once.bat" chalayein. Phir roz desktop par
  "Gym Dashboard" par double-click karein. Taskbar par "Gym app" wali
  chhoti window band na karein.
  Members ke phone gym ki WiFi par oopar wala address kholein.
  Data "data" folder mein hai, "Backup data.bat" se backup lein.
TXT

mkdir -p "$APP/data"
(cd "$WORK" && rm -f "$OUT/GymApp-Windows.zip" && zip -qr "$OUT/GymApp-Windows.zip" GymApp)
ls -la "$OUT/GymApp-Windows.zip"
