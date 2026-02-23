@echo off
echo ==========================================
echo   Uruchamianie UR Live (Backend + UI)
echo ==========================================

:: Start Backend (AI Daemon) in a new window
echo [1/2] Uruchamianie AI Daemon...
start "UR Live - AI Daemon" cmd /k "python live_daemon.py"

:: Wait a bit for the backend to initialize
timeout /t 3 /nobreak > nul

:: Start Frontend (Dashboard) in a new window
echo [2/2] Uruchamianie Dashboardu...
start "UR Live - Dashboard" cmd /k "cd dashboard && npm run dev"

echo.
echo ==========================================
echo   GOTOWE! Aplikacja bedzie dostepna pod:
echo   http://localhost:3001
echo ==========================================
pause
