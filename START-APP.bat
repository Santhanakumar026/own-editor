@echo off
title VideoSync Studio
echo ====================================================
echo   VideoSync Studio - Starting Local Server
echo ====================================================
echo.

cd /d "%~dp0"

echo Starting server on http://localhost:5000 ...
start "VideoSync Studio Engine" cmd /k ""C:\Program Files\nodejs\node.exe" server.js"

timeout /t 3 >nul
start http://localhost:5000

echo.
echo ====================================================
echo  VideoSync Studio is RUNNING on http://localhost:5000
echo.
echo  NOTE: Keep the "VideoSync Studio Engine" window open!
echo  Antigravity open panna thevaiye illa.
echo ====================================================
pause
