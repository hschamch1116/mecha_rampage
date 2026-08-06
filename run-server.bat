@echo off
setlocal
cd /d "%~dp0"

set "PORT=8080"
set "URL=http://localhost:%PORT%/"

where node >nul 2>nul
if not errorlevel 1 (
  set "NODE_CMD=node"
  goto :start
)

echo.
echo Node.js was not found.
echo Install Node.js and run this file again.
echo.
pause
exit /b 1

:start
echo.
echo Starting Mecha Rampage server...
echo URL: %URL%
echo Press Ctrl+C to stop the server.
echo.
start "" "%URL%"
%NODE_CMD% server.js

endlocal
