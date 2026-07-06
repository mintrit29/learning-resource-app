@echo off
setlocal
cd /d "%~dp0"

echo Starting ScholarFlow with CPU/default embedding...
docker compose up --build -d web
if errorlevel 1 (
  echo.
  echo Failed to start ScholarFlow. Make sure Docker Desktop is running.
  pause
  exit /b 1
)

echo.
echo ScholarFlow is running at http://localhost:3000
start "" "http://localhost:3000"
pause
