@echo off
setlocal
set "syncStatusFile=%TEMP%\stilllight-sync-%RANDOM%-%RANDOM%.tmp"
set "syncError=Cannot enter D:\STILLLIGHT."
cd /d D:\STILLLIGHT
if errorlevel 1 goto :error

set "syncError=Git is required to sync STILLLIGHT."
where git >nul 2>nul
if errorlevel 1 goto :error

set "syncRoot="
for /f "delims=" %%R in ('git rev-parse --show-toplevel 2^>nul') do set "syncRoot=%%R"
set "syncError=Expected Git root D:/STILLLIGHT; found %syncRoot%."
if /i not "%syncRoot%"=="D:/STILLLIGHT" goto :error

set "syncOrigin="
for /f "delims=" %%R in ('git remote get-url origin 2^>nul') do set "syncOrigin=%%R"
if /i "%syncOrigin%"=="https://github.com/coderboi1520/stilllight-web.git" goto :verifiedRepo
if /i "%syncOrigin%"=="https://github.com/coderboi1520/stilllight-web" goto :verifiedRepo
if /i "%syncOrigin%"=="git@github.com:coderboi1520/stilllight-web.git" goto :verifiedRepo
set "syncError=Origin must point to coderboi1520/stilllight-web; found %syncOrigin%."
goto :error

:verifiedRepo
set "syncError=Cannot inspect local changes."
call git status --porcelain --untracked-files=normal > "%syncStatusFile%"
if errorlevel 1 goto :error
for %%A in ("%syncStatusFile%") do if %%~zA GTR 0 goto :dirty
del "%syncStatusFile%" >nul 2>&1

set "syncError=Fetch failed. Check the network and Git access, then retry."
call git fetch origin
if errorlevel 1 goto :error

set "syncError=Cannot switch to main. Review the Git output and worktree state."
call git switch main
if errorlevel 1 goto :error

set "syncError=Cannot fast-forward main. Resolve its history manually; sync will not merge or rewrite it."
call git pull --ff-only origin main
if errorlevel 1 goto :error

set "syncHead="
set "syncRemoteHead="
for /f "delims=" %%R in ('git rev-parse HEAD 2^>nul') do set "syncHead=%%R"
for /f "delims=" %%R in ('git rev-parse origin/main 2^>nul') do set "syncRemoteHead=%%R"
set "syncError=Could not verify local HEAD and origin/main."
if not defined syncHead goto :error
if not defined syncRemoteHead goto :error
set "syncError=Local HEAD differs from origin/main. Local commits must be resolved manually."
if not "%syncHead%"=="%syncRemoteHead%" goto :error

echo.
echo ===== STILLLIGHT MAIN SYNC COMPLETE =====
echo Main SHA: %syncHead%
call git status --short --branch
call git log -1 --oneline
echo.
echo Refresh the preview started from D:\STILLLIGHT, or open Start Web Preview.cmd.
pause
exit /b 0

:dirty
echo.
echo ERROR: Local changes detected. Resolve them manually before syncing.
call git status --short
set "syncError=Sync stopped to preserve your local changes."

:error
if exist "%syncStatusFile%" del "%syncStatusFile%" >nul 2>&1
echo.
echo ERROR: %syncError%
echo Nothing destructive was attempted. Review the output above.
pause
exit /b 1
