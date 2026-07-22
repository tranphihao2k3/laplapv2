@echo off
setlocal EnableExtensions EnableDelayedExpansion

:: === CAU HINH - SUA O DAY ====================================
set "FURMARK_PATH=C:\Program Files\Geeks3D\FurMark2_x64\furmark.exe"
set "API_BASE=https://laplap.example.com"
set "DURATION_MIN=5"
set "GPU_INDEX=0"
set "DEVICE_ID="
set "DEVICE_NAME="
:: =============================================================

if not "%~1"=="" set "FURMARK_PATH=%~1"
if not "%~2"=="" set "DEVICE_ID=%~2"
if not "%~3"=="" set "DEVICE_NAME=%~3"
if not "%~4"=="" set "API_BASE=%~4"

if "!DEVICE_ID!"=="" for /f "delims=" %%i in ('hostname') do set "DEVICE_ID=%%i"
if "!DEVICE_NAME!"=="" set "DEVICE_NAME=%COMPUTERNAME%"

echo.
echo  ============================================
echo   FurMark GPU Benchmark - Auto Upload
echo  ============================================
echo.
echo   FurMark    : !FURMARK_PATH!
echo   Device ID  : !DEVICE_ID!
echo   Device     : !DEVICE_NAME!
echo   Server     : !API_BASE!
echo   Duration   : !DURATION_MIN! phut
echo.

if not exist "!FURMARK_PATH!" (
    echo  [LOI] Khong tim thay furmark.exe tai:
    echo        !FURMARK_PATH!
    echo  Tai FurMark 2: https://geeks3d.com/furmark/
    echo  Mo file .bat nay, sua bien FURMARK_PATH.
    pause ^& exit /b 1
)
echo  [OK] Tim thay FurMark.

if not exist "%~dp0furmark-benchmark.ps1" (
    echo  [LOI] Khong tim thay furmark-benchmark.ps1 trong cung thu muc.
    pause ^& exit /b 1
)

echo  [OK] Tim thay script PowerShell.

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0furmark-benchmark.ps1" -FurMarkPath "!FURMARK_PATH!" -DeviceId "!DEVICE_ID!" -DeviceName "!DEVICE_NAME!" -ApiBase "!API_BASE!" -DurationMin !DURATION_MIN! -GpuIndex !GPU_INDEX!
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
