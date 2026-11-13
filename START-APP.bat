@echo off
title VideoSync Studio Launcher
echo ====================================================
echo   VideoSync Studio - Starting Engine & UI
echo ====================================================
echo.

echo [1/2] Starting Backend Engine (FFmpeg & Node API)...
start "VideoSync Backend Engine" cmd /k "cd /d "%~dp0" && node server.js"

echo [2/2] Starting Frontend UI (React + Vite)...
start "VideoSync Frontend UI" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo Waiting for servers to initialize...
timeout /t 4 >nul

echo Opening Browser at http://localhost:3000 ...
start http://localhost:3000

echo.
echo ====================================================
echo  VideoSync Studio is now RUNNING!
echo  Open: http://localhost:3000
echo.
echo  NOTE: Keep the terminal windows open while using.
echo ====================================================
pause
