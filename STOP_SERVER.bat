@echo off
echo ========================================
echo   STOPPING G-MAN GROCERIES SERVER
echo ========================================
echo.

echo Stopping all Node.js processes...
taskkill /F /IM node.exe

echo.
echo Server stopped successfully!
echo.
pause
