# Dong goi Toolcheck.zip de upload len Supabase Storage (bucket "toolcheck").
#
# Zip nay chua DUNG cau truc ma scanner mong doi khi giai nen canh no:
#   Toolcheck\...            (toan bo bo cong cu ~145MB)
#   scripts\furmark-benchmark.ps1
#
# Cach dung:  powershell -ExecutionPolicy Bypass -File scripts\pack-toolcheck.ps1
# Ket qua:    dist\Toolcheck.zip

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$ToolRoot = Join-Path $RepoRoot "Toolcheck"
$Furmark  = Join-Path $RepoRoot "public\scripts\furmark-benchmark.ps1"
$OutDir   = Join-Path $RepoRoot "dist"
$Staging  = Join-Path $OutDir "toolcheck-staging"
$OutZip   = Join-Path $OutDir "Toolcheck.zip"

if (-not (Test-Path $ToolRoot)) { throw "Khong tim thay thu muc Toolcheck: $ToolRoot" }
if (-not (Test-Path $Furmark))  { throw "Khong tim thay furmark-benchmark.ps1: $Furmark" }

# Dung staging de zip co dung cau truc thu muc goc.
if (Test-Path $Staging) { Remove-Item $Staging -Recurse -Force }
New-Item -ItemType Directory -Path $Staging | Out-Null
New-Item -ItemType Directory -Path (Join-Path $Staging "scripts") | Out-Null

Write-Host ">> Copy Toolcheck (~145MB, co the mat vai phut)..." -ForegroundColor Cyan
Copy-Item $ToolRoot -Destination (Join-Path $Staging "Toolcheck") -Recurse
Copy-Item $Furmark  -Destination (Join-Path $Staging "scripts\furmark-benchmark.ps1")

if (Test-Path $OutZip) { Remove-Item $OutZip -Force }
Write-Host ">> Dang nen $OutZip ..." -ForegroundColor Cyan
Compress-Archive -Path (Join-Path $Staging "*") -DestinationPath $OutZip -CompressionLevel Optimal

Remove-Item $Staging -Recurse -Force
$sizeMB = [math]::Round((Get-Item $OutZip).Length / 1MB, 1)
Write-Host "[OK] Xong: $OutZip ($sizeMB MB)" -ForegroundColor Green
Write-Host ""
Write-Host "Buoc tiep theo:" -ForegroundColor Yellow
Write-Host "  1. Cloudflare Dashboard > R2 > tao bucket, bat Public access (r2.dev)."
Write-Host "  2. Upload 2 file vao bucket (dat ten y het):"
Write-Host "       - dist\Toolcheck.zip           -> Toolcheck.zip"
Write-Host "       - scripts\laplap-toolcheck.ps1  -> laplap-toolcheck.ps1"
Write-Host "  3. Copy URL public cua bucket (vd https://pub-xxxx.r2.dev) dat vao"
Write-Host "     wrangler.jsonc > vars > TOOLCHECK_BASE_URL (va .env.local de chay dev)."
