@echo off
setlocal

cd /d "%~dp0"
title Shallow Regrets - Offline Launcher

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js and put node on PATH.
  echo.
  pause
  exit /b 1
)

echo [1/2] Building offline version into dist\index.html ...
echo First run may take a while.
call npm run build
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed. Run  npm install  in the project folder first.
  echo.
  pause
  exit /b 1
)

echo.
echo [2/2] Build done. Opening the game ...
start "" "%cd%\dist\index.html"

echo.
echo Offline modes: M1 Local  /  M2 vs AI  /  M4 Spectate  /  M5 Solo
echo For online mode M3, run the online launcher bat in the same folder.
echo.
pause
endlocal