@echo off
echo ==================================================
echo MusicMachine - Standalone Frontend Launcher
echo ==================================================
echo.
echo The tidal-ui has built-in shared token system
echo No backend required - connects to public proxies!
echo ==================================================
echo.

REM Window 1: SvelteKit Frontend
echo [1/2] Starting SvelteKit Frontend...
start "MusicMachine UI" cmd /k "cd /d %~dp0tidal-ui-main && npm run dev"

REM Wait for frontend
timeout /t 5 /nobreak >nul

REM Window 2: Browser
echo [2/2] Opening Browser...
start http://localhost:5173

echo.
echo ==================================================
echo MusicMachine started!
echo   Frontend: http://localhost:5173
echo ==================================================
echo.
echo Using built-in proxy servers with shared tokens:
echo   - kraken.squid.wtf
echo   - triton.squid.wtf
echo   - monochrome.tf servers
echo   - qqdl.site servers
echo.
echo No configuration needed - just start using!
echo.
pause
