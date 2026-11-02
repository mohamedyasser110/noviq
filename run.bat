@echo off
title Noviq - Site + API
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM ============================================================
REM  Noviq launcher
REM  ------------------------------------------------------------
REM  TWO PROCESSES, ON PURPOSE:
REM     SITE  ->  Next.js      http://localhost:4321   <- OPEN THIS
REM     API   ->  Express      http://localhost:4322/api/health
REM     ADMIN ->  Express      http://localhost:4322/admin  (admin / noviq2026)
REM
REM  backend\.env sets SERVE_FRONTEND=false, so :4322 answers its own
REM  root with {"name":"Noviq API","status":"ok"} BY DESIGN. That JSON
REM  is the API server, not the website. The frontend is a Next.js app
REM  and has no static index.html for the API to co-host.
REM
REM  PORTS 4321/4322, not 3000/3001: those are frequently occupied by
REM  other dev servers on this machine, which is what made the site look
REM  broken. If you change them, change ALL of these together or the
REM  browser will silently call the wrong port:
REM     backend\.env            PORT, FRONTEND_URL
REM     frontend\.env.local     NEXT_PUBLIC_API_URL   (inlined at build time)
REM     frontend\package.json   dev + start site port
REM
REM  IMPORTANT - never run `next dev` against the same distDir as a
REM  production build. A dev server continuously rewrites .next and
REM  destroys BUILD_ID + the manifests, which yields
REM  "Could not find a production build". If you want hot reload, use a
REM  separate output dir instead:
REM      set NEXT_DIST_DIR=.next-dev && npm run dev
REM
REM  This machine also runs many IDE/browser processes and the Windows
REM  commit limit gets exhausted, which kills the build with a silent
REM  exit 1 or a bogus ENOENT on a manifest it just wrote. The heap is
REM  bounded below so V8 collects instead of ballooning.
REM ============================================================

set "HEAP=--max-old-space-size=2048"
set "SITE_PORT=4321"
set "API_PORT=4322"

echo ============================================================
echo    Noviq - Starting site + API
echo ============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. https://nodejs.org
    pause
    exit /b 1
)

REM ---------- 1. Free both ports ----------
for %%P in (%SITE_PORT% %API_PORT%) do (
    for /f "tokens=5" %%K in ('netstat -ano ^| findstr /r /c:":%%P .*LISTENING"') do (
        echo [INFO] Freeing port %%P ^(PID %%K^)
        taskkill /PID %%K /F >nul 2>nul
    )
)
timeout /t 2 /nobreak >nul

REM ---------- 2. Dependencies ----------
if not exist "backend\node_modules" (
    echo [INFO] Installing backend dependencies...
    pushd backend
    call npm.cmd install
    popd
)
if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies ^(first run, slow^)...
    pushd frontend
    call npm.cmd install
    popd
)

REM ---------- 3. Build the site only if there is no valid build ----------
REM BUILD_ID is written by a COMPLETE production build. Its presence is
REM the reliable signal; anything less means the last build died midway.
set "MODE=production build (cached)"
pushd frontend
if not exist ".next\BUILD_ID" (
    echo.
    echo [INFO] No valid production build - building now, please wait...
    set NODE_OPTIONS=%HEAP%
    call npm.cmd run build
    if not exist ".next\BUILD_ID" (
        echo.
        echo [ERROR] The build failed. On this machine that is almost always
        echo         memory pressure - close some apps ^(browsers / spare IDE
        echo         windows^) and run this again.
        popd
        pause
        exit /b 1
    )
    set "MODE=production build (fresh)"
)
popd

REM ---------- 4. Start the API ----------
echo.
echo [INFO] Starting API on http://localhost:%API_PORT%
start "Noviq API (:%API_PORT%)" cmd /k "cd /d "%~dp0backend" && node index.js"
timeout /t 3 /nobreak >nul

REM ---------- 5. Start the site ----------
REM !MODE! not %MODE%: it is assigned inside an if-block above, and this
REM script runs with delayedexpansion enabled.
set NODE_OPTIONS=%HEAP%
echo [INFO] Starting site on http://localhost:%SITE_PORT%  ^[!MODE!^]
start "Noviq Site (:%SITE_PORT%)" cmd /k "cd /d "%~dp0frontend" && npm.cmd run start -- --port %SITE_PORT%"

echo.
echo ============================================================
echo    WEBSITE  ^-^>  http://localhost:%SITE_PORT%          ^<-- OPEN THIS
echo    API      ^-^>  http://localhost:%API_PORT%/api/health
echo    ADMIN    ^-^>  http://localhost:%API_PORT%/admin   ^(admin / noviq2026^)
echo    MODE     ^-^>  !MODE!
echo ============================================================
echo.
echo For hot reload, do NOT use this script - instead run, in a separate
echo window:  set NEXT_DIST_DIR=.next-dev && npm run dev
echo.

timeout /t 12 /nobreak >nul
start "" http://localhost:%SITE_PORT%

echo Servers run in their own windows. Close them ^(or Ctrl+C^) to stop.
pause
endlocal
