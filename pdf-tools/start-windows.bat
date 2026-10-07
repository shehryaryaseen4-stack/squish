@echo off
title PDFKaro
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nahi mila. https://nodejs.org se LTS install karen, phir dobara chalayen.
  start https://nodejs.org
  pause
  exit /b
)
if not exist node_modules (
  echo Pehli dafa: zaroori files install ho rahi hain...
  call npm install
)
echo PDFKaro chal raha hai: http://localhost:3000  (band karne ke liye ye window band karen)
start "" http://localhost:3000
node server.js
pause
