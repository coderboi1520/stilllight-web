@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title STILLLIGHT Original Two-Glass Reference

set "PORT=5178"
set "URL=http://127.0.0.1:%PORT%/"

if not exist "index.html" (
  echo ERROR: index.html was not found beside this launcher.
  echo Extract the full ZIP first.
  pause
  exit /b 1
)

where py >nul 2>&1
if not errorlevel 1 (
  set "PY=py"
  goto :start
)
where python >nul 2>&1
if not errorlevel 1 (
  set "PY=python"
  goto :start
)

echo ERROR: Python was not found in PATH.
echo Install Python 3, then run this launcher again.
pause
exit /b 1

:start
start "STILLLIGHT Original Reference Server - close to stop" cmd /k "cd /d ""%~dp0"" && %PY% -m http.server %PORT% --bind 127.0.0.1"

for /L %%I in (1,1,20) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 '%URL%'; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
  if not errorlevel 1 goto :open
  timeout /t 1 /nobreak >nul
)

echo ERROR: Preview server did not respond.
pause
exit /b 1

:open
start "" "%URL%"
exit /b 0
