@echo off
title RPW Books
color 0A
echo.
echo  =========================================
echo    RHODES PRODUCTION WORKS - Bookkeeping
echo  =========================================
echo.

rem ── 1. Start Docker Desktop (harmless if already running) ──
tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>NUL | find /I "Docker Desktop.exe" >NUL
if errorlevel 1 (
    echo  Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
    echo  Docker Desktop is already running.
)

rem ── 2. Wait for the Docker engine ──
echo  Waiting for Docker to be ready ^(30-60s after a reboot^)...
set /a tries=0
:waitdocker
wsl -d Ubuntu -- docker info >NUL 2>&1
if not errorlevel 1 goto dockerup
set /a tries+=1
if %tries% GEQ 60 goto fail_docker
timeout /t 5 /nobreak >NUL
goto waitdocker

:dockerup
echo  Docker is up.

rem ── 3. Start the bookkeeping stack ──
echo  Starting the books...
wsl -d Ubuntu -- bash -lc "cd ~/rpw && docker compose up -d" >NUL 2>&1

rem ── 4. Wait for the app to answer ──
echo  Waiting for the app...
set /a tries=0
:waitapp
curl.exe -s -f -o NUL http://localhost:8080/ >NUL 2>&1
if not errorlevel 1 goto appup
set /a tries+=1
if %tries% GEQ 60 goto fail_app
timeout /t 3 /nobreak >NUL
goto waitapp

:appup
echo.
echo  Ready! Opening your books...
start http://localhost:8080
timeout /t 3 /nobreak >NUL
exit

:fail_docker
echo.
echo  Docker did not start after 5 minutes.
echo  Open Docker Desktop manually, then run this again.
pause
exit /b 1

:fail_app
echo.
echo  Docker is up but the app did not answer after 3 minutes.
echo  Tell Claude: "the start script failed at the app step".
pause
exit /b 1
