@echo off
setlocal
cd /d "%~dp0"
echo.
echo  QUESTBOUND LOCAL DEBUG
echo  ----------------------
echo  Local-only address: http://127.0.0.1:5173
echo  This server is NOT exposed to your LAN or the internet.
echo  Close this terminal or press Ctrl+C to stop it completely.
echo.
if not exist node_modules (
  echo Installing dependencies for this folder...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency install failed.
    pause
    exit /b 1
  )
)
call npm run dev
if errorlevel 1 (
  echo.
  echo Questbound exited with an error.
  pause
  exit /b 1
)
echo.
echo Questbound stopped. No local debug server remains.
endlocal
