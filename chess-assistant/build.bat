@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel%==0 (
  node "%~dp0build.js"
) else (
  set "ELECTRON_RUN_AS_NODE=1"
  "%LOCALAPPDATA%\Programs\Antigravity IDE\Antigravity IDE.exe" "%~dp0build.js"
)

pause
