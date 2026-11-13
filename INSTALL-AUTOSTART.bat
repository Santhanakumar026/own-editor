@echo off
title Install VideoSync Studio to Windows Startup
echo ====================================================
echo  Setting VideoSync Studio to Run Automatically on Boot
echo ====================================================
echo.

set SCRIPT_DIR=%~dp0
set TARGET=%SCRIPT_DIR%START-SILENT.vbs
set SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\VideoSyncStudio.lnk

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Save()"

echo.
echo [SUCCESS] VideoSync Studio has been added to Windows Startup!
echo.
echo Whenever your PC boots or restarts, the local server will run in the background.
echo You can open http://localhost:5000 anytime, even without Antigravity!
echo.
pause
