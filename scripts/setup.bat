@echo off
chcp 65001 >nul 2>&1
REM COMET - Lanceur d'installation Windows
REM Double-cliquer ce fichier ou lancer: scripts\setup.bat
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0setup.ps1"
pause
