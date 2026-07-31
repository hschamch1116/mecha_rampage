@echo off
echo ================================
echo  Kill Mecha Rampage Server
echo ================================
echo.

set "PORT=8080"
set "FOUND=0"

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    set "FOUND=1"
    echo [INFO] Killing PID %%a on port %PORT%
    taskkill /PID %%a /T /F >nul 2>nul
    if not errorlevel 1 (
        echo [OK] Done!
    ) else (
        echo [WARN] Failed - may need admin rights.
    )
)

if "%FOUND%"=="0" (
    echo [INFO] No server running on port %PORT%
)

echo.
pause
