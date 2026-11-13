@echo off
title Create Desktop Shortcut
echo Creating VideoSync Studio shortcut on your Desktop...

set SCRIPT_DIR=%~dp0
set TARGET=%SCRIPT_DIR%START-SILENT.vbs
set DESKTOP=%USERPROFILE%\Desktop\VideoSync Studio.lnk

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%TARGET%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Save()"

echo.
echo [SUCCESS] Shortcut created on your Desktop:
echo "%DESKTOP%"
echo.
pause
