@echo off
rem Starts the gym server by itself whenever this laptop is switched on (run once).
rem To stop that, delete "gym-server.bat" from the Startup folder (Win+R, shell:startup).
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
(echo @echo off& echo start "Gym server" /min "%~dp0start-gym.bat") > "%STARTUP%\gym-server.bat"
echo The gym server will now start when this laptop starts.
pause
