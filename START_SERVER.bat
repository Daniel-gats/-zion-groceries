@echo off
echo ========================================
echo   G-MAN GROCERIES - SERVER STARTUP
echo ========================================
echo.

cd /d "%~dp0"

echo Checking for node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Killing any existing node processes...
taskkill /F /IM node.exe >nul 2>nul

echo Starting G-man Groceries server...
echo.
start "G-man Groceries Server" cmd /k "node server.js"

timeout /t 3 /nobreak >nul

echo Opening website in browser...
start http://localhost:3000

echo.
echo ========================================
echo   Server is running!
echo   Website: http://localhost:3000
echo   Admin Panel: http://localhost:3000/admin
echo ========================================
echo.
echo Press any key to exit this window...
pause >nul
