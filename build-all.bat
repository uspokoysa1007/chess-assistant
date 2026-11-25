@echo off
setlocal
set "ROOT=%~dp0"

where node >nul 2>nul
if %errorlevel%==0 (
  echo [1/2] Building PC version...
  node "%ROOT%chess-assistant\build.js"
  if errorlevel 1 exit /b 1
  echo [2/2] Building Phone version...
  node "%ROOT%chess-assistant\build-phone.js"
  if errorlevel 1 exit /b 1
) else (
  set "ELECTRON_RUN_AS_NODE=1"
  set "AGY=%LOCALAPPDATA%\Programs\Antigravity IDE\Antigravity IDE.exe"
  echo [1/2] Building PC version...
  "%AGY%" "%ROOT%chess-assistant\build.js"
  if errorlevel 1 exit /b 1
  echo [2/2] Building Phone version...
  "%AGY%" "%ROOT%chess-assistant\build-phone.js"
  if errorlevel 1 exit /b 1
)

echo Done! Both .xpi files are ready.
pause
