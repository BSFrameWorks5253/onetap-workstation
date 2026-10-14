@echo off
title Uni Desk Studio Compiler (CustomTkinter)
cd /d "%~dp0\.."
echo =====================================================================
echo   Compiling scripts/make_exe_cross.py with CustomTkinter and resources/icon.ico
echo =====================================================================
python -m PyInstaller --noconfirm --onedir --windowed --icon="resources/icon.ico" --collect-all customtkinter --name="UniDeskStudio" scripts/make_exe_cross.py
if %ERRORLEVEL% EQU 0 (
    echo.
    echo =====================================================================
    echo   BUILD SUCCESSFUL!
    echo   Standalone executable created at:
    echo   dist\UniDeskStudio\UniDeskStudio.exe
    echo =====================================================================
) else (
    echo.
    echo [ERROR] Build failed with exit code %ERRORLEVEL%.
)
pause
