@echo off
setlocal
cd /d "%~dp0"
if exist "runtime\node.exe" (
  "runtime\node.exe" server.mjs
) else (
  where node.exe >nul 2>nul
  if errorlevel 1 (
    echo Install Node.js 24 LTS, or place the official portable node.exe in runtime.
    pause
    exit /b 1
  )
  node.exe server.mjs
)
if errorlevel 1 echo Server did not start. See README.md for configuration steps.
pause
