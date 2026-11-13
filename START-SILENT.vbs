Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get directory of this script
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

' Launch node server silently (0 = hidden window)
WshShell.Run "cmd /c node server.js", 0, False

' Wait 2 seconds and open browser to localhost:5000
WScript.Sleep 2000
WshShell.Run "http://localhost:5000"
