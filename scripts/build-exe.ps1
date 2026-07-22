# ============================================================
#  build-exe.ps1
#  Dong goi public/scripts/furmark-benchmark.ps1 thanh mot file .exe
#  double-click chay duoc (khong can PowerShell ExecutionPolicy).
#
#  Cach chay:
#    powershell -ExecutionPolicy Bypass -File scripts/build-exe.ps1
#
#  Yeu cau: module ps2exe (tu cai neu chua co).
# ============================================================
$ErrorActionPreference = "Stop"

$root       = Split-Path $PSScriptRoot -Parent
$inputFile  = Join-Path $root "public\scripts\furmark-benchmark.ps1"
$outputFile = Join-Path $root "public\scripts\furmark-benchmark.exe"

Write-Host "Input : $inputFile"
Write-Host "Output: $outputFile"

if (-not (Test-Path $inputFile)) {
    throw "Khong tim thay source: $inputFile"
}

# Cai ps2exe neu chua co
if (-not (Get-Module -ListAvailable -Name ps2exe)) {
    Write-Host "Chua co module ps2exe -> dang cai (CurrentUser)..." -ForegroundColor Yellow
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser | Out-Null
    Install-Module -Name ps2exe -Scope CurrentUser -Force -AllowClobber
}
Import-Module ps2exe

# Build. Giu console (-noConsole:$false) vi script dung Write-Host mau + Read-Host.
Invoke-ps2exe `
    -InputFile   $inputFile `
    -OutputFile  $outputFile `
    -title       "FurMark GPU Benchmark - Auto Upload" `
    -description "Chay FurMark benchmark 5 phut roi tu dong upload diem" `
    -company     "laplap" `
    -noConsole:$false

if (Test-Path $outputFile) {
    $sizeKb = [Math]::Round((Get-Item $outputFile).Length / 1KB, 1)
    Write-Host ""
    Write-Host "[OK] Da tao: $outputFile ($sizeKb KB)" -ForegroundColor Green
} else {
    throw "Build that bai: khong tao duoc $outputFile"
}
