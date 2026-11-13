Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = "D:\Websites\Own Editing Software"
WshShell.CurrentDirectory = scriptDir

' Run node server using explicit node path completely hidden (0)
WshShell.Run "cmd /c ""C:\Program Files\nodejs\node.exe"" server.js", 0, False

' Wait 2.5 seconds for server to start, then open browser
WScript.Sleep 2500
WshShell.Run "http://localhost:5000"
