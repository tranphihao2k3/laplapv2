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
#    -Preset       : 1080 | 1440 | 2160 (mac dinh 1080)
#    -GpuName      : Ten GPU (tu dong lay neu de trong)
#    -CpuName      : Ten CPU (tu dong lay)
#    -RamGb        : Dung luong RAM (tu dong lay)
#    -TechName     : Ten ky thuat vien
#    -Note         : Ghi chu
# ============================================================

param(
    # Cac tham so nay co the truyen tu dong lenh, hoac de trong de tu dong xac dinh
    # (script duoc dong goi thanh .exe -> double-click chay khong can tham so)
    [string]$FurMarkPath = "",
    [string]$DeviceId    = "",
    [string]$DeviceName  = "",
    [string]$ApiBase     = "http://localhost:3000",

    [int]$DurationMin  = 5,
    [int]$GpuIndex     = 0,
    [string]$Preset    = "1080",
    # URL tai installer FurMark (Inno Setup). Co the sua neu link thay doi.
    [string]$FurMarkDownloadUrl = "https://www.geeks3d.com/dl/get/740",
    [string]$GpuName       = "",
    [string]$CpuName       = "",
    [int]$RamGb            = 0,
    [int]$CpuCores         = 0,
    [int]$CpuThreads       = 0,
    [double]$CpuBaseGhz    = 0,
    [string]$RamBrand      = "",
    [int]$RamSpeedMhz      = 0,
    [string]$RamType       = "",
    [int]$RamSlots         = 0,
    [string]$StorageBrand  = "",
    [string]$StorageType   = "",
    [int]$StorageGb        = 0,
    [string]$GpuVendor     = "",
    [int]$GpuVramGb        = 0,
    [int]$GpuPowerWatts    = 0,
    [string]$Mainboard     = "",
    [int]$BatteryDesignMwh = 0,
    [int]$BatteryFullMwh   = 0,
    [string]$TechName      = "",
    [string]$Note          = ""
)

# StrictMode Latest hay lam script vang vi loi vat (vd .Count tren $null) -> dung Version 2.0 nhe hon.
Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

# ── Mau sac console ──────────────────────────────────────────
function Write-Step  { param($msg) Write-Host "  >> $msg"  -ForegroundColor Cyan }
function Write-OK    { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "  [!] $msg"  -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "  [X] $msg"  -ForegroundColor Red }

# ── Luoi an toan: bat MOI loi ket thuc, in ro va GIU cua so mo ──
# (Truoc day script vang giua chung -> cua so tat luon, khong thay gi.)
trap {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "   SCRIPT LOI - DA DUNG LAI                 " -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host ""
    Write-Host ("  Loi   : " + $_.Exception.Message) -ForegroundColor Red
    if ($_.InvocationInfo) {
        Write-Host ("  Dong  : " + $_.InvocationInfo.ScriptLineNumber) -ForegroundColor Yellow
        Write-Host ("  Lenh  : " + ($_.InvocationInfo.Line).Trim()) -ForegroundColor DarkGray
    }
    Write-Host ""
    Read-Host "  Nhan Enter de dong cua so"
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "   FurMark GPU Benchmark - Auto Upload      " -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

# ── 0. Tu dong xac dinh Device ID / Ten thiet bi ─────────────
if ($DeviceId   -eq "") { $DeviceId   = $env:COMPUTERNAME }
if ($DeviceName -eq "") { $DeviceName = $env:COMPUTERNAME }

# ── 1. Kiem tra / tu dong do FurMark ─────────────────────────
Write-Step "Kiem tra FurMark..."

# Cac duong dan cai dat pho bien cua FurMark 2
$furmarkCandidates = @(
    "C:\Program Files\Geeks3D\FurMark2_x64\furmark.exe",
    "C:\Program Files\Geeks3D\FurMark2\furmark.exe",
    "C:\Program Files\Geeks3D\Benchmarks\FurMark2\furmark.exe",
    "C:\Program Files (x86)\Geeks3D\FurMark2_x64\furmark.exe",
    "C:\Program Files (x86)\Geeks3D\FurMark2\furmark.exe",
    "${env:LOCALAPPDATA}\Programs\Geeks3D\FurMark2\furmark.exe"
)

# Neu chua truyen -FurMarkPath (hoac path khong ton tai): tu dong do
if ($FurMarkPath -eq "" -or -not (Test-Path $FurMarkPath)) {
    $found = $null
    foreach ($cand in $furmarkCandidates) {
        if ($cand -and (Test-Path $cand)) { $found = $cand; break }
    }

    # Fallback: quet thu muc Geeks3D tim furmark.exe
    if (-not $found) {
        foreach ($root in @("C:\Program Files\Geeks3D", "C:\Program Files (x86)\Geeks3D")) {
            if (Test-Path $root) {
                $hit = Get-ChildItem -Path $root -Filter "furmark.exe" -Recurse -ErrorAction SilentlyContinue |
                       Select-Object -First 1
                if ($hit) { $found = $hit.FullName; break }
            }
        }
    }

    if ($found) {
        $FurMarkPath = $found
    } else {
        # ── Tu dong tai + cai FurMark (silent) ───────────────
        Write-Warn "Khong thay FurMark. Dang tu dong tai va cai dat..."
        $installerPath = Join-Path $env:TEMP "furmark_setup.exe"
        $installDir    = Join-Path $env:LOCALAPPDATA "FurMark2"
        $downloaded    = $false
        try {
            Write-Step "Tai installer tu: $FurMarkDownloadUrl"
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $ProgressPreference = 'SilentlyContinue'
            Invoke-WebRequest -Uri $FurMarkDownloadUrl -OutFile $installerPath -UseBasicParsing -TimeoutSec 120
            if ((Test-Path $installerPath) -and ((Get-Item $installerPath).Length -gt 500000)) {
                $downloaded = $true
            }
        } catch {
            Write-Warn "Tai that bai: $_"
        }

        if ($downloaded) {
            try {
                Write-Step "Cai dat silent vao: $installDir"
                # Inno Setup silent switches
                $p = Start-Process -FilePath $installerPath `
                        -ArgumentList "/VERYSILENT","/SUPPRESSMSGBOXES","/NORESTART","/DIR=`"$installDir`"" `
                        -Wait -PassThru
                # Do lai sau khi cai
                foreach ($cand in (@(
                    (Join-Path $installDir "furmark.exe")
                ) + $furmarkCandidates)) {
                    if ($cand -and (Test-Path $cand)) { $FurMarkPath = $cand; break }
                }
                if ($FurMarkPath -eq "" -or -not (Test-Path $FurMarkPath)) {
                    $hit = Get-ChildItem -Path $installDir -Filter "furmark.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
                    if ($hit) { $FurMarkPath = $hit.FullName }
                }
                if ($FurMarkPath -ne "" -and (Test-Path $FurMarkPath)) {
                    Write-OK "Da cai FurMark: $FurMarkPath"
                }
            } catch {
                Write-Warn "Cai dat that bai: $_"
            }
            Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
        }

        # Van chua co -> mo trang chu + cho nhap tay (fallback)
        if ($FurMarkPath -eq "" -or -not (Test-Path $FurMarkPath)) {
            Write-Warn "Khong tu dong cai duoc FurMark."
            Write-Host "  Mo trang tai FurMark 2: https://geeks3d.com/furmark/" -ForegroundColor DarkGray
            try { Start-Process "https://geeks3d.com/furmark/" } catch {}
            while ($true) {
                $userPath = Read-Host "  Cai xong, nhap duong dan toi furmark.exe (de trong de thoat)"
                if ([string]::IsNullOrWhiteSpace($userPath)) {
                    Write-Fail "Khong co duong dan FurMark. Thoat."
                    Read-Host "  Nhan Enter de dong"
                    exit 1
                }
                $userPath = $userPath.Trim('"').Trim()
                if (Test-Path $userPath) { $FurMarkPath = $userPath; break }
                Write-Warn "Duong dan khong ton tai, thu lai."
            }
        }
    }
}

if (-not (Test-Path $FurMarkPath)) {
    Write-Fail "Khong tim thay FurMark tai: $FurMarkPath"
    Write-Fail "Tai FurMark 2 tu: https://geeks3d.com/furmark/"
    Read-Host "  Nhan Enter de dong"
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

try {
    $proc = Get-WmiObject Win32_Processor | Select-Object -First 1
    if ($CpuCores -eq 0 -and $proc.NumberOfCores) { $CpuCores = [int]$proc.NumberOfCores }
    if ($CpuThreads -eq 0 -and $proc.NumberOfLogicalProcessors) { $CpuThreads = [int]$proc.NumberOfLogicalProcessors }
    if ($CpuBaseGhz -eq 0 -and $proc.MaxClockSpeed) { $CpuBaseGhz = [Math]::Round([double]$proc.MaxClockSpeed / 1000, 2) }
    if ($CpuName -eq "") { $CpuName = $proc.Name.Trim() }
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

try {
    $ramModules = Get-WmiObject Win32_PhysicalMemory
    if ($RamBrand -eq "") {
        $RamBrand = ($ramModules | ForEach-Object { $_.Manufacturer } | Where-Object { $_ -and $_.Trim() } | Select-Object -Unique) -join ", "
    }
    if ($RamSpeedMhz -eq 0) {
        $ramSpeeds = $ramModules | ForEach-Object { [int]$_.Speed } | Where-Object { $_ -gt 0 }
        if ($ramSpeeds.Count -gt 0) { $RamSpeedMhz = ($ramSpeeds | Measure-Object -Maximum).Maximum }
    }
    if ($RamType -eq "") {
        $ramTypeValue = $ramModules | Select-Object -First 1 -ExpandProperty MemoryType -ErrorAction SilentlyContinue
        switch ([string]$ramTypeValue) {
            "20" { $RamType = "DDR" }
            "21" { $RamType = "DDR2" }
            "22" { $RamType = "DDR2" }
            "24" { $RamType = "DDR3" }
            "26" { $RamType = "DDR4" }
            "28" { $RamType = "DDR5" }
            default { $RamType = "DDR" }
        }
    }
    if ($RamSlots -eq 0) { $RamSlots = @($ramModules).Count }
} catch {}

try {
    $board = Get-WmiObject Win32_BaseBoard | Select-Object -First 1
    if ($Mainboard -eq "") { $Mainboard = $board.Manufacturer + " " + $board.Product }
} catch {}

try {
    $storageDrives = Get-WmiObject Win32_DiskDrive | Where-Object { $_.Size -gt 0 } | Sort-Object Size -Descending
    if ($storageDrives -and $storageDrives.Count -gt 0) {
        $firstDrive = $storageDrives[0]
        if ($StorageGb -eq 0) { $StorageGb = [int][Math]::Round([int64]$firstDrive.Size / 1GB) }
        if ($StorageBrand -eq "") { $StorageBrand = $firstDrive.Manufacturer }
        if ($StorageType -eq "") {
            if ($firstDrive.Model -match 'NVMe|PCIe') { $StorageType = 'NVMe SSD' }
            elseif ($firstDrive.Model -match 'SSD') { $StorageType = 'SSD' }
            elseif ($firstDrive.Model -match 'HDD|HD') { $StorageType = 'HDD' }
            else { $StorageType = 'Storage' }
        }
    }
} catch {}

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

# ── 3b. Menu tuy chon (chi hoi khi khong truyen san tham so) ──
# Neu chay bang double-click (.exe) va nguoi dung khong truyen -DurationMin/-Preset,
# hien menu de chon. Nhan Enter de lay mac dinh.
if (-not $PSBoundParameters.ContainsKey('DurationMin')) {
    Write-Host ""
    Write-Host "  Chon thoi gian test:" -ForegroundColor Cyan
    Write-Host "    1) 1 phut" -ForegroundColor White
    Write-Host "    2) 3 phut" -ForegroundColor White
    Write-Host "    3) 5 phut  (mac dinh)" -ForegroundColor White
    Write-Host "    4) 10 phut" -ForegroundColor White
    Write-Host "    5) 15 phut" -ForegroundColor White
    $choice = Read-Host "  Nhap lua chon (1-5), Enter = mac dinh"
    switch ($choice.Trim()) {
        "1"     { $DurationMin = 1 }
        "2"     { $DurationMin = 3 }
        "3"     { $DurationMin = 5 }
        "4"     { $DurationMin = 10 }
        "5"     { $DurationMin = 15 }
        ""      { $DurationMin = 5 }
        default { Write-Warn "Lua chon khong hop le, dung mac dinh 5 phut."; $DurationMin = 5 }
    }
    Write-OK "Thoi gian test: $DurationMin phut"
}

if (-not $PSBoundParameters.ContainsKey('Preset')) {
    Write-Host ""
    Write-Host "  Chon do phan giai test:" -ForegroundColor Cyan
    Write-Host "    1) 1080p  (1920x1080)" -ForegroundColor White
    Write-Host "    2) 1440p  (2560x1440)" -ForegroundColor White
    Write-Host "    3) 2160p  (3840x2160 / 4K)" -ForegroundColor White
    Write-Host "    4) Tu dong theo man hinh  (mac dinh)" -ForegroundColor White
    Write-Host "    5) Tuy chon kich thuoc (width x height)" -ForegroundColor White
    $choicePreset = Read-Host "  Nhap lua chon (1-5), Enter = mac dinh"
    switch ($choicePreset.Trim()) {
        "1"     { $Preset = "1080" }
        "2"     { $Preset = "1440" }
        "3"     { $Preset = "2160" }
        "4"     { $Preset = "auto" }
        "5"     { $Preset = "custom" }
        ""      { $Preset = "auto" }
        default { Write-Warn "Lua chon khong hop le, dung tu dong."; $Preset = "auto" }
    }
}

# ── 4. Xay dung lenh FurMark ─────────────────────────────────
$durationMs  = $DurationMin * 60 * 1000

# Neu Preset = auto: lay do phan giai man hinh chinh
if ($Preset -eq "auto") {
    $width = 1920; $height = 1080
    try {
        $vc = Get-WmiObject Win32_VideoController |
              Where-Object { $_.CurrentHorizontalResolution -gt 0 } |
              Sort-Object CurrentHorizontalResolution -Descending |
              Select-Object -First 1
        if ($vc) {
            $width  = [int]$vc.CurrentHorizontalResolution
            $height = [int]$vc.CurrentVerticalResolution
        }
    } catch {}
    Write-OK "Do phan giai (tu dong): ${width}x${height}"
} elseif ($Preset -eq "custom") {
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
    Write-OK "Do phan giai tuy chon: ${width}x${height}"
} else {
    switch ($Preset) {
        "1080" { $width = 1920; $height = 1080 }
        "1440" { $width = 2560; $height = 1440 }
        "2160" { $width = 3840; $height = 2160 }
        default { $width = 1920; $height = 1080 }
    }
    Write-OK "Do phan giai: ${width}x${height} (${Preset}p)"
}

$furmarkArgs = @(
    "--demo", "furmark-gl",
    "--width", $width,
    "--height", $height,
    "--fullscreen",
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
$benchStart = (Get-Date).AddSeconds(-5)  # moc de nhan biet dong CSV cua lan chay nay

try {
    $process = Start-Process -FilePath $FurMarkPath `
                             -ArgumentList $furmarkArgs `
                             -WorkingDirectory $furmarkDir `
                             -PassThru `
                             -Wait
    $exitCode = $process.ExitCode
} catch {
    Write-Fail "Loi khi chay FurMark: $_"
    Read-Host "  Nhan Enter de dong"
    exit 1
}

$stopwatch.Stop()
$actualSeconds = [int]$stopwatch.Elapsed.TotalSeconds

Write-OK "FurMark ket thuc. Exit code: $exitCode  |  Thoi gian thuc te: ${actualSeconds}s"
Write-Host ""

# ── 6. Doc score tu file ket qua FurMark ─────────────────────
# FurMark 2.x ghi diem vao "_scores.csv" trong thu muc furmark (KHONG phai .log trong %TEMP%).
# Cot CSV: date,demo,platform,vendor,renderer,api_version,width,height,fullscreen,
#          antialiasing,duration,max_gpu_temp,score,avg_fps,min_fps,max_fps
Write-Step "Doc ket qua tu FurMark..."

$score    = 0
$fpsAvg   = 0.0
$fpsMin   = 0.0
$fpsMax   = 0.0

$csvPath = Join-Path $furmarkDir "_scores.csv"
if (Test-Path $csvPath) {
    Write-OK "Doc file diem: $csvPath"
    $rows = @()
    try { $rows = @(Import-Csv -Path $csvPath) } catch {}

    # Lay dong cua lan chay nay: uu tien dong co cot 'date' >= luc bat dau benchmark.
    # date co dang "2025.10.15@17:39:30" -> parse; khong parse duoc thi lay dong cuoi cung.
    $row = $null
    foreach ($r in $rows) {
        if (-not $r.date) { continue }
        try {
            $dt = [DateTime]::ParseExact([string]$r.date, "yyyy.MM.dd@HH:mm:ss", [System.Globalization.CultureInfo]::InvariantCulture)
            if ($dt -ge $benchStart) { $row = $r }   # giu dong moi nhat thoa dieu kien
        } catch {}
    }
    if (-not $row -and $rows.Count -gt 0) { $row = $rows[$rows.Count - 1] }  # fallback: dong cuoi

    if ($row) {
        if ($row.score)   { $score  = [int]([double]$row.score) }
        if ($row.avg_fps) { $fpsAvg = [Math]::Round([double]$row.avg_fps, 1) }
        if ($row.min_fps) { $fpsMin = [Math]::Round([double]$row.min_fps, 1) }
        if ($row.max_fps) { $fpsMax = [Math]::Round([double]$row.max_fps, 1) }
        if ($GpuName -eq "" -and $row.renderer) { $GpuName = ([string]$row.renderer).Trim() }
        Write-OK "Score: $score  |  FPS avg=$fpsAvg min=$fpsMin max=$fpsMax"
    } else {
        Write-Warn "File _scores.csv rong hoac khong doc duoc dong ket qua."
    }
} else {
    Write-Warn "Khong tim thay _scores.csv trong: $furmarkDir"
    Write-Warn "Co the benchmark bi dong som (dong cua so FurMark truoc khi xong)."
    Write-Warn "Se dung score = 0 - ban co the nhap tay tren trang web."
}

# Neu FurMark 1.x: exit code la score
if ($score -eq 0 -and $exitCode -gt 100) {
    $score = $exitCode
    Write-Warn "Dung exit code lam score (FurMark 1.x): $score"
}

# Lay GPU name tu WMI neu van trong
if ($GpuName -eq "") {
    try {
        $gpuInfo = Get-WmiObject Win32_VideoController | Where-Object { $_.AdapterDACType -ne "Internal" } | Select-Object -First 1
        if (-not $gpuInfo) { $gpuInfo = Get-WmiObject Win32_VideoController | Select-Object -First 1 }
        if ($gpuInfo) {
            $GpuName = $gpuInfo.Name.Trim()
            if ($GpuVendor -eq "") {
                if ($gpuInfo.Name -match 'NVIDIA|GeForce|RTX|GTX') { $GpuVendor = 'NVIDIA' }
                elseif ($gpuInfo.Name -match 'AMD|Radeon|RX') { $GpuVendor = 'AMD' }
                elseif ($gpuInfo.Name -match 'Intel') { $GpuVendor = 'Intel' }
                else { $GpuVendor = 'Unknown' }
            }
            if ($GpuVramGb -eq 0 -and $gpuInfo.AdapterRAM) { $GpuVramGb = [int][Math]::Round([int64]$gpuInfo.AdapterRAM / 1GB) }
        }
    } catch { $GpuName = "Unknown GPU" }
}

if ($GpuPowerWatts -eq 0) {
    try {
        if ($GpuName -match 'RTX 5090|RTX 4090|RTX 3090|RTX 3080|RTX 3070|RTX 3060|RTX 3050|RTX 2080|RTX 2070|RTX 2060|GTX 1080|GTX 1070|GTX 1060|GTX 1650') {
            switch -Regex ($GpuName) {
                'RTX 5090|RTX 4090|RTX 3090|RTX 3080|RTX 3070|RTX 3060|RTX 3050|RTX 2080|RTX 2070|RTX 2060' { $GpuPowerWatts = 115 }
                'GTX 1080|GTX 1070|GTX 1060|GTX 1650' { $GpuPowerWatts = 120 }
                default { $GpuPowerWatts = 75 }
            }
        } elseif ($GpuName -match 'RX 7900|RX 7800|RX 7700|RX 7600|RX 6900|RX 6800|RX 6700|RX 6600|RX 6500|RX 5700|RX 5600|RX 5500') {
            $GpuPowerWatts = 250
        }
    } catch {}
}

try {
    $battery = Get-WmiObject Win32_Battery | Select-Object -First 1
    if ($battery) {
        if ($BatteryDesignMwh -eq 0 -and $battery.DesignCapacity) { $BatteryDesignMwh = [int]$battery.DesignCapacity }
        if ($BatteryFullMwh -eq 0 -and $battery.FullChargeCapacity) { $BatteryFullMwh = [int]$battery.FullChargeCapacity }
    }
} catch {}

Write-Host ""
Write-Host "  ─────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "   Ket qua benchmark:" -ForegroundColor White
Write-Host "   GPU Score : $score" -ForegroundColor $(if ($score -ge 8000) { "Magenta" } elseif ($score -ge 6000) { "Cyan" } elseif ($score -ge 4000) { "Yellow" } else { "Red" })
Write-Host "   FPS avg   : $fpsAvg" -ForegroundColor White
Write-Host "   GPU       : $GpuName" -ForegroundColor White
Write-Host "   CPU       : $CpuName" -ForegroundColor White
Write-Host "   RAM       : ${RamGb} GB" -ForegroundColor White
Write-Host "   Storage   : ${StorageGb} GB / ${StorageType}" -ForegroundColor White
Write-Host "   Battery   : ${BatteryDesignMwh} mWh design / ${BatteryFullMwh} mWh full" -ForegroundColor White
Write-Host "  ─────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

if ($score -eq 0) {
    Write-Warn "Score = 0. Co the FurMark chua chay xong hoac format log thay doi."
    Write-Warn "Kiem tra lai thu cong va dung trang web de nhap tay."
}

# ── 7. Hoi xac nhan truoc khi upload ──────────────────────────
Write-Host ""
$confirm = Read-Host "  Ban co muon UPLOAD ket qua nay len web khong? (Y/n)"
if ($confirm -match "^[nN]") {
    Write-Host ""
    Write-Warn "Da huy upload theo yeu cau. Khong gui gi len server."
    Read-Host "  Nhan Enter de dong"
    exit 0
}

# ── 8. Gui ket qua len server ─────────────────────────────────
Write-Host ""
Write-Step "Dang upload ket qua len $ApiBase ..."

$batteryHealth = 0
if ($BatteryDesignMwh -gt 0 -and $BatteryFullMwh -gt 0) {
    $batteryHealth = [Math]::Round(($BatteryFullMwh / $BatteryDesignMwh) * 100, 1)
}

$payload = @{
    device_id             = $DeviceId
    device_name           = $DeviceName
    cpu_name              = $CpuName
    cpu_cores             = $CpuCores
    cpu_threads           = $CpuThreads
    cpu_base_ghz          = $CpuBaseGhz
    ram_gb                = $RamGb
    ram_brand             = $RamBrand
    ram_speed_mhz         = $RamSpeedMhz
    ram_type              = $RamType
    ram_slots             = $RamSlots
    gpu_name              = $GpuName
    gpu_vendor            = $GpuVendor
    gpu_vram_gb           = $GpuVramGb
    gpu_power_watts       = $GpuPowerWatts
    mainboard             = $Mainboard
    storage_brand         = $StorageBrand
    storage_type          = $StorageType
    storage_gb            = $StorageGb
    battery_design_mwh    = $BatteryDesignMwh
    battery_full_mwh      = $BatteryFullMwh
    battery_health        = $batteryHealth
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
        -Uri     "$ApiBase/api/v1/benchmarks/result" `
        -Method  POST `
        -Body    $payloadJson `
        -ContentType "application/json" `
        -TimeoutSec 30

    if ($response.ok -and $response.data.id) {
        $resultUrl = "$ApiBase/test-laptop/benchmark/result/$($response.data.id)"
        Write-Host ""
        Write-Host "============================================" -ForegroundColor Green
        Write-Host "   UPLOAD THANH CONG!                       " -ForegroundColor Green
        Write-Host "============================================" -ForegroundColor Green
        Write-Host ""
        Write-OK "GPU Score da luu: $score"
        Write-OK "Link ket qua: $resultUrl"
        Write-Host ""
        Write-Step "Dang mo trinh duyet..."
        try { Start-Process $resultUrl } catch {
            Write-Warn "Khong tu mo duoc trinh duyet. Copy link tren de xem ket qua."
        }
    } else {
        # Server phan hoi nhung bao that bai (vd validate loi)
        Write-Host ""
        Write-Host "============================================" -ForegroundColor Red
        Write-Host "   UPLOAD THAT BAI (server tu choi)         " -ForegroundColor Red
        Write-Host "============================================" -ForegroundColor Red
        Write-Host ""
        $errMsg = if ($response.error -and $response.error.message) { $response.error.message }
                  elseif ($response.error) { [string]$response.error }
                  else { ($response | ConvertTo-Json -Compress) }
        Write-Fail "Ly do: $errMsg"
        Write-Warn "Score cua ban la: $score  (co the nhap tay tai $ApiBase/test-laptop/benchmark)"
        Read-Host "  Nhan Enter de dong"
        exit 1
    }
} catch {
    # Loi ket noi / HTTP error -> co gang lay status code va noi dung server tra ve
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "   UPLOAD THAT BAI (loi ket noi)            " -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host ""

    $statusCode = ""
    $serverBody = ""
    try {
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $serverBody = $reader.ReadToEnd()
            $reader.Close()
        }
    } catch {}

    if ($statusCode) { Write-Fail "HTTP $statusCode - $ApiBase/api/v1/benchmarks/result" }
    Write-Fail "Loi: $($_.Exception.Message)"
    if ($serverBody) {
        # Thu doc message goi gon tu JSON server ({ ok:false, error:{ message } })
        try {
            $parsed = $serverBody | ConvertFrom-Json
            if ($parsed.error -and $parsed.error.message) {
                Write-Fail "Server: $($parsed.error.message)"
            } else {
                Write-Fail "Server tra ve: $serverBody"
            }
        } catch {
            Write-Fail "Server tra ve: $serverBody"
        }
    }
    Write-Host ""
    Write-Warn "Score cua ban la: $score"
    Write-Warn "Ban co the nhap tay tai: $ApiBase/test-laptop/benchmark"
    Read-Host "  Nhan Enter de dong"
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "   Hoan thanh!                              " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

# Giu cua so mo (quan trong khi chay bang double-click .exe)
Read-Host "  Nhan Enter de dong"
