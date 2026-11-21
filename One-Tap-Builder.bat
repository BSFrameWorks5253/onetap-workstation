@echo off
title One Tap - Build & Release Studio
cd /d "%~dp0"

echo ====================================================================
echo   Launching One Tap Release Studio (GUI)...
echo ====================================================================

python scripts\make_exe_cross.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Could not launch Python GUI Studio.
    pause
)
