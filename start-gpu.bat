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
echo ScholarFlow is running at http://localhost:3000
start "" "http://localhost:3000"
pause
