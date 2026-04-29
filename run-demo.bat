@echo off
setlocal
cd /d "%~dp0"
echo Starting demo...
node demaTask1.js
echo.
echo Demo finished. Press any key to close this window.
pause >nul @echo off
setlocal

cd /d "%~dp0"

echo ==================================================
echo  Simulasinxron coursework demo
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
	echo Node.js is not found in PATH.
	echo Install Node.js or run the demo from a terminal where node works.
	echo.
	pause
	exit /b 1
)

echo Starting demo...
echo.
node demaTask1.js
echo.
echo Demo finished. Press any key to close this window.
pause >nul



