@echo off
setlocal
cd /d "%~dp0"

echo Starting ScholarFlow with GPU/CUDA embedding...
echo This requires NVIDIA GPU support in Docker Desktop/WSL2.
docker compose -f docker-compose.yml -f docker-compose.cuda.yml up --build -d web
if errorlevel 1 (
  echo.
  echo Failed to start ScholarFlow with GPU. Check Docker Desktop and NVIDIA Container Toolkit/WSL2 support.
  pause
  exit /b 1
)

echo.
echo Waiting for ScholarFlow to be ready at http://localhost:3000...
set "APP_URL=http://localhost:3000/login"
set /a ATTEMPTS=0

:wait_for_web
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '%APP_URL%' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto web_ready
set /a ATTEMPTS+=1
if %ATTEMPTS% GEQ 90 (
  echo.
  echo ScholarFlow started, but http://localhost:3000 did not respond yet.
  echo Open it manually after a moment: http://localhost:3000
  pause
  exit /b 1
)
timeout /t 2 /nobreak >nul
goto wait_for_web

:web_ready
echo ScholarFlow is ready at http://localhost:3000
start "" "http://localhost:3000"
pause
