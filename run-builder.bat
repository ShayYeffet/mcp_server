@echo off
echo Building EXE Installer...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0build-real-installer.ps1"
echo.
pause
