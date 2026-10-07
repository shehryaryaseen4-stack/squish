@echo off
title PDFKaro
cd /d "%~dp0"
echo.
echo ===============================
echo   PDFKaro - local start
echo ===============================
echo Folder: %CD%
echo.
if not exist "package.json" goto nozip
where node >nul 2>nul
if errorlevel 1 goto nonode
echo Node.js mil gaya:
node -v
if exist "node_modules\express" goto run
echo.
echo Pehli dafa zaroori files install ho rahi hain, 1-2 minute lagenge...
call npm install
if errorlevel 1 goto noinstall
:run
echo.
echo Browser 3 second mein khul jayega: http://localhost:3000
echo Band karne ke liye ye kaali window band kar den.
echo.
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
node server.js
echo.
echo Server band ho gaya. Upar wala error screenshot kar ke bhej den.
pause
exit /b
:nozip
echo GALTI: Ye file ZIP ke andar se chalayi gayi hai, ya pdf-tools folder mein nahi hai.
echo ZIP par right-click kar ke "Extract All" karen, phir extract hue folder ke
echo andar pdf-tools folder mein start-windows.bat chalayen.
pause
exit /b
:nonode
echo GALTI: Node.js install nahi hai.
echo https://nodejs.org se LTS version install karen, computer restart karen,
echo phir ye file dobara chalayen.
start "" https://nodejs.org
pause
exit /b
:noinstall
echo GALTI: npm install nahi ho saka. Internet check karen aur dobara chalayen.
echo Upar wala error screenshot kar ke bhej den.
pause
exit /b
