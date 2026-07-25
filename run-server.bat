@echo off
setlocal
cd /d "%~dp0"

set "PORT=8080"
set "URL=http://localhost:%PORT%/"

where py >nul 2>nul
if not errorlevel 1 (
  set "PYTHON_CMD=py"
  goto :start
)

where python >nul 2>nul
if not errorlevel 1 (
  set "PYTHON_CMD=python"
  goto :start
)

echo.
echo Python was not found.
echo Install Python from https://www.python.org/downloads/ and run this file again.
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
%PYTHON_CMD% -m http.server %PORT%

endlocal
