@echo off
setlocal

cd /d "%~dp0"
title Shallow Regrets - Online Launcher M3

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js and put node on PATH.
  echo.
  pause
  exit /b 1
)

echo [1/3] Building latest build for online hosting ...
echo First run may take a while.
call npm run build
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed. Run  npm install  in the project folder first.
  echo.
  pause
  exit /b 1
)

rem Pick a free port: 3000, falling back to 3001-3005.
set PORT=3000
for %%P in (3000 3001 3002 3003 3004 3005) do (
  netstat -ano | findstr /r /c:":%%P .*LISTENING" >nul 2>nul
  if errorlevel 1 (set PORT=%%P & goto foundport)
)
:foundport

echo.
echo [2/3] Starting online server on port %PORT% ...
start "Shallow Regrets Server" cmd /k "set PORT=%PORT%&&npm run serve"
timeout /t 2 /nobreak >nul

echo [3/3] Opening page ...
start "" "http://localhost:%PORT%"

rem Detect cloudflared: from PATH first, then the tools\ folder.
set CF=
where cloudflared >nul 2>nul && set "CF=cloudflared"
if not defined CF if exist "%~dp0tools\cloudflared-windows-amd64.exe" set "CF=%~dp0tools\cloudflared-windows-amd64.exe"
if not defined CF if exist "%~dp0tools\cloudflared.exe" set "CF=%~dp0tools\cloudflared.exe"

if defined CF (
  echo.
  echo cloudflared found. Opening a public tunnel - copy the https:// URL to friends.
  start "cloudflared tunnel" cmd /k ""%CF%" tunnel --url http://localhost:%PORT%"
) else (
  echo.
  echo [INFO] cloudflared not found. Local play works. For friends to join:
  echo   1. Visit  http://this-PC-IP:%PORT%  on the same network.
  echo   2. Put cloudflared in the tools\ folder or on PATH, see tools\README.md, then rerun.
)

echo.
echo Online server started: http://localhost:%PORT%
echo Do NOT close the "Shallow Regrets Server" console window.
echo.
pause
endlocal