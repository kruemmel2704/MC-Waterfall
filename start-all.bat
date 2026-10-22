@echo off
title MC Waterfall Cluster Manager
echo ========================================================
echo   Minecraft Waterfall Cluster Manager (React + ASP.NET)
echo ========================================================
echo.

echo [1/2] Starte ASP.NET Core Backend (Port 5005)...
start "MC Waterfall Backend" cmd /k "cd /d "%~dp0backend" && dotnet run --urls "http://0.0.0.0:5005""

echo [2/2] Starte React Frontend (Port 5173)...
start "MC Waterfall Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host 0.0.0.0"

echo.
echo ========================================================
echo   System gestartet!
echo   Web-Dashboard: http://localhost:5173
echo   Swagger API:   http://localhost:5005/swagger
echo ========================================================
echo.
pause
