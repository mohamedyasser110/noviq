@echo off
title Noviq Server
echo ============================================
echo    Noviq Server - Starting...
echo ============================================
echo.

cd /d "%~dp0backend"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

if not exist node_modules (
    echo [INFO] Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
    echo.
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":3001 .*LISTENING"') do (
    echo [INFO] Stopping previous server process on port 3001...
    taskkill /PID %%P /F >nul 2>nul
)

timeout /t 1 /nobreak >nul

echo [INFO] Starting Noviq server on http://localhost:3001
echo [INFO] Admin panel on http://localhost:3001/admin
echo [INFO] Default login: admin / noviq2026
echo.
echo Press Ctrl+C to stop the server.
echo ============================================
echo.

node index.js

echo.
echo [INFO] Server has stopped.
pause
