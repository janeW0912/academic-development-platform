@echo off
setlocal
cd /d "%~dp0" || goto failed
set "PLATFORM_NODE=node.exe"
where node.exe >nul 2>&1
if errorlevel 1 set "PLATFORM_NODE=D:\Program Files\nodejs\node.exe"
"%PLATFORM_NODE%" "%~dp0server.mjs" --open
:failed
echo(
echo Platform stopped. If there is an error above, keep this window open.
pause
