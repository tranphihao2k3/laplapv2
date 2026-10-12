@echo off
setlocal EnableExtensions EnableDelayedExpansion

:: === LapLap Mini Tool — launcher ===
:: Chay PowerShell voi execution policy bypass.
:: Dung khi file .ps1 (hoac .exe da PS2EXE-compile) chua duoc tin tuong.

if not "%~1"=="" set "API_BASE=%~1"

if "!API_BASE!"=="" set "API_BASE=http://localhost:3000"

echo.
echo  ============================================
echo   LapLap Mini Tool - All-in-One
echo  ============================================
echo.
echo   Server : !API_BASE!
echo.

if not exist "%~dp0laplap-mini-tool.ps1" (
    echo  [LOI] Khong tim thay laplap-mini-tool.ps1 trong cung thu muc.
    echo         Vao thu muc chua file laplap-mini-tool.exe / .ps1 roi chay lai.
    pause ^& exit /b 1
)

echo  [OK] Tim thay script PowerShell.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0laplap-mini-tool.ps1" -ApiBase "!API_BASE!"

set PS_EXIT=%ERRORLEVEL%

if %PS_EXIT% NEQ 0 (
    echo.
    echo  [LOI] Script gap loi. Xem thong bao o tren.
    pause ^& exit /b 1
)

echo.
echo  Nhan phim bat ky de dong...
pause >nul
endlocal
