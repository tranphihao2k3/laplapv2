# ============================================================
#  build-mini-tool.ps1 — Compile laplap-mini-tool.ps1 → .exe
#  Chạy trên Windows với PowerShell 5.1+ (có sẵn trên Win 10/11)
# ============================================================
#
#  Cach dung:
#    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-mini-tool.ps1
#
#  Output: public\scripts\laplap-mini-tool.exe (~2 MB)
# ============================================================

$ErrorActionPreference = "Stop"

$ScriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$InputFile    = Join-Path $ScriptDir "..\public\scripts\laplap-mini-tool.ps1"
$OutputFile   = Join-Path $ScriptDir "..\public\scripts\laplap-mini-tool.exe"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Build LapLap Mini Tool (.ps1 -> .exe)  " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1) Kiem tra PS2EXE module
Write-Host "[1/4] Kiem tra ps2exe module..." -ForegroundColor Cyan
$ps2exe = Get-Module -ListAvailable -Name ps2exe
if (-not $ps2exe) {
    Write-Host "  ps2exe chua duoc cai dat. Dang cai (CurrentUser scope)..." -ForegroundColor Yellow
    try {
        Install-Module -Name ps2exe -Scope CurrentUser -Force -AllowClobber -SkipPublisherCheck
        Write-Host "  [OK] Da cai ps2exe" -ForegroundColor Green
    } catch {
        Write-Host "  [LOI] Khong the cai ps2exe. Hay chay thu cong trong PowerShell (as Admin):" -ForegroundColor Red
        Write-Host "        Install-Module -Name ps2exe -Scope CurrentUser -Force" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  [OK] ps2exe version $($ps2exe.Version) da san sang" -ForegroundColor Green
}

# 2) Kiem tra input file
Write-Host "[2/4] Kiem tra input file..." -ForegroundColor Cyan
if (-not (Test-Path $InputFile)) {
    Write-Host "  [LOI] Khong tim thay $InputFile" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] $InputFile" -ForegroundColor Green

# 3) Build .exe
Write-Host "[3/4] Build (co the mat 30-60s)..." -ForegroundColor Cyan
$buildStart = Get-Date
try {
    Invoke-PS2EXE `
        -InputFile  $InputFile `
        -OutputFile $OutputFile `
        -RequireAdmin `
        -NoConsole:$false `
        -Title "LapLap Mini Tool" `
        -Description "Quét cấu hình + Benchmark FurMark + Đẩy lên bảng xếp hạng LapLap" `
        -Company "LapLap" `
        -Product "LapLap Mini Tool" `
        -Version "1.0.0.0" `
        -Copyright "Copyright (C) 2026 LapLap" `
        -Trademarks "LapLap"
    $buildEnd = Get-Date
    $duration = $buildEnd - $buildStart
    Write-Host "  [OK] Build xong trong $($duration.TotalSeconds.ToString('0.0'))s" -ForegroundColor Green
} catch {
    Write-Host "  [LOI] Build that bai: $_" -ForegroundColor Red
    exit 1
}

# 4) Verify + SHA-256
Write-Host "[4/4] Verify output..." -ForegroundColor Cyan
if (-not (Test-Path $OutputFile)) {
    Write-Host "  [LOI] Khong tim thay file output" -ForegroundColor Red
    exit 1
}
$file = Get-Item $OutputFile
$sizeMb = [Math]::Round($file.Length / 1MB, 2)
$hash = (Get-FileHash $file.FullName -Algorithm SHA256).Hash
Write-Host "  File    : $($file.Name)" -ForegroundColor Green
Write-Host "  Size    : $sizeMb MB ($($file.Length) bytes)" -ForegroundColor Green
Write-Host "  SHA-256 : $hash" -ForegroundColor Green

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  BUILD THANH CONG!                        " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  File output : $OutputFile"
Write-Host ""
Write-Host "  BUOC TIEP THEO:" -ForegroundColor Yellow
Write-Host "    1. Copy SHA-256 tren vao src\lib\tools\catalog.ts (catalog entry 'laplap-mini-tool')"
Write-Host "    2. Commit + push file .exe len Git (hoac R2/S3)"
Write-Host "    3. Test bang tay: double-click $OutputFile tren Windows"
Write-Host ""
