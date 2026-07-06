@echo off
setlocal
cd /d "%~dp0"

echo Stopping ScholarFlow...
docker compose down
if errorlevel 1 (
  echo.
  echo Failed to stop ScholarFlow. Make sure Docker Desktop is running.
  pause
  exit /b 1
)

echo.
echo ScholarFlow stopped.
pause
