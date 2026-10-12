# ============================================================
#  build-mini-tool-zip.ps1 — Bundle Mini Tool (bat + ps1 + readme + optional FurMark) thanh 1 file ZIP.
#
#  Muc dich: nguoi dung chi can tai 1 file ZIP, giai nen ra, chay laplap-mini-tool.bat.
#  Moi chay lai khong can download lai .ps1.
#
#  Output: public\scripts\laplap-mini-tool.zip
#  Cach chay:
#    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-mini-tool-zip.ps1
# ============================================================

$ErrorActionPreference = "Stop"

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$PublicDir  = Join-Path $ScriptDir "..\public\scripts"
$BatFile    = Join-Path $PublicDir "laplap-mini-tool.bat"
$Ps1File    = Join-Path $PublicDir "laplap-mini-tool.ps1"
$ZipOut     = Join-Path $PublicDir "laplap-mini-tool.zip"
$StagingDir = Join-Path $env:TEMP "laplap-mini-tool-staging-$(Get-Random)"

# Optional: include portable FurMark next to the .bat/.ps1 in the ZIP.
# Only when the local copy exists in public/scripts/FurMark_win64/ (user-owned).
# Khong tu dong download — nguoi dung tu dat FurMark portable vao day neu muon bundle.
$FurMarkSrc = Join-Path $PublicDir "FurMark_win64"
$FurMarkExe = Join-Path $FurMarkSrc "furmark.exe"
$IncludeFurMark = $false
if (Test-Path $FurMarkExe) { $IncludeFurMark = $true }

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Bundle Mini Tool -> ZIP                  " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1) Kiem tra input files
Write-Host "[1/4] Kiem tra input files..." -ForegroundColor Cyan
if (-not (Test-Path $BatFile)) { throw "Khong tim thay $BatFile" }
if (-not (Test-Path $Ps1File)) { throw "Khong tim thay $Ps1File" }
Write-Host "  [OK] $BatFile" -ForegroundColor Green
Write-Host "  [OK] $Ps1File" -ForegroundColor Green

# 2) Tao staging folder
Write-Host "[2/4] Tao staging folder..." -ForegroundColor Cyan
if (Test-Path $StagingDir) { Remove-Item $StagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $StagingDir | Out-Null
Write-Host "  [OK] $StagingDir" -ForegroundColor Green

# 3) Copy files + tao README
Write-Host "[3/4] Copy files + tao README..." -ForegroundColor Cyan
Copy-Item $BatFile (Join-Path $StagingDir "laplap-mini-tool.bat")
Copy-Item $Ps1File (Join-Path $StagingDir "laplap-mini-tool.ps1")

if ($IncludeFurMark) {
    Write-Host "  [i] Copy FurMark_win64 (portable)..." -ForegroundColor DarkGray
    $dest = Join-Path $StagingDir "FurMark_win64"
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    Copy-Item $FurMarkSrc $dest -Recurse
    $sizeMb = [Math]::Round(((Get-ChildItem $dest -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 1)
    Write-Host "  [OK] FurMark_win64 ($sizeMb MB)" -ForegroundColor Green
} else {
    Write-Host "  [skip] Khong co FurMark_win64\furmark.exe - ZIP se khong bundle FurMark." -ForegroundColor DarkGray
}

# Build README content (build outside of here-string to avoid parser issues)
$ReadmeHeader = @"
==============================================================
  LAP LAP MINI TOOL - Huong dan su dung
==============================================================

CAI NAO TRONG 2 FILE SAU CUNG CHAY DUOC:

  1. Double-click "laplap-mini-tool.bat"
     -> Tu dong goi PowerShell chay .ps1 (khong can setup gi).
     -> Khoi can doi ten file, khoi can doi extension.

  2. Double-click "laplap-mini-tool.ps1"
     -> Neu Windows hoi "How do you want to open this file?"
        -> Chon "Windows PowerShell".
     -> Neu bi loi "running scripts is disabled on this system":
        -> Mo PowerShell as Administrator, chay:
           Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Bypass
        -> Sau do chay lai file .ps1.

LUU Y:
  - 2 file phai o CUNG 1 FOLDER (file .bat goi file .ps1 cung duong dan).
  - Tool can ket noi internet de gui ket qua len server LapLap.
  - Tool can quyen Administrator de doc mot so thong so phan cung (SMART, etc.).
  - Ket qua se tu mo trinh duyet tai: /test-laptop?highlight=<laptop_id>

"@

if ($IncludeFurMark) {
    $ReadmeFurmark = "FURMARK PORTABLE:" + [Environment]::NewLine +
                     "  - Folder FurMark_win64 da duoc bundle san trong ZIP." + [Environment]::NewLine +
                     "  - Tool se tu detect va su dung, khong can download gi them." + [Environment]::NewLine +
                     [Environment]::NewLine
} else {
    $ReadmeFurmark = "FURMARK:" + [Environment]::NewLine +
                     "  - ZIP nay KHONG kem FurMark. Tool se:" + [Environment]::NewLine +
                     "       (1) Tu dong download portable tu server LapLap neu co, HOAC" + [Environment]::NewLine +
                     "       (2) Tu dong cai dat tu https://geeks3d.com/furmark/, HOAC" + [Environment]::NewLine +
                     "       (3) Hoi ban nhap duong dan toi furmark.exe da cai san." + [Environment]::NewLine +
                     "  - Neu muon bundle san: copy FurMark_win64 (chua furmark.exe)" + [Environment]::NewLine +
                     "    vao public\scripts roi chay lai build script." + [Environment]::NewLine +
                     [Environment]::NewLine
}

$ReadmeFooter = @"

NEU GAP LOI:
  - Mo "Windows PowerShell" thu cong (Start menu -> go "powershell").
  - Chay lenh:
      powershell -NoProfile -ExecutionPolicy Bypass -File "$PWD\laplap-mini-tool.ps1"
  - Xem thong bao loi cu the, chup man hinh gui cho admin.

Build: $(Get-Date -Format "yyyy-MM-dd HH:mm")
"@

$ReadmeContent = $ReadmeHeader + $ReadmeFurmark + $ReadmeFooter

$ReadmePath = Join-Path $StagingDir "README.txt"
$ReadmeContent | Out-File -FilePath $ReadmePath -Encoding UTF8
Write-Host "  [OK] README.txt" -ForegroundColor Green

# 4) Compress thanh ZIP
Write-Host "[4/4] Compress thanh ZIP..." -ForegroundColor Cyan
if (Test-Path $ZipOut) { Remove-Item $ZipOut -Force }
try {
    Compress-Archive -Path "$StagingDir\*" -DestinationPath $ZipOut -CompressionLevel Optimal
    Write-Host "  [OK] $ZipOut" -ForegroundColor Green
} catch {
    throw "Compress-Archive that bai: $_"
}

# 5) Cleanup + bao cao
Remove-Item $StagingDir -Recurse -Force

$zipInfo = Get-Item $ZipOut
$sizeKb = [Math]::Round($zipInfo.Length / 1KB, 1)
$hash = (Get-FileHash $ZipOut -Algorithm SHA256).Hash

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ZIP BUILD THANH CONG!                     " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  File      : $ZipOut"
Write-Host "  Size      : $sizeKb KB ($($zipInfo.Length) bytes)"
Write-Host "  SHA-256   : $hash"
Write-Host ""
Write-Host "  DOWNLOAD LINK:" -ForegroundColor Yellow
Write-Host "    http://localhost:3000/scripts/laplap-mini-tool.zip"
Write-Host ""
Write-Host "  BUOC TIEP THEO:" -ForegroundColor Yellow
Write-Host "    1. Test bang tay: tai zip, giai nen, chay .bat."
Write-Host "    2. Tool se tu detect FurMark_win64\furmark.exe neu co trong ZIP."
Write-Host ""
