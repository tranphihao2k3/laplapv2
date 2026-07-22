# ============================================================
#  furmark-benchmark.ps1
#  Chay FurMark 2 benchmark 5 phut, parse score, upload len server
#
#  Cu phap:
#    .\furmark-benchmark.ps1 -FurMarkPath "C:\FurMark\furmark.exe" `
#                             -DeviceId   "MAC-AABBCCDDEEFF"       `
#                             -DeviceName "ASUS TUF F15"           `
#                             -ApiBase    "https://your-site.com"
#
#  Tham so tu chon:
#    -DurationMin  : So phut benchmark (mac dinh 5)
#    -GpuIndex     : Chi so GPU (mac dinh 0)
#    -Preset       : 1080 | 1440 | 2160 | custom (mac dinh 1080)
#    -GpuName      : Ten GPU (tu dong lay neu de trong)
#    -CpuName      : Ten CPU (tu dong lay)
#    -RamGb        : Dung luong RAM (tu dong lay)
#    -TechName     : Ten ky thuat vien
#    -Note         : Ghi chu
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$FurMarkPath,

    [Parameter(Mandatory=$true)]
    [string]$DeviceId,

    [Parameter(Mandatory=$true)]
    [string]$DeviceName,

    [Parameter(Mandatory=$true)]
    [string]$ApiBase,

    [int]$DurationMin  = 5,
    [int]$GpuIndex     = 0,
    [string]$Preset    = "1080",
    [string]$GpuName   = "",
    [string]$CpuName   = "",
    [int]$RamGb        = 0,
    [string]$TechName  = "",
    [string]$Note      = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Mau sac console ──────────────────────────────────────────
function Write-Step  { param($msg) Write-Host "  >> $msg"  -ForegroundColor Cyan }
function Write-OK    { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "  [!] $msg"  -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "  [X] $msg"  -ForegroundColor Red }

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "   FurMark GPU Benchmark - Auto Upload      " -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

# ── 1. Kiem tra FurMark ──────────────────────────────────────
Write-Step "Kiem tra FurMark..."
if (-not (Test-Path $FurMarkPath)) {
    Write-Fail "Khong tim thay FurMark tai: $FurMarkPath"
    Write-Fail "Tai FurMark 2 tu: https://geeks3d.com/furmark/"
    exit 1
}
Write-OK "FurMark tim thay: $FurMarkPath"

# ── 2. Tu dong lay thong tin phan cung ───────────────────────
Write-Step "Lay thong tin phan cung..."

if ($CpuName -eq "") {
    try {
        $CpuName = (Get-WmiObject Win32_Processor | Select-Object -First 1 -ExpandProperty Name).Trim()
        Write-OK "CPU: $CpuName"
    } catch {
        Write-Warn "Khong lay duoc ten CPU"
        $CpuName = "Unknown CPU"
    }
}

$CpuCores   = 0
$CpuThreads = 0
try {
    $proc = Get-WmiObject Win32_Processor | Select-Object -First 1
    $CpuCores   = [int]$proc.NumberOfCores
    $CpuThreads = [int]$proc.NumberOfLogicalProcessors
} catch {}

if ($RamGb -eq 0) {
    try {
        $ramBytes = (Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory
        $RamGb = [int][Math]::Round($ramBytes / 1GB)
        Write-OK "RAM: $RamGb GB"
    } catch {
        Write-Warn "Khong lay duoc dung luong RAM"
    }
}

$OsName    = ""
$OsVersion = ""
try {
    $os = Get-WmiObject Win32_OperatingSystem | Select-Object -First 1
    $OsName    = $os.Caption.Trim()
    $OsVersion = $os.Version.Trim()
} catch {}

# ── 3. Xac dinh file log cua FurMark ────────────────────────
$furmarkDir  = Split-Path $FurMarkPath -Parent
$logSuffix   = "laplap_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$logFile     = Join-Path $env:TEMP "furmark_${logSuffix}.log"

# ── 4. Xay dung lenh FurMark ─────────────────────────────────
$durationMs  = $DurationMin * 60 * 1000
$presetArg   = "--p$Preset"

# FurMark 2: preset co san dung --duration-ms, custom settings moi dung duration-ms
# Dung custom width/height + --benchmark + --duration-ms de co full control
switch ($Preset) {
    "1080" { $width = 1920; $height = 1080 }
    "1440" { $width = 2560; $height = 1440 }
    "2160" { $width = 3840; $height = 2160 }
    "custom" {
        $widthInput = Read-Host "  Nhap chieu ngang (vd: 1920)"
        $heightInput = Read-Host "  Nhap chieu cao (vd: 1080)"
        $customWidth = 0
        $customHeight = 0
        [void][int]::TryParse($widthInput, [ref]$customWidth)
        [void][int]::TryParse($heightInput, [ref]$customHeight)
        $width = $customWidth
        $height = $customHeight
        if ($width -lt 640 -or $height -lt 480) {
            Write-Warn "Do phan giai khong hop le, dung 1920x1080."
            $width = 1920
            $height = 1080
        }
    }
    default { $width = 1920; $height = 1080 }
}

$furmarkArgs = @(
    "--demo", "furmark-gl",
    "--width", $width,
    "--height", $height,
    "--gpu-index", $GpuIndex,
    "--benchmark",
    "--duration-ms", $durationMs,
    "--no-score-box",
    "--print-render-speed",
    "--logfile-suffix", $logSuffix
)

Write-Step "Chuan bi benchmark $DurationMin phut ($durationMs ms) tai ${width}x${height}..."
Write-Host "  Lenh: furmark $($furmarkArgs -join ' ')" -ForegroundColor DarkGray
Write-Host ""

# ── 5. Chay FurMark ──────────────────────────────────────────
Write-Host "  [START] Bat dau benchmark..." -ForegroundColor Yellow
Write-Host "  Khong dong cua so FurMark! De tu dong ket thuc sau $DurationMin phut." -ForegroundColor Yellow
Write-Host ""

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

try {
    $process = Start-Process -FilePath $FurMarkPath `
                             -ArgumentList $furmarkArgs `
                             -WorkingDirectory $furmarkDir `
                             -PassThru `
                             -Wait
    $exitCode = $process.ExitCode
} catch {
    Write-Fail "Loi khi chay FurMark: $_"
    exit 1
}

$stopwatch.Stop()
$actualSeconds = [int]$stopwatch.Elapsed.TotalSeconds

Write-OK "FurMark ket thuc. Exit code: $exitCode  |  Thoi gian thuc te: ${actualSeconds}s"
Write-Host ""

# ── 6. Doc score tu log file ─────────────────────────────────
Write-Step "Tim file log FurMark..."

# Tim file log moi nhat co suffix cua chung ta
$logSearch = Join-Path $env:TEMP "furmark*${logSuffix}*.log"
$foundLogs = Get-ChildItem -Path $env:TEMP -Filter "furmark*${logSuffix}*.log" -ErrorAction SilentlyContinue

# Thu tim trong thu muc FurMark
if ($foundLogs.Count -eq 0) {
    $foundLogs = Get-ChildItem -Path $furmarkDir -Filter "furmark*.log" -ErrorAction SilentlyContinue |
                 Sort-Object LastWriteTime -Descending |
                 Select-Object -First 1
}

# Neu van khong co, lay file furmark.log moi nhat trong %TEMP%
if ($foundLogs.Count -eq 0) {
    $foundLogs = Get-ChildItem -Path $env:TEMP -Filter "furmark*.log" -ErrorAction SilentlyContinue |
                 Sort-Object LastWriteTime -Descending |
                 Select-Object -First 1
}

$score    = 0
$fpsAvg   = 0.0
$fpsMin   = 0.0
$fpsMax   = 0.0

if ($foundLogs.Count -gt 0) {
    $logPath = $foundLogs[0].FullName
    Write-OK "Doc log: $logPath"
    $logContent = Get-Content $logPath -Raw -ErrorAction SilentlyContinue

    # Pattern: [score]  score=XXXX, frames=YYYY, time=ZZZZ ms
    if ($logContent -match '\[score\].*?score=(\d+)') {
        $score = [int]$Matches[1]
        Write-OK "Score tim duoc: $score"
    }

    # Pattern: [render speed]  fps=XX.XX, frames=YYYY, time=ZZZZ ms
    $fpsMatches = [regex]::Matches($logContent, '\[render speed\].*?fps=([\d.]+)')
    if ($fpsMatches.Count -gt 0) {
        $fpsList = $fpsMatches | ForEach-Object { [double]$_.Groups[1].Value }
        $fpsAvg  = [Math]::Round(($fpsList | Measure-Object -Average).Average, 1)
        $fpsMin  = [Math]::Round(($fpsList | Measure-Object -Minimum).Minimum, 1)
        $fpsMax  = [Math]::Round(($fpsList | Measure-Object -Maximum).Maximum, 1)
        Write-OK "FPS: avg=$fpsAvg  min=$fpsMin  max=$fpsMax"
    }

    # Fallback: doc GPU name tu log neu chua co
    if ($GpuName -eq "") {
        if ($logContent -match 'GL_RENDERER\s*[=:]\s*(.+)') {
            $GpuName = $Matches[1].Trim()
        } elseif ($logContent -match 'gpu\s*[=:]\s*(.+)') {
            $GpuName = $Matches[1].Trim()
        }
    }
} else {
    Write-Warn "Khong tim thay file log. Se dung score = 0."
    Write-Warn "Ban co the nhap thu cong tren trang web."
}

# Neu FurMark 1.x: exit code la score
if ($score -eq 0 -and $exitCode -gt 100) {
    $score = $exitCode
    Write-Warn "Dung exit code lam score (FurMark 1.x): $score"
}

# Lay GPU name tu WMI neu van trong
if ($GpuName -eq "") {
    try {
        $GpuName = (Get-WmiObject Win32_VideoController | Where-Object { $_.AdapterDACType -ne "Internal" } |
                    Select-Object -First 1 -ExpandProperty Name).Trim()
        if (-not $GpuName) {
            $GpuName = (Get-WmiObject Win32_VideoController | Select-Object -First 1 -ExpandProperty Name).Trim()
        }
    } catch { $GpuName = "Unknown GPU" }
}

Write-Host ""
Write-Host "  ─────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "   Ket qua benchmark:" -ForegroundColor White
Write-Host "   GPU Score : $score" -ForegroundColor $(if ($score -ge 8000) { "Magenta" } elseif ($score -ge 6000) { "Cyan" } elseif ($score -ge 4000) { "Yellow" } else { "Red" })
Write-Host "   FPS avg   : $fpsAvg" -ForegroundColor White
Write-Host "   GPU       : $GpuName" -ForegroundColor White
Write-Host "   CPU       : $CpuName" -ForegroundColor White
Write-Host "   RAM       : ${RamGb} GB" -ForegroundColor White
Write-Host "  ─────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

if ($score -eq 0) {
    Write-Warn "Score = 0. Co the FurMark chua chay xong hoac format log thay doi."
    Write-Warn "Kiem tra lai thu cong va dung trang web de nhap tay."
    $confirm = Read-Host "  Ban co muon tiep tuc upload voi score = 0 khong? (y/N)"
    if ($confirm -notmatch "^[yY]") {
        Write-Host "  Huy upload." -ForegroundColor Yellow
        exit 0
    }
}

# ── 7. Upload len API ─────────────────────────────────────────
Write-Step "Upload ket qua len $ApiBase ..."

$payload = @{
    device_id             = $DeviceId
    device_name           = $DeviceName
    cpu_name              = $CpuName
    cpu_cores             = $CpuCores
    cpu_threads           = $CpuThreads
    ram_gb                = $RamGb
    gpu_name              = $GpuName
    os_name               = $OsName
    os_version            = $OsVersion
    benchmark_tool        = "FurMark 2"
    test_width            = $width
    test_height           = $height
    test_preset           = $Preset
    gpu_score             = $score
    fps_avg               = $fpsAvg
    fps_min               = $fpsMin
    fps_max               = $fpsMax
    test_duration_seconds = $actualSeconds
}

if ($TechName -ne "") { $payload["tech_name"] = $TechName }
if ($Note     -ne "") { $payload["note"]      = $Note }

$payloadJson = $payload | ConvertTo-Json -Compress

try {
    $response = Invoke-RestMethod `
        -Uri     "$ApiBase/api/v1/laptops/submit" `
        -Method  POST `
        -Body    $payloadJson `
        -ContentType "application/json" `
        -TimeoutSec 30

    if ($response.ok) {
        Write-OK "Upload thanh cong!"
        Write-Host ""
        Write-Host "  Laptop ID  : $($response.data.laptop_id)" -ForegroundColor White
        if ($response.data.gpu_rank) {
            Write-Host "  Xep loai   : $($response.data.gpu_rank)" -ForegroundColor Cyan
        }
        if ($response.data.percentile -gt 0) {
            $top = 100 - $response.data.percentile
            Write-Host "  Percentile : Top $top%" -ForegroundColor Green
        }
        Write-Host ""
        Write-OK "Xem bang xep hang tai: $ApiBase/test-laptop"
    } else {
        Write-Fail "Server tra ve loi: $($response | ConvertTo-Json)"
    }
} catch {
    Write-Fail "Khong the ket noi den server: $_"
    Write-Host ""
    Write-Warn "Score cua ban la: $score"
    Write-Warn "Nhap tay tai: $ApiBase/test-laptop/submit"
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "   Hoan thanh!                              " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""
