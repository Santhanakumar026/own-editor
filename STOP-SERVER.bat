@echo off
title Stop VideoSync Studio
echo Stopping VideoSync Studio Server on port 5000...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do (
    taskkill /F /PID %%a 2>nul
)

echo.
echo VideoSync Studio server stopped successfully.
pause
