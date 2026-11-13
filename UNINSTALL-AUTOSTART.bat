@echo off
title Remove VideoSync Studio from Windows Startup
echo Removing VideoSync Studio from Windows Startup...

set SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\VideoSyncStudio.lnk

if exist "%SHORTCUT%" (
    del "%SHORTCUT%"
    echo.
    echo [SUCCESS] Removed from Windows Startup.
) else (
    echo.
    echo [INFO] VideoSync Studio was not in Windows Startup.
)

pause

