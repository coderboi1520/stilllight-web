@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is required. & pause & exit /b 1)
if not exist "node_modules\pixi.js\package.json" (
  echo Installing dependencies...
  call npm install || (echo Dependency installation failed. & pause & exit /b 1)
)
start "" cmd /c "timeout /t 2 /nobreak >nul & start "" http://127.0.0.1:5179/"
echo Starting STILLLIGHT Pixi Milestone 1 at http://127.0.0.1:5179/
call npm run dev
endlocal
