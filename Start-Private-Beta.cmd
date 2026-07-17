@echo off
setlocal
set "PROJECT_ROOT=%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%scripts\private-beta\start.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not defined EOE_PRIVATE_BETA_NO_PAUSE pause
exit /b %EXIT_CODE%
