// PowerShell template cho lap la p toolcheck mini - duoc nhung inline vi Worker
// (Cloudflare) khong co filesystem. Two templates:
//   - SCANNER_PS1: scan toan bo (CPU, GPU, RAM, disk, pin, man hinh, WiFi)
//   - SCANNER_BAT: trigger don gian, khong self-elevate phuc tap
//
// Trong route /api/v1/system-scan/download, token va api base duoc chen vao
// template bang replaceAll, dong goi vao file zip cung LapLap-Scanner.bat
// + README.txt -> tra ve 1 file zip cho user tai ve va chay.
//
// BAT rat don gian: chi goi powershell -File laplap-toolcheck.ps1.
// PS1 in progress truc tiep ra console, gui ping len server, POST ket qua
// JSON, roi exit. KHONG can admin (WMI/powercfg la du).
// Neu admin muon xem SMART chi tiet, PS1 tu tai smartctl.exe ve TEMP va
// chay voi -r (no admin required for NVMe via STORAGE_DEVICE_DESCRIPTOR).

export const SCANNER_PS1 = String.raw`param(
    [Parameter(Mandatory=$false)]
    [string]$ApiBase = "__API_BASE__",

    [Parameter(Mandatory=$false)]
    [string]$ScanToken = "__SCAN_TOKEN__"
)

$ErrorActionPreference = "SilentlyContinue"
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$SubmitUrl = "$ApiBase/api/v1/system-scan/submit?token=$ScanToken"

# ============================================================
# Helpers
# ============================================================
function Write-Step { param($m) Write-Host ""
                    Write-Host "  >> $m" -ForegroundColor Cyan }
function Write-OK   { param($m) Write-Host "  [OK] $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "  [!] $m" -ForegroundColor Yellow }
function Write-Fail { param($m) Write-Host "  [X] $m" -ForegroundColor Red }
function Show-Header {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "  LAPTOP SYSTEM SCANNER" -ForegroundColor Cyan
    Write-Host "  Token: $ScanToken" -ForegroundColor DarkGray
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
}
function NZ($v, $d) { if ($null -ne $v -and [string]$v -ne "") { return $v } else { return $d } }
function ToInt($v) { try { if ($v -ne $null -and [string]$v -ne "") { return [int]$v } } catch {} return $null }
function SendPing($status) {
    try {
        Invoke-RestMethod -Uri "$SubmitUrl&status=$status" -Method Post -TimeoutSec 8 | Out-Null
    } catch {}
}
function SendResult($payload) {
    try {
        $json = $payload | ConvertTo-Json -Depth 10 -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
        Invoke-RestMethod -Uri $SubmitUrl -Method Post -Body $bytes -ContentType "application/json; charset=utf-8" -TimeoutSec 30 | Out-Null
        return $true
    } catch {
        Write-Warn "Cannot send result: $($_.Exception.Message)"
        return $false
    }
}

# ============================================================
# TOOL COMMAND HANDLING (Phase 3)
# ============================================================
# Helper: gui progress len server de UI hien thi thanh progress.
$ProgressUrl = "$ApiBase/api/v1/system-scan/progress?token=$ScanToken"
function Send-Progress {
    param(
        [string]$ToolId,
        [string]$Stage,
        [int]$Percent = 0,
        [string]$Message = "",
        [string]$ActualSha256 = "",
        [string]$VerifyStatus = ""
    )
    try {
        $body = @{
            toolId = $ToolId
            stage = $Stage
            percent = $Percent
            message = $Message
        }
        if ($ActualSha256) { $body.actualSha256 = $ActualSha256 }
        if ($VerifyStatus) { $body.verifyStatus = $VerifyStatus }
        $json = $body | ConvertTo-Json -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
        Invoke-RestMethod -Uri $ProgressUrl -Method Post -Body $bytes -ContentType "application/json; charset=utf-8" -TimeoutSec 8 | Out-Null
    } catch {}
}

# Helper: tinh SHA256 cua file.
function Get-FileSha256 {
    param([string]$Path)
    try {
        $h = [System.Security.Cryptography.SHA256]::Create()
        $stream = [System.IO.File]::OpenRead($Path)
        try { $hashBytes = $h.ComputeHash($stream) } finally { $stream.Close(); $h.Dispose() }
        return ([BitConverter]::ToString($hashBytes) -replace '-', '').ToLower()
    } catch {
        return $null
    }
}

# Helper: download file tu URL tra ve duong dan local. Bao gom progress.
function Save-FromUrl {
    param(
        [string]$Url,
        [string]$DestPath,
        [string]$ToolId
    )
    try {
        # Su dung HttpClient de co the report download progress.
        Add-Type -AssemblyName System.Net.Http -ErrorAction SilentlyContinue
        $handler = [System.Net.Http.HttpClientHandler]::new()
        $client = [System.Net.Http.HttpClient]::new($handler)
        $client.Timeout = [TimeSpan]::FromMinutes(5)
        $fullUrl = if ($Url -match "^http") { $Url } else { "$ApiBase$Url" }
        $response = $client.GetAsync($fullUrl, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
        if (-not $response.IsSuccessStatusCode) {
            throw "HTTP $($response.StatusCode)"
        }
        $totalBytes = $response.Content.Headers.ContentLength
        if (-not $totalBytes -or $totalBytes -le 0) { $totalBytes = 1 }  # tranh chia 0
        $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
        $fs = [System.IO.File]::Create($DestPath)
        $buffer = New-Object byte[] 81920
        $totalRead = 0
        $lastReported = 0
        try {
            while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                $fs.Write($buffer, 0, $read)
                $totalRead += $read
                $pct = [int](($totalRead * 100) / $totalBytes)
                if ($pct - $lastReported -ge 5 -or $pct -eq 100) {
                    Send-Progress -ToolId $ToolId -Stage "downloading" -Percent $pct -Message "Dang tai... $pct%"
                    $lastReported = $pct
                }
            }
        } finally {
            $fs.Close()
            $stream.Close()
            $client.Dispose()
        }
        return $true
    } catch {
        Write-Warn "Download failed: $($_.Exception.Message)"
        return $false
    }
}

# Helper: extract zip vao thu muc dich. Dung System.IO.Compression.
function Expand-Zip {
    param(
        [string]$ZipPath,
        [string]$DestDir
    )
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
        if (-not (Test-Path $DestDir)) { New-Item -ItemType Directory -Path $DestDir -Force | Out-Null }
        [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $DestDir)
        return $true
    } catch {
        Write-Warn "Extract failed: $($_.Exception.Message)"
        return $false
    }
}

# Ham chinh: xu ly command "launch-tool" tu server.
# Buoc:
#   1. Download tool tu downloadUrl -> %LOCALAPPDATA%\LapLap\Tools\$toolId\
#   2. Neu co sha256 -> verify SHA256, mismatch -> error
#   3. Neu extract=true -> giai nen zip
#   4. Launch exec_name voi args
function Invoke-ToolCommand {
    param($cmd)
    $toolId = $cmd.toolId
    $toolName = if ($cmd.toolName) { $cmd.toolName } else { $toolId }
    $downloadUrl = $cmd.downloadUrl
    $execName = $cmd.exec
    $args = if ($cmd.args) { $cmd.args } else { @() }
    $extract = [bool]$cmd.extract
    $expectedSha = if ($cmd.sha256) { [string]$cmd.sha256 } else { "" }
    $requiresAdmin = [bool]$cmd.requiresAdmin

    Write-Step "Launching tool: $toolName"
    # Neu tool can admin ma scanner khong co quyen -> canh bao
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($requiresAdmin -and -not $isAdmin) {
        Send-Progress -ToolId $toolId -Stage "error" -Percent 0 -Message "Can quyen Admin. Hay dong cua so va chay lai LapLap-Scanner.bat voi 'Run as administrator'."
        Write-Fail "Tool yeu cau quyen Admin. Scanner hien khong co quyen."
        return
    }

    # Thu muc cache: %LOCALAPPDATA%\LapLap\Tools\$toolId\
    $toolDir = Join-Path $env:LOCALAPPDATA "LapLap\Tools\$toolId"
    if (-not (Test-Path $toolDir)) { New-Item -ItemType Directory -Path $toolDir -Force | Out-Null }

    # Neu da co file extract san -> skip download
    $finalExec = Join-Path $toolDir $execName
    $needDownload = $true
    if (Test-Path $finalExec) {
        Write-OK "Tool da co trong cache: $toolDir"
        $needDownload = $false
    }

    if ($needDownload) {
        Send-Progress -ToolId $toolId -Stage "downloading" -Percent 0 -Message "Dang tai $toolName..."
        $zipPath = Join-Path $toolDir "$toolId.zip"
        $ok = Save-FromUrl -Url $downloadUrl -DestPath $zipPath -ToolId $toolId
        if (-not $ok) {
            Send-Progress -ToolId $toolId -Stage "error" -Percent 0 -Message "Download that bai. Kiem tra ket noi mang."
            Write-Fail "Download that bai."
            return
        }

        # Verify SHA256 neu co expected
        if ($expectedSha -and $expectedSha -ne "") {
            Send-Progress -ToolId $toolId -Stage "verifying" -Percent 50 -Message "Dang xac minh SHA256..."
            $actual = Get-FileSha256 -Path $zipPath
            if ($actual -and $actual.ToLower() -ne $expectedSha.ToLower()) {
                Send-Progress -ToolId $toolId -Stage "error" -Percent 0 -Message "SHA256 khong khop (file bi loi hoac bi thay doi)." -ActualSha256 $actual -VerifyStatus "mismatch"
                Write-Fail "SHA256 mismatch! Xoa file va thu lai."
                Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
                return
            }
            Send-Progress -ToolId $toolId -Stage "verifying" -Percent 100 -Message "SHA256 OK." -ActualSha256 $actual -VerifyStatus "ok"
        } else {
            Send-Progress -ToolId $toolId -Stage "verifying" -Percent 100 -Message "Skip verify (khong co hash)." -VerifyStatus "skipped"
        }

        # Extract zip
        Send-Progress -ToolId $toolId -Stage "extracting" -Percent 10 -Message "Dang giai nen..."
        if ($extract) {
            $extracted = Expand-Zip -ZipPath $zipPath -DestDir $toolDir
            if (-not $extracted) {
                Send-Progress -ToolId $toolId -Stage "error" -Percent 0 -Message "Giai nen that bai."
                Write-Fail "Extract that bai."
                return
            }
            # Xoa zip sau khi extract xong (tiet kiem disk)
            Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
        } else {
            # Khong extract -> rename zip -> finalExec (vi du: single exe trong zip)
            # Trong nhieu tool, zip chi chua 1 exe khong can extract
            Move-Item -Path $zipPath -Destination (Join-Path $toolDir $execName) -Force
        }
        Send-Progress -ToolId $toolId -Stage "extracting" -Percent 100 -Message "Giai nen xong."
    }

    # Launch .exe
    Send-Progress -ToolId $toolId -Stage "launching" -Percent 10 -Message "Dang mo $execName..."
    if (-not (Test-Path $finalExec)) {
        # Tim trong cac file extract duoc (co the nam trong thu muc con)
        $found = Get-ChildItem -Path $toolDir -Recurse -Filter $execName -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            $finalExec = $found.FullName
        } else {
            Send-Progress -ToolId $toolId -Stage "error" -Percent 0 -Message "Khong tim thay file thuc thi: $execName"
            Write-Fail "Khong tim thay $execName trong $toolDir"
            return
        }
    }

    try {
        # Start-Process khong blocking scanner loop
        $proc = Start-Process -FilePath $finalExec -ArgumentList $args -PassThru -ErrorAction Stop
        Write-OK "Da mo $toolName (PID $($proc.Id))"
        Send-Progress -ToolId $toolId -Stage "done" -Percent 100 -Message "Da mo thanh cong! (PID $($proc.Id))"
    } catch {
        Send-Progress -ToolId $toolId -Stage "error" -Percent 0 -Message "Khong the mo file: $($_.Exception.Message)"
        Write-Fail "Launch failed: $($_.Exception.Message)"
    }
}

# ============================================================
# MAIN SCAN
# ============================================================
Show-Header
Write-Step "Connecting to server..."
SendPing "scanning"
Write-OK "Connected. Starting scan."

# === 1. CPU ===
Write-Step "[1/7] CPU..."
try {
    $cpu = Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1
    $cpuName = NZ $cpu.Name "Unknown"
    $cpuCores = ToInt $cpu.NumberOfCores
    $cpuThreads = ToInt $cpu.NumberOfLogicalProcessors
    $cpuClock = ToInt $cpu.MaxClockSpeed
    $cpuTemp = "N/A"
    try {
        $tz = Get-CimInstance -Namespace "root/wmi" -ClassName MSAcpi_ThermalZoneTemperature | Select-Object -First 1
        if ($tz -and $tz.CurrentTemperature) {
            $cpuTemp = [string]([math]::Round(($tz.CurrentTemperature / 10) - 273.15, 1)) + " C"
        }
    } catch {}
    Write-OK "CPU: $cpuName ($cpuCores cores / $cpuThreads threads)"
} catch {
    Write-Warn "CPU scan failed: $($_.Exception.Message)"
    $cpuName = "Unknown"; $cpuCores = 0; $cpuThreads = 0; $cpuClock = 0; $cpuTemp = "N/A"
}

# === 2. GPU ===
Write-Step "[2/7] GPU..."
$gpus = @()
try {
    $gpusRaw = @(Get-CimInstance -ClassName Win32_VideoController | Where-Object { $_.Name -and $_.Name -ne "" })
    foreach ($g in $gpusRaw) {
        $vram = "N/A"
        if ($g.AdapterRAM -and $g.AdapterRAM -gt 0) {
            $vram = [math]::Round($g.AdapterRAM / 1GB, 1)
        }
        $gpus += @{
            name = NZ $g.Name "N/A"
            vram = $vram
            driver = NZ $g.DriverVersion "N/A"
            temp = "N/A"
        }
        Write-OK "GPU: $($g.Name)"
    }
} catch {
    Write-Warn "GPU scan failed: $($_.Exception.Message)"
}

# === 3. RAM ===
Write-Step "[3/7] RAM..."
$ram = @()
$ramTotal = 0
$ramType = "N/A"
$ramSpeed = "N/A"
$ramSlots = 0
$ramUsed = 0
$ramMaxUp = "N/A"
$ramModules = @()
try {
    $ram = @(Get-CimInstance -ClassName Win32_PhysicalMemory)
    $ramArray = Get-CimInstance -ClassName Win32_PhysicalMemoryArray | Select-Object -First 1
    if ($ram) { $ramTotal = [math]::Round((($ram | Measure-Object -Property Capacity -Sum).Sum / 1GB), 1) }

    $memTypeMap = @{ 20 = "DDR"; 21 = "DDR2"; 24 = "DDR3"; 26 = "DDR4"; 34 = "DDR5" }
    if ($ram -and $ram[0].SMBIOSMemoryType -and $memTypeMap.ContainsKey([int]$ram[0].SMBIOSMemoryType)) {
        $ramType = $memTypeMap[[int]$ram[0].SMBIOSMemoryType]
    }
    if ($ram -and $ram[0].Speed) { $ramSpeed = [int]$ram[0].Speed }

    foreach ($m in $ram) {
        $mType = "N/A"
        if ($m.SMBIOSMemoryType -and $memTypeMap.ContainsKey([int]$m.SMBIOSMemoryType)) {
            $mType = $memTypeMap[[int]$m.SMBIOSMemoryType]
        } else {
            if ($m.Speed) {
                $sp = [int]$m.Speed
                if ($sp -ge 4000) { $mType = "DDR5" } else {
                    if ($sp -ge 1600) { $mType = "DDR4" } else {
                        if ($sp -ge 800) { $mType = "DDR3" }
                    }
                }
            }
        }
        $slotName = (NZ $m.BankLabel "") + " / " + (NZ $m.DeviceLocator "")
        $slotName = $slotName.Trim(" /")
        if (-not $slotName) { $slotName = "N/A" }
        $ramModules += @{
            slot = $slotName
            capacity = [math]::Round($m.Capacity / 1GB, 0)
            manufacturer = NZ ([string]$m.Manufacturer).Trim() "N/A"
            type = $mType
            speed = if ($m.Speed) { [string][int]$m.Speed + " MHz" } else { "N/A" }
            partNumber = NZ ([string]$m.PartNumber).Trim() "N/A"
        }
    }
    if ($ramArray -and $ramArray.MemoryDevices) { $ramSlots = [int]$ramArray.MemoryDevices } else { $ramSlots = $ram.Count }
    $ramUsed = $ram.Count
    if ($ramArray -and $ramArray.MaxCapacity) { $ramMaxUp = [string]([math]::Round($ramArray.MaxCapacity / 1MB, 0)) + " GB" }
    Write-OK "RAM: $ramTotal GB $ramType ($ramUsed/$ramSlots slots)"
} catch {
    Write-Warn "RAM scan failed: $($_.Exception.Message)"
}

# === 4. Storage (WMI + smartctl fallback) ===
Write-Step "[4/7] Storage..."
$storageArr = @()
try {
    $disks = @(Get-CimInstance -ClassName Win32_DiskDrive)
    $phys = @()
    try { $phys = @(Get-PhysicalDisk -ErrorAction SilentlyContinue) } catch {}
    $logical = @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=3")
    $freeTotal = 0
    if ($logical) {
        $freeTotal = ($logical | Measure-Object -Property FreeSpace -Sum).Sum / 1GB
    }

    # === Smartctl setup ===
    # Luong:
    #   1. Check $LocalAppData\LapLap\smartctl\smartctl.exe (cache tu lan truoc).
    #   2. Neu chua co -> download smartctl.exe TRUC TIEP tu R2 (khong qua ZIP).
    #   3. Neu download fail -> skip smartctl, chi dung WMI.
    #   4. Neu smartctl chay (admin) -> them SMART chi tiet (wear, reallocated, ...).
    #   5. Neu khong admin -> smartctl fail, fallback WMI.
    $smartctlPath = $null
    $smartctlAvail = $false
    try {
        $cacheDir = Join-Path $env:LOCALAPPDATA "LapLap\smartctl"
        $cachedExe = Join-Path $cacheDir "smartctl.exe"
        if (Test-Path $cachedExe) {
            $smartctlPath = $cachedExe
            $smartctlAvail = $true
            Write-Step "  [smartctl] Using cached binary: $smartctlPath"
        } else {
            Write-Step "  [smartctl] Downloading from server..."
            # Tao thu muc cache neu chua co
            if (-not (Test-Path $cacheDir)) {
                New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
            }
            $exePath = Join-Path $cacheDir "smartctl.exe"
            try {
                $dlUrl = "$ApiBase/api/v1/system-scan/download-smartctl?token=$ScanToken"
                # Download truc tiep .exe (server tu R2 hoac fallback sourceforge)
                Invoke-WebRequest -Uri $dlUrl -OutFile $exePath -TimeoutSec 60 -UseBasicParsing -ErrorAction Stop | Out-Null
                if (Test-Path $exePath) {
                    $size = (Get-Item $exePath).Length
                    # Verify: smartctl.exe Windows > 1MB (binary signed, thuong ~1.7MB)
                    if ($size -gt 500000) {
                        $smartctlPath = $exePath
                        $smartctlAvail = $true
                        Write-OK "  [smartctl] Downloaded and cached at $smartctlPath ($size bytes)"
                    } else {
                        Write-Warn "  [smartctl] Downloaded file too small ($size bytes), deleting"
                        Remove-Item $exePath -Force -ErrorAction SilentlyContinue
                    }
                }
            } catch {
                Write-Warn "  [smartctl] Download failed: $($_.Exception.Message)"
                # Cleanup partial file
                if (Test-Path $exePath) {
                    Remove-Item $exePath -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {
        Write-Warn "  [smartctl] Setup failed: $($_.Exception.Message)"
    }

    # === Ham parse output smartctl ===
    # Output dang:
    #   === START OF INFORMATION SECTION ===
    #   Model Family:     Crucial/Micron...
    #   Device Model:     CT500P3PSSD8
    #   Serial Number:    ...
    #   ...
    #   === START OF READ SMART DATA SECTION ===
    #   SMART Attributes Data Structure revision number: 1
    #   SMART Attributes with Thresholds:
    #   ID# ATTRIBUTE_NAME          FLAG    VALUE WORST THRESH TYPE     RAW_VALUE
    #     5 Reallocated_Sector_Ct   0x0033  100   100   010    Pre-fail  0
    #   ...
    function Parse-SmartCtlOutput {
        param([string]$Output, [string]$DevicePath)
        $result = @{
            modelFamily = $null
            serial = $null
            temperature = $null
            powerOnHours = $null
            reallocated = $null
            pending = $null
            wearLevel = $null
            criticalWarning = $null
            smartStatus = $null
            rotationRate = $null
        }
        if (-not $Output) { return $result }

        # Status (PASSED / FAILED!)
        # SSD/HDD (smartctl -A): "SMART overall-health self-assessment test result: PASSED"
        # NVMe (smartctl -A): KHONG CO dong nay, nhung Critical Warning: 0x00 = OK
        # Mac dinh: neu co Critical Warning: 0x00 -> PASSED
        if ($Output -match "SMART overall-health self-assessment test result:\s*(\w+)") {
            $result.smartStatus = $matches[1]
        } else {
            if ($Output -match "SMART Status:\s*(\w+)") {
                $result.smartStatus = $matches[1]
            } else {
                if ($Output -match "Critical Warning:\s*0x00") {
                    $result.smartStatus = "PASSED"
                } else {
                    if ($Output -match "Critical Warning:\s*0x(?!00)[0-9a-fA-F]+") {
                        $result.smartStatus = "WARNING"
                    }
                }
            }
        }

        # Model family
        if ($Output -match "Model Family:\s*(.+)") {
            $result.modelFamily = $matches[1].Trim()
        }

        # Serial
        if ($Output -match "Serial Number:\s*(.+)") {
            $result.serial = $matches[1].Trim()
        } else {
            if ($Output -match "Serial number:\s*(.+)") {
                $result.serial = $matches[1].Trim()
            }
        }

        # Temperature
        # Uu tien NVMe: "Temperature: 44 Celsius" (Tron dong dau tien cua SMART/Health)
        # Output thuc te NVMe co 2 dong:
        #   Temperature:                        44 Celsius          ← composite (sd dung)
        #   Temperature Sensor 1:               44 Celsius          ← sensor 1
        # Lay dong DONG SO 1 (composite), tranh lay nham sensor 2
        if ($Output -match "(?m)^Temperature:\s+(\d+)\s+Celsius") {
            $result.temperature = [int]$matches[1]
        } else {
            # NVMe alternative: "Current Temperature: X Celsius"
            if ($Output -match "Current Temperature:\s*(\d+)\s*Celsius") {
                $result.temperature = [int]$matches[1]
            } else {
                # HDD/SSD: ID 194 Temperature_Celsius (co dang: "194 Temperature_Celsius 0x0002 064 050 000 Old_age Always - 36 (Min/Max 18/50)")
                # Co the co (Min/Max ...) theo sau nen chi can word boundary
                if ($Output -match "Temperature_Celsius\s+0x\w+\s+\d+\s+\d+\s+\d+\s+\S+\s+\S+\s+\S?\s*(\d+)\b") {
                    $result.temperature = [int]$matches[1]
                }
            }
        }

        # Power on hours (ID 9 HDD, hoac NVMe "Power On Hours")
        # HDD: "9 Power_On_Hours 0x0032 100 100 000 Old_age Always - 9481"
        # NVMe: "Power On Hours:                     1,608"  (CO DAU PHAY!)
        # Dung (?m) multiline de $ khop cuoi dong, khong phai cuoi string
        if ($Output -match "(?m)^Power On Hours:\s+([\d,]+)") {
            $result.powerOnHours = [int]($matches[1] -replace ',', '')
        } else {
            if ($Output -match "(?m)Power_On_Hours\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S?\s*(\d+)\s*$") {
                $result.powerOnHours = [int]$matches[1]
            }
        }

        # Reallocated sectors (ID 5)
        # HDD: "  5 Reallocated_Sector_Ct   0x0033   252   252   010    Pre-fail  Always       -       0"
        if ($Output -match "Reallocated_Sector_Ct\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S?\s*(\d+)\r?\s*$") {
            $result.reallocated = [int]$matches[1]
        } else {
            # NVMe: Media and Data Integrity Errors (RAW ngay sau dấu :)
            if ($Output -match "Media and Data Integrity Errors:\s+(\d+)") {
                $result.reallocated = [int]$matches[1]
            }
        }

        # Pending sectors (ID 197)
        # HDD: "197 Current_Pending_Sector  0x0012   100   100   000    Old_age   Always       -       0"
        if ($Output -match "Current_Pending_Sector\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S?\s*(\d+)\r?\s*$") {
            $result.pending = [int]$matches[1]
        } else {
            # NVMe: Error Information Log Entries
            if ($Output -match "Error Information Log Entries:\s+(\d+)") {
                $result.pending = [int]$matches[1]
            }
        }

        # Wear level
        # NVMe: Percentage Used = X (thuong <100)
        # Lay Percentage Used DONG DAU TIEN (dong chinh, tranh nam nhầm trong attribute table)
        if ($Output -match "(?m)^Percentage Used:\s+(\d+)%") {
            $wear = [int]$matches[1]
            # Percentage Used = % da su dung -> wear level con lai = 100 - X
            $result.wearLevel = 100 - $wear
        } else {
            # SSD: Media_Wearout_Indicator (ID 233) gia tri 100 = moi
            if ($Output -match "Media_Wearout_Indicator\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S?\s*(\d+)\r?\s*$") {
                $result.wearLevel = [int]$matches[1]
            } else {
                # SSD: Wear_Leveling_Count (ID 177) gia tri 100 = moi
                if ($Output -match "Wear_Leveling_Count\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S?\s*(\d+)\r?\s*$") {
                    $result.wearLevel = [int]$matches[1]
                }
            }
        }

        # NVMe critical warning byte
        if ($Output -match "Critical Warning:\s*(\d+)") {
            $result.criticalWarning = [int]$matches[1]
        }

        # Rotation rate (HDD RPM)
        if ($Output -match "Rotation Rate:\s*(\d+)\s*rpm") {
            $result.rotationRate = [int]$matches[1]
        } else {
            if ($Output -match "Nominal Media Rotation Rate:\s*(\d+)") {
                $result.rotationRate = [int]$matches[1]
            }
        }

        return $result
    }

    # ============================================================
    # WMI SMART (no admin required)
    # ============================================================
    # Nguon thu 2 doc SMART: WMI class MSStorageDriver_ATAPISmartData va
    # MSStorageDriver_FailurePredictStatus. Uu diem:
    #   - KHONG can admin (chi can user).
    #   - Cung cap "PredictFailure" (True/False) -> nhanh biet o sap hong.
    #   - Raw bytes hex -> parse duoc Reallocated (ID 5), Pending (ID 197),
    #     Wear Level (ID 177/233), Power On Hours (ID 9), Temperature (ID 194).
    #
    # Nhuoc diem:
    #   - Chi lay duoc attributes (khong co model_family, RPM, NVMe health).
    #   - NVMe khong co MSStorageDriver_ATAPISmartData (chi co cho ATA/SATA).
    #   - Raw bytes chi co 512 byte, chi lay duoc VendorSpecific (0x94-0x199).
    #
    # Luong parse:
    #   1. Lay raw 512 bytes hex tu WMI.
    #   2. Cat 2 bytes (VendorSpecific[0..1]) de lay so attribute (little-endian).
    #   3. Moi attribute = 12 bytes:
    #      [0]     ID
    #      [1..2]  Status + flags (trong raw bytes la RAW_VALUE little-endian)
    #   Thuc te WMI raw bytes cua MSStorageDriver_ATAPISmartData co cau truc:
    #     Bytes 0..1:  Revision number (2 bytes)
    #     Bytes 2..361: 30 attributes x 12 bytes:
    #       [0]       ID
    #       [1..2]    Status (bit 0..1) + flags (bit 2..15)
    #       [3]       Current value
    #       [4]       Worst value
    #       [5]       Threshold (hoac 0 neu khong co)
    #       [6..11]   RAW_VALUE (6 bytes, little-endian)
    #   Trong do RAW_VALUE o day la "VendorSpecific" nen co the la gia tri
    #   RAW (reallocated) hoac gia tri VALUE tuong ung (255 = moi).
    #
    # De don gian em chi parse cac ID quan trong va lay gia tri raw 6 bytes
    # -> doi sang uint64 little-endian.
    function Read-WmiSmartData {
        param([string]$DeviceIndex)
        $result = @{
            available = $false
            reallocated = $null
            pending = $null
            wearLevel = $null
            powerOnHours = $null
            temperature = $null
            modelFamily = $null
            serial = $null
            reason = $null
            predictFailure = $null
        }
        try {
            # Lay instance tuong ung (tren Windows, Index cua Win32_DiskDrive
            # tuong ung voi InstanceName cua MSStorageDriver_ATAPISmartData).
            # Vi du: Index 0 -> InstanceName chua "0" trong path.
            $instances = @(Get-CimInstance -Namespace "root/wmi" -ClassName MSStorageDriver_ATAPISmartData -ErrorAction SilentlyContinue)
            if ($instances.Count -eq 0) { return $result }
            # Chon instance dau tien (tren may 1 disk); neu nhieu hon -> match theo index.
            $smart = $null
            if ($instances.Count -eq 1) {
                $smart = $instances[0]
            } else {
                # Thu match theo InstanceName co chua "Path($index,0)"
                $smart = $instances | Where-Object { $_.InstanceName -match "Path\(0,*$DeviceIndex\)" } | Select-Object -First 1
                if (-not $smart) { $smart = $instances | Select-Object -First 1 }
            }
            if (-not $smart) { return $result }

            # vendorSpecific la 512 byte mang byte[]
            $vs = $smart.vendorSpecific
            if (-not $vs -or $vs.Length -lt 362) { return $result }

            # Doc 30 attributes (bytes 2..361)
            $attrs = @{}
            for ($i = 0; $i -lt 30; $i++) {
                $base = 2 + ($i * 12)
                if ($base + 11 -ge $vs.Length) { break }
                $id = [int]$vs[$base]
                if ($id -eq 0) { continue }
                # RAW_VALUE: 6 bytes little-endian
                $raw = 0
                for ($b = 0; $b -lt 6; $b++) {
                    $raw = $raw -bor ([int64]$vs[$base + 6 + $b] -shl ($b * 8))
                }
                # Current value (95 = sap loi, 100 = khoe)
                $cur = [int]$vs[$base + 3]
                $attrs[$id] = @{ raw = $raw; current = $cur }
            }

            $result.available = $true
            # ID 5 = Reallocated_Sector_Ct
            if ($attrs.ContainsKey(5)) { $result.reallocated = [int]$attrs[5].raw }
            # ID 9 = Power_On_Hours
            if ($attrs.ContainsKey(9)) { $result.powerOnHours = [int]$attrs[9].raw }
            # ID 177 = Wear_Leveling_Count
            if ($attrs.ContainsKey(177)) { $result.wearLevel = [int]$attrs[177].current }
            # ID 187 = Reported_Uncorrectable_Errors
            if ($attrs.ContainsKey(187)) { $result.pending = [int]$attrs[187].raw }
            # ID 194 = Temperature_Celsius
            if ($attrs.ContainsKey(194)) { $result.temperature = [int]$attrs[194].raw }
            # ID 197 = Current_Pending_Sector
            if ($attrs.ContainsKey(197)) { $result.pending = [int]$attrs[197].raw }
            # ID 199 = UDMA_CRC_Error_Count (cable issue)
            # ID 233 = Media_Wearout_Indicator (Intel SSD)
            if ($attrs.ContainsKey(233)) { $result.wearLevel = [int]$attrs[233].current }

            # FailurePredictStatus (PredictFailure=True -> o sap hong)
            if ($smart.GetType().GetProperty("PredictFailure")) {
                $result.predictFailure = [bool]$smart.PredictFailure
            }
            if ($smart.GetType().GetProperty("Reason")) {
                $result.reason = [int]$smart.Reason
            }
        } catch {
            Write-Warn "  WMI SMART read failed (Index $DeviceIndex): $($_.Exception.Message)"
        }
        return $result
    }

    # ============================================================
    # (KHONG tinh diem suc khoe - chi de user tu danh gia raw data
    # tu cac nguon: smartctl, WMI SMART, WMI PredictFailure)
    # ============================================================

    # === BUOC 0.5: CDI (CrystalDiskInfo DLL binding) ===
    # Doc SMART/AtaSmart nhu CrystalDiskInfo GUI: ro rang, khong phai minh parse.
    # DLL: ftyszyx/CrystalDiskInfo_dll_lib v1.0.1 (MIT) - dong goi toan bo logic
    # CDI goc. Admin moi doc duoc (goi IOCTL).
    $cdiLoaded = $false
    $cdiPtr = [IntPtr]::Zero
    try {
        $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
        $dllUrl = "$ApiBase/api/v1/system-scan/download-cdi?arch=$arch"
        $cdiDir = Join-Path $env:TEMP "laplap-cdi"
        if (-not (Test-Path $cdiDir)) { New-Item -ItemType Directory -Path $cdiDir -Force | Out-Null }
        $dllPath = Join-Path $cdiDir "CDI_$arch.dll"
        if (-not (Test-Path $dllPath)) {
            try {
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                Invoke-WebRequest -Uri $dllUrl -OutFile $dllPath -UseBasicParsing -TimeoutSec 60
            } catch {
                Write-Warn "  [CDI] download DLL failed: $($_.Exception.Message)"
            }
        }
        if (Test-Path $dllPath) {
            $cdiSrc = @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
public struct CdiSmartInfo {
    public Int32 PhysicalDriveId; public Int32 ScsiPort; public Int32 ScsiTargetId; public Int32 ScsiBus;
    public Int32 SiliconImageType;
    public UInt32 TotalDiskSize; public UInt32 Cylinder; public UInt32 Head; public UInt32 Sector; public UInt32 Sector28;
    public UInt64 Sector48; public UInt64 NumberOfSectors;
    public UInt32 DiskSizeChs; public UInt32 DiskSizeLba28; public UInt32 DiskSizeLba48;
    public UInt32 LogicalSectorSize; public UInt32 PhysicalSectorSize;
    public UInt32 DiskSizeWmi; public UInt32 BufferSize; public UInt64 NvCacheSize;
    public UInt32 TransferModeType; public UInt32 DetectedTimeUnitType; public UInt32 MeasuredTimeUnitType; public UInt32 AttributeCount;
    public Int32 DetectedPowerOnHours; public Int32 MeasuredPowerOnHours;
    public Int32 PowerOnRawValue; public Int32 PowerOnStartRawValue; public UInt32 PowerOnCount;
    public Int32 Temperature; public double TemperatureMultiplier;
    public UInt32 NominalMediaRotationRate;
    public Int32 HostWrites; public Int32 HostReads;
    public Int32 GBytesErased; public Int32 NandWrites;
    public Int32 WearLevelingCount; public Int32 Life;
    public UInt32 Major; public UInt32 Minor; public UInt32 DiskStatus; public UInt32 DriveLetterMap;
    public Int32 AlarmTemperature;
    public UInt32 DiskVendorId; public UInt32 UsbVendorId; public UInt32 UsbProductId;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string SerialNumber;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string SerialNumberReverse;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string FirmwareRev;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string FirmwareRevReverse;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string Model;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string ModelReverse;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string ModelWmi;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string ModelSerial;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string DriveMap;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string MaxTransferMode;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string CurrentTransferMode;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string MajorVersion;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string MinorVersion;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string Interface;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string Enclosure;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string CommandTypeString;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string SsdVendorString;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string DeviceNominalFormFactor;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string PnpDeviceId;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=512)] public string SmartKeyName;
}

public static class CDI {
    public const string DLL = "$($dllPath -replace '\\','\\\\')";

    [DllImport(DLL, EntryPoint="CreateAtaSmart", CallingConvention=CallingConvention.Cdecl)]
    public static extern IntPtr CreateAtaSmart();

    [DllImport(DLL, CharSet=CharSet.Auto)]
    public static extern void DestroyAtaSmart(IntPtr ptr);

    [DllImport(DLL, CharSet=CharSet.Auto)]
    public static extern void InitAtaSmart(IntPtr ptr,
        bool useWmi, bool advancedDiskSearch,
        bool workaroundHD204UI, bool workaroundAdataSsd,
        bool flagHideNoSmartDisk, bool flagSortDriveLetter);

    [DllImport(DLL, CharSet=CharSet.Auto)]
    public static extern int GetDiskCount(IntPtr ptr);

    [DllImport(DLL, CharSet=CharSet.Auto)]
    public static extern bool GetDiskInfo(IntPtr ptr, int index, ref CdiSmartInfo info);

    [DllImport(DLL, CharSet=CharSet.Auto)]
    public static extern IntPtr GetModel(IntPtr ptr, int index);

    [DllImport(DLL, CharSet=CharSet.Auto)]
    public static extern IntPtr GetSerialNumber(IntPtr ptr, int index);

    [DllImport(DLL, CharSet=CharSet.Auto)]
    public static extern IntPtr GetDrivemap(IntPtr ptr, int index);
}
"@
            Add-Type -TypeDefinition $cdiSrc -Language CSharp -ErrorAction SilentlyContinue
            $cdiPtr = [CDI]::CreateAtaSmart()
            if ($cdiPtr -ne [IntPtr]::Zero) {
                # Init: useWmi=$true, advancedDiskSearch=$false, workaroundHD204UI=$false,
                # workaroundAdataSsd=$false, flagHideNoSmartDisk=$true, flagSortDriveLetter=$true
                [CDI]::InitAtaSmart($cdiPtr, $true, $false, $false, $false, $true, $true)
                $cdiLoaded = $true
                Write-Step "  [CDI] DLL OK - CrystalDiskInfo bound ($arch)"
            } else {
                Write-Warn "  [CDI] CreateAtaSmart returned null (can Administrator?)"
            }
        }
    } catch {
        Write-Warn "  [CDI] bind failed: $($_.Exception.Message) (can chay voi quyen Admin)"
    }

    # Match CDI index -> Win32_DiskDrive index theo SerialNumber.
    # CDI tra ve index 0..N-1 theo thu tu CDI quet; WMI quet theo thu tu khac.
    # Cach ghep: model+serial -> cdiIndex.
    $cdiBySerial = @{}
    $cdiByModel = @{}
    if ($cdiLoaded) {
        try {
            $cdiCount = [CDI]::GetDiskCount($cdiPtr)
            for ($i = 0; $i -lt $cdiCount; $i++) {
                $cdiInfo = New-Object CdiSmartInfo
                if ([CDI]::GetDiskInfo($cdiPtr, $i, [ref]$cdiInfo)) {
                    $serial = if ($cdiInfo.SerialNumber) { $cdiInfo.SerialNumber.Trim() } else { "" }
                    $model = if ($cdiInfo.Model) { $cdiInfo.Model.Trim() } else { "" }
                    if ($serial) { $cdiBySerial[$serial] = $cdiInfo }
                    if ($model -and -not $cdiByModel.ContainsKey($model)) { $cdiByModel[$model] = $cdiInfo }
                }
            }
            Write-Step "  [CDI] indexed $($cdiBySerial.Count) disk(s) by serial"
        } catch {
            Write-Warn "  [CDI] enum failed: $($_.Exception.Message)"
        }
    }

    foreach ($d in $disks) {
        $dtype = "N/A"
        $pd = $phys | Where-Object { $_.DeviceId -eq $d.Index -or $_.FriendlyName -eq $d.Model } | Select-Object -First 1
        $bus = if ($pd) { [string]$pd.BusType } else { "" }
        $media = if ($pd) { [string]$pd.MediaType } else { "" }
        # Lay Disk Number (dung de map qua /dev/sdX). Get-Disk Number bat dau tu 0.
        # Win32_DiskDrive cung co Index bat dau tu 0.
        $diskNum = if ($null -ne $d.Index) { [int]$d.Index } else { 0 }
        # Win32_DiskDrive.InterfaceType gom: "IDE", "SCSI", "NVMe", "USB", "SATA".
        # Quan trong: Windows report NHIEU NVMe SSD co InterfaceType="SCSI" (quirk Windows),
        # nen phai check PNPDeviceID de xac dinh NVMe chinh xac:
        #   NVMe SSD:  "...VEN_NVME&PROD_*"
        #   HDD/SATA:  "...VEN_&PROD_*" (khong co NVMe trong VEN_)
        $iface = if ($null -ne $d.InterfaceType) { [string]$d.InterfaceType } else { "" }
        $pnp = if ($null -ne $d.PNPDeviceID) { [string]$d.PNPDeviceID } else { "" }
        $isNvmeByPnp = $pnp -match "VEN_NVME"
        # Co che USB NVMe: neu Model co "USB" hoac busType = USB, su dung sntrealtek
        $isUsb = ($bus -eq "USB") -or ($iface -eq "USB") -or ($d.Model -match "USB")
        # Phan loai o dia theo WMI BusType, InterfaceType, PNPDeviceID hoac Model (PowerShell-friendly, single-line)
        $dtype = "N/A"
        # NVMe: check InterfaceType (NVMe) hoac BusType (NVMe) hoac PNPDeviceID (VEN_NVME)
        # hoac Model co chu NVMe. Mot so SSD NVMe co model khong co chu "NVMe"
        # (vd: "CT500P3PSSD8" Crucial P3 Plus) nen PNPDeviceID la nguon chinh xac nhat.
        $isNvme = ($iface -eq "NVMe") -or ($bus -eq "NVMe") -or $isNvmeByPnp -or ($d.Model -like "*NVMe*")
        $isUsb = ($bus -eq "USB") -or ($iface -eq "USB") -or ($d.Model -match "USB")
        # SSD: WMI MediaType="SSD" hoac InterfaceType="SCSI"/"SATA" + Model co SSD.
        # KHONG dem HDD la SSD: HDD thuong co MediaType="HDD" hoac "Unspecified" (Windows cu)
        # hoac Model co ST/WD/WDC/Toshiba... (heuristic fallback khi khong co admin).
        $isSsd = ($media -eq "SSD") -or ($d.Model -like "*SSD*")
        # HDD: MediaType="HDD" hoac InterfaceType="IDE" hoac model HDD classic.
        # Windows 10/11 tra MediaType="Unspecified" cho nhieu HDD cu, nen can check InterfaceType.
        # Heuristic model: Seagate (ST*), WDC/WD (WDC*, WD*), Hitachi (HUA*), Toshiba (TOSHIBA/MK*)
        $modelLooksHdd = ($d.Model -match "^ST\d") -or ($d.Model -match "WDC\b") -or ($d.Model -match "^WD[A-Z]") -or ($d.Model -match "TOSHIBA") -or ($d.Model -match "Hitachi")
        $isHdd = ($media -eq "HDD") -or ($iface -eq "IDE") -or (($iface -eq "SCSI") -and $modelLooksHdd)
        if ($isNvme -and $isUsb) { $dtype = "USB NVMe" }
        if ($isNvme -and -not $isUsb) { $dtype = "NVMe SSD" }
        if ($isSsd -and -not $isNvme) { $dtype = "SATA SSD" }
        if ($isHdd -and -not $isNvme -and -not $isSsd) { $dtype = "HDD" }
        # Fallback: neu khong phan loai duoc nhung co InterfaceType (vd: "SCSI" generic)
        if ($dtype -eq "N/A" -and $bus -ne "") { $dtype = $bus }
        if ($dtype -eq "N/A" -and $iface -ne "" -and $iface -ne "SCSI") { $dtype = $iface }
        $sizeGB = if ($d.Size -gt 0) { [math]::Round($d.Size / 1GB, 1) } else { "N/A" }

        # Khoi tao SMART data = "N/A" (mac dinh khong co)
        $entry = @{
            name = NZ $d.Model "Unknown"
            capacity = $sizeGB
            type = $dtype
            free = [math]::Round($freeTotal, 1)
            temp = "N/A"
            health = "N/A"
            performance = "N/A"
            powerOnTime = "N/A"
            status = "N/A"
            source = "WMI"
            reallocated = $null
            pending = $null
            wearLevel = $null
            criticalWarning = $null
            rotationRate = $null
            modelFamily = $null
            smartSerial = $null
            # WMI SMART (no admin)
            wmiPredictFailure = $null
            wmiReason = $null
            wmiReallocated = $null
            wmiPending = $null
            wmiWearLevel = $null
            wmiPowerOnHours = $null
            wmiTemp = $null
            # CDI (CrystalDiskInfo) — can Admin, lay duoc NHIEU hon smartctl
            cdiAvailable = $false
            cdiModel = $null
            cdiSerial = $null
            cdiFirmware = $null
            cdiInterface = $null
            cdiFormFactor = $null
            cdiSsdVendor = $null
            cdiDriveMap = $null
            cdiRotationRate = $null
            cdiTemperature = $null
            cdiPowerOnHours = $null
            cdiPowerOnCount = $null
            cdiLife = $null               # NVMe % Used
            cdiWearLevel = $null          # SSD 0-100
            cdiHostWrites = $null         # SSD GB da ghi
            cdiHostReads = $null          # SSD GB da doc
            cdiTransferMode = $null
            cdiAlarmTemp = $null
            cdiDiskStatus = $null
            # Debug info: luu ly do neu scan fail, hien thi len UI
            debug = $null
            debug = $null
        }

        # === BUOC 0: Doc CDI (CrystalDiskInfo) neu co the - uu tien cao nhat ===
        # Ghep theo SerialNumber (chinh xac) hoac Model (fallback).
        if ($cdiLoaded) {
            try {
                $cdiInfo = $null
                $wmiSerial = ""
                try {
                    $pdid = Get-CimInstance -Class Win32_DiskDrive | Where-Object { $_.Index -eq $diskNum } | Select-Object -First 1
                    if ($pdid) { $wmiSerial = [string]$pdid.SerialNumber }
                } catch {}
                if ($wmiSerial -and $cdiBySerial.ContainsKey($wmiSerial)) {
                    $cdiInfo = $cdiBySerial[$wmiSerial]
                } elseif ($cdiByModel.ContainsKey($entry.name)) {
                    $cdiInfo = $cdiByModel[$entry.name]
                }
                if ($cdiInfo) {
                    $entry.cdiAvailable = $true
                    $entry.cdiModel = if ($cdiInfo.Model) { $cdiInfo.Model.Trim() } else { $null }
                    $entry.cdiSerial = if ($cdiInfo.SerialNumber) { $cdiInfo.SerialNumber.Trim() } else { $null }
                    $entry.cdiFirmware = if ($cdiInfo.FirmwareRev) { $cdiInfo.FirmwareRev.Trim() } else { $null }
                    $entry.cdiInterface = if ($cdiInfo.Interface) { $cdiInfo.Interface.Trim() } else { $null }
                    $entry.cdiFormFactor = if ($cdiInfo.DeviceNominalFormFactor) { $cdiInfo.DeviceNominalFormFactor.Trim() } else { $null }
                    $entry.cdiSsdVendor = if ($cdiInfo.SsdVendorString) { $cdiInfo.SsdVendorString.Trim() } else { $null }
                    $entry.cdiDriveMap = if ($cdiInfo.DriveMap) { $cdiInfo.DriveMap.Trim() } else { $null }
                    $entry.cdiTransferMode = if ($cdiInfo.CurrentTransferMode) { $cdiInfo.CurrentTransferMode.Trim() } else { $null }
                    if ($cdiInfo.NominalMediaRotationRate -gt 0) { $entry.cdiRotationRate = [int]$cdiInfo.NominalMediaRotationRate }
                    if ($cdiInfo.Temperature -gt 0) { $entry.cdiTemperature = [int]$cdiInfo.Temperature }
                    if ($cdiInfo.MeasuredPowerOnHours -gt 0) { $entry.cdiPowerOnHours = [int]$cdiInfo.MeasuredPowerOnHours } elseif ($cdiInfo.DetectedPowerOnHours -gt 0) { $entry.cdiPowerOnHours = [int]$cdiInfo.DetectedPowerOnHours }
                    if ($cdiInfo.PowerOnCount -gt 0) { $entry.cdiPowerOnCount = [int]$cdiInfo.PowerOnCount }
                    if ($cdiInfo.Life -ge 0 -and $cdiInfo.Life -le 100) { $entry.cdiLife = [int]$cdiInfo.Life }
                    if ($cdiInfo.WearLevelingCount -ge 0 -and $cdiInfo.WearLevelingCount -le 100) { $entry.cdiWearLevel = [int]$cdiInfo.WearLevelingCount }
                    if ($cdiInfo.HostWrites -gt 0) { $entry.cdiHostWrites = [int]$cdiInfo.HostWrites }
                    if ($cdiInfo.HostReads -gt 0) { $entry.cdiHostReads = [int]$cdiInfo.HostReads }
                    if ($cdiInfo.AlarmTemperature -gt 0) { $entry.cdiAlarmTemp = [int]$cdiInfo.AlarmTemperature }
                    if ($null -ne $cdiInfo.DiskStatus) { $entry.cdiDiskStatus = [int]$cdiInfo.DiskStatus }
                    Write-Step "  [CDI] $($entry.name): Temp=$($entry.cdiTemperature) PoH=$($entry.cdiPowerOnHours) Life=$($entry.cdiLife)% Interface=$($entry.cdiInterface)"
                } else {
                    Write-Warn "  [CDI] khong match disk $diskNum (model=$($entry.name), serial=$wmiSerial)"
                }
            } catch {
                Write-Warn "  [CDI] lookup exception: $($_.Exception.Message)"
            }
        }

        # === BUOC 1: Doc WMI SMART (always, no admin) ===
        # Uu tien thap hon smartctl nhung khong can quyen admin.
        try {
            $wmi = Read-WmiSmartData -DeviceIndex $diskNum
            if ($wmi.available) {
                Write-Step "  [WMI SMART] Index $($diskNum): read OK"
                if ($null -ne $wmi.reallocated) { $entry.wmiReallocated = [int]$wmi.reallocated }
                if ($null -ne $wmi.pending) { $entry.wmiPending = [int]$wmi.pending }
                if ($null -ne $wmi.wearLevel) { $entry.wmiWearLevel = [int]$wmi.wearLevel }
                if ($null -ne $wmi.powerOnHours) { $entry.wmiPowerOnHours = [int]$wmi.powerOnHours }
                if ($null -ne $wmi.temperature) { $entry.wmiTemp = [int]$wmi.temperature }
                if ($null -ne $wmi.predictFailure) { $entry.wmiPredictFailure = [bool]$wmi.predictFailure }
                if ($null -ne $wmi.reason) { $entry.wmiReason = [int]$wmi.reason }
                # KHONG tinh diem - chi giu raw data de user tu danh gia
            } else {
                Write-Warn "  [WMI SMART] Index $($diskNum): khong co MSStorageDriver_ATAPISmartData (NVMe hoac chua enable SMART)"
            }
        } catch {
            Write-Warn "  [WMI SMART] exception: $($_.Exception.Message)"
        }

        # === Thu chay smartctl cho tung o ===
        # smartctl.exe -A /dev/sda -d ata  (HDD/SATA SSD)
        # smartctl.exe -A /dev/sdb -d nvme  (NVMe)
        if ($smartctlAvail -and $smartctlPath) {
            try {
                # QUAN TRONG: Get-Disk Number bat dau tu 0 (vd: Disk 0 = /dev/sda, Disk 1 = /dev/sdb)
                # $diskNum da duoc set o ngoai foreach, day chi dung lai.
                $deviceArg = "/dev/sd$([char](97 + $diskNum))"

                # Xac dinh loai o de chon driver -d nao (PowerShell-friendly, khong dung elseif nhieu cap)
                # Quy tac:
                #   - BusType = NVMe: -d nvme
                #   - BusType = USB: -d sntrealtek (Realtek USB-NVMe bridge)
                #   - Con lai (HDD/SATA SSD): -d ata
                $typeArg = "ata"
                if ($bus -eq "NVMe") { $typeArg = "nvme" }
                if ($bus -eq "USB") { $typeArg = "sntrealtek" }
                # Fallback neu khong co Get-PhysicalDisk (chay khong co admin):
                if ($bus -eq "") {
                    $usbFallback = ($d.Model -match "USB") -or ($d.InterfaceType -eq "USB")
                    $nvmeFallback = ($d.Model -match "NVMe")
                    if ($usbFallback) { $typeArg = "sntrealtek" }
                    if ($nvmeFallback -and -not $usbFallback) { $typeArg = "nvme" }
                }

                # SMART attribute dump:
                #   -A = attributes only
                #   -s on = enable SMART neu dang Disabled (can thiet cho HDD)
                #   -T permissive = warning thay vi fail khi SMART chua enable
                $cmdArgs = @("-A", $deviceArg, "-d", $typeArg, "-s", "on", "-T", "permissive")
                $proc = Start-Process -FilePath $smartctlPath -ArgumentList $cmdArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$env:TEMP\smartctl_out.txt" -RedirectStandardError "$env:TEMP\smartctl_err.txt" -ErrorAction Stop
                $out = ""
                if (Test-Path "$env:TEMP\smartctl_out.txt") { $out += (Get-Content "$env:TEMP\smartctl_out.txt" -Raw -ErrorAction SilentlyContinue) }
                if (Test-Path "$env:TEMP\smartctl_err.txt") { $out += [Environment]::NewLine + (Get-Content "$env:TEMP\smartctl_err.txt" -Raw -ErrorAction SilentlyContinue) }

                if ($proc.ExitCode -eq 0 -or $proc.ExitCode -eq 32) {
                    # 0 = OK, 32 = SMART reading available but warning (e.g., some NVMe)
                    $parsed = Parse-SmartCtlOutput -Output $out -DevicePath $deviceArg
                    $entry.source = "smartctl"
                    if ($null -ne $parsed.temperature) { $entry.temp = [string]$parsed.temperature + " C" }
                    if ($null -ne $parsed.powerOnHours) { $entry.powerOnTime = [string]$parsed.powerOnHours + " h" }
                    if ($null -ne $parsed.reallocated) { $entry.reallocated = [int]$parsed.reallocated }
                    if ($null -ne $parsed.pending) { $entry.pending = [int]$parsed.pending }
                    if ($null -ne $parsed.wearLevel) {
                        $entry.wearLevel = [int]$parsed.wearLevel
                        # Health = wear level con lai (100 = tot, <50 = kem)
                        $entry.health = [string]$parsed.wearLevel + "%"
                    }
                    if ($null -ne $parsed.criticalWarning) { $entry.criticalWarning = [int]$parsed.criticalWarning }
                    if ($null -ne $parsed.rotationRate -and $parsed.rotationRate -gt 0) { $entry.rotationRate = [int]$parsed.rotationRate }
                    if ($parsed.modelFamily) { $entry.modelFamily = [string]$parsed.modelFamily }
                    if ($parsed.serial) { $entry.smartSerial = [string]$parsed.serial }
                    if ($parsed.smartStatus) { $entry.status = [string]$parsed.smartStatus }
                    # KHONG tinh diem - chi giu raw data de user tu danh gia
                    Write-OK "Disk: $dtype $sizeGB GB - $($d.Model) [smartctl: $($entry.health)]"
                } else {
                    # Phan tich stderr de biet la do thieu admin hay loi khac (single-line, PowerShell-friendly)
                    $hint = "Exit code $($proc.ExitCode)"
                    if ($out -match "Permission denied|Access is denied|requires administrator") {
                        $hint = "Can Run as Administrator de doc SMART"
                    }
                    if ($out -match "Unknown USB bridge") {
                        $hint = "USB bridge khong ho tro (thu -d jmicron hoac -d usbcypress)"
                    }
                    if ($out -match "No such file") {
                        $hint = "Khong tim thay o $deviceArg"
                    }
                    if ($out -match "SMART Disabled") {
                        $hint = "SMART bi tat - can enable"
                    }
                    if ($out -match "Read NVMe Identify Controller failed") {
                        $hint = "NVMe ioctl fail (can admin)"
                    }
                    if ($proc.ExitCode -eq 2) {
                        $hint = "SMART read partial - mot so field bi loi"
                    }
                    Write-Warn "  smartctl exit $($proc.ExitCode) for $deviceArg (-d $typeArg): $hint - WMI fallback"
                    # QUAN TRONG: smartctl khong doc duoc SMART KHONG dong nghia o cung hong.
                    # Co the do scanner chay khong co quyen admin, hoac USB bridge
                    # khong ho tro, hoac NVMe ioctl bi block. Trong nhung tru hop
                    # do, ta KHONG the biet suc khoe that cua o -> mac dinh la GOOD
                    # (khong bao dong) de tranh hien thi nham "WARNING" khi o van OK.
                    # UI se hien thi badge "GOOD" + dong giai thich "can Admin de
                    # xem chi tiet".
                    $entry.status = "GOOD"
                    $entry.health = "N/A"
                    $entry.performance = "N/A"
                    # Lưu debug info để UI hiển thị
                    $entry.debug = @{
                        deviceArg = $deviceArg
                        typeArg = $typeArg
                        exitCode = $proc.ExitCode
                        hint = $hint
                        outputPreview = ($out.Substring(0, [Math]::Min(300, $out.Length)) -replace "\\r\\n", " | ")
                    }
                }
            } catch {
                Write-Warn "  smartctl error: $($_.Exception.Message)"
                $entry.debug = @{
                    error = $_.Exception.Message
                }
            }
        } else {
            Write-OK "Disk: $dtype $sizeGB GB - $($d.Model) [WMI only - smartctl khong co san]"
        }

        # === (KHONG tinh diem tong hop - chi emit raw data de user tu danh gia) ===

        $storageArr += $entry
    }

    # Cleanup CDI
    if ($cdiLoaded -and $cdiPtr -ne [IntPtr]::Zero) {
        try { [CDI]::DestroyAtaSmart($cdiPtr) } catch {}
    }
} catch {
    Write-Warn "Storage scan failed: $($_.Exception.Message)"
}

# === 5. Battery ===
Write-Step "[5/7] Battery..."
$designedmWh = "N/A"; $fullmWh = "N/A"; $battHealth = "N/A"; $cycles = "N/A"
try {
    $dCap = 0; $fCap = 0
    try {
        $bStatic = Get-CimInstance -Namespace "root/wmi" -ClassName BatteryStaticData -ErrorAction SilentlyContinue
        $bFull = Get-CimInstance -Namespace "root/wmi" -ClassName BatteryFullChargedCapacity -ErrorAction SilentlyContinue
        if ($bStatic) { $dCap = [int]($bStatic | Select-Object -First 1).DesignedCapacity }
        if ($bFull) { $fCap = [int]($bFull | Select-Object -First 1).FullChargedCapacity }
    } catch {}
    if ($dCap -le 0 -or $fCap -le 0) {
        try {
            $rptPath = Join-Path $env:TEMP ("battreport_" + [guid]::NewGuid().ToString() + ".xml")
            powercfg /batteryreport /xml /output $rptPath | Out-Null
            if (Test-Path $rptPath) {
                [xml]$rpt = Get-Content $rptPath -Encoding UTF8
                $bat = $rpt.BatteryReport.Batteries.Battery
                if ($bat -is [array]) { $bat = $bat[0] }
                if ($bat) {
                    if ([int]$bat.DesignCapacity -gt 0) { $dCap = [int]$bat.DesignCapacity }
                    if ([int]$bat.FullChargeCapacity -gt 0) { $fCap = [int]$bat.FullChargeCapacity }
                    if ([int]$bat.CycleCount -gt 0) { $cycles = [int]$bat.CycleCount }
                }
                Remove-Item $rptPath -Force -ErrorAction SilentlyContinue
            }
        } catch {}
    }
    if ($dCap -gt 0) { $designedmWh = $dCap }
    if ($fCap -gt 0) { $fullmWh = $fCap }
    if ($dCap -gt 0 -and $fCap -gt 0) { $battHealth = [string]([math]::Round(($fCap / $dCap) * 100, 1)) + "%" }
    if ($cycles -eq "N/A") {
        try {
            $wb = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($wb -and $wb.CycleCount) { $cycles = [int]$wb.CycleCount }
        } catch {}
    }
    Write-OK "Battery: designed=$designedmWh mWh, current=$fullmWh mWh, health=$battHealth"
} catch {
    Write-Warn "Battery scan failed: $($_.Exception.Message)"
}

# === 6. Screen ===
Write-Step "[6/7] Display..."
$resolution = "N/A"; $refresh = "N/A"; $screenSize = "N/A"
try {
    $vc = $gpusRaw | Where-Object { $_.CurrentHorizontalResolution -gt 0 } | Select-Object -First 1
    if (-not $vc) { $vc = $gpusRaw | Select-Object -First 1 }
    if ($vc -and $vc.CurrentHorizontalResolution) {
        $resolution = [string]$vc.CurrentHorizontalResolution + " x " + [string]$vc.CurrentVerticalResolution
    }
    if ($vc -and $vc.CurrentRefreshRate) { $refresh = [string]$vc.CurrentRefreshRate + " Hz" }
    try {
        $mon = Get-CimInstance -Namespace "root/wmi" -ClassName WmiMonitorBasicDisplayParams -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($mon -and $mon.MaxHorizontalImageSize -gt 0) {
            $diag = [math]::Sqrt([math]::Pow($mon.MaxHorizontalImageSize, 2) + [math]::Pow($mon.MaxVerticalImageSize, 2)) / 2.54
            $screenSize = [string][math]::Round($diag, 1) + " inch"
        }
    } catch {}
    Write-OK "Screen: $resolution @ $refresh ($screenSize)"
} catch {
    Write-Warn "Screen scan failed: $($_.Exception.Message)"
}

# === 7. System + WiFi ===
Write-Step "[7/7] System info..."
$sysName = "N/A"; $sysSerial = "N/A"
try {
    $sysInfo = Get-CimInstance -ClassName Win32_ComputerSystem
    $bios = Get-CimInstance -ClassName Win32_BIOS
    $sysName = NZ $sysInfo.Name "Unknown"
    $sysSerial = NZ $bios.SerialNumber "N/A"
    Write-OK "System: $sysName (SN: $sysSerial)"
} catch {
    Write-Warn "System scan failed: $($_.Exception.Message)"
}

$wifiSaved = @()
try {
    $wifiRaw = netsh wlan show profiles 2>$null | Select-String "All User Profile"
    foreach ($line in $wifiRaw) {
        $parts = $line -split ":\s+", 2
        if ($parts.Count -ge 2) { $wifiSaved += @{ ssid = $parts[1].Trim(); security = "WPA2" } }
    }
} catch {}

# === Result ===
Write-Host ""
Write-Step "Building result JSON..."

$result = @{
    cpu = @{
        name = $cpuName
        cores = $cpuCores
        threads = $cpuThreads
        baseClock = if ($cpuClock) { [string]$cpuClock + " MHz" } else { "N/A" }
        boostClock = "N/A"
        tdp = "N/A"
        temp = $cpuTemp
    }
    gpu = $gpus
    ram = @{
        total = [string]$ramTotal + " GB"
        type = $ramType
        speed = if ($ramSpeed -ne "N/A") { [string]$ramSpeed + " MHz" } else { "N/A" }
        slots = $ramSlots
        used = $ramUsed
        free = $ramSlots - $ramUsed
        maxUpgrade = $ramMaxUp
        modules = $ramModules
    }
    storage = $storageArr
    battery = @{
        designed = if ($designedmWh -ne "N/A") { [string]$designedmWh + " mWh" } else { "N/A" }
        current = if ($fullmWh -ne "N/A") { [string]$fullmWh + " mWh" } else { "N/A" }
        health = $battHealth
        cycles = $cycles
    }
    screen = @{
        resolution = $resolution
        refreshRate = $refresh
        panel = "N/A"
        size = $screenSize
    }
    system = @{
        name = $sysName
        serial = $sysSerial
        windowsKey = "N/A"
        wifiSaved = $wifiSaved
        wifiNearby = @()
    }
    # === Watcher loop metadata (command-poll system) ===
    watcher = @{
        token = $ScanToken
        apiBase = $ApiBase
        submitUrl = $SubmitUrl
        deviceId = $env:COMPUTERNAME
        deviceName = $env:COMPUTERNAME
        scriptRoot = $ScriptRoot
        lastHeartbeat = (Get-Date).ToString("o")
    }
}

Write-Step "Sending result to server..."
$ok = SendResult $result

Write-Host ""
if ($ok) {
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  SCAN COMPLETE - result sent to server!" -ForegroundColor Green
    Write-Host "  Open your browser to see the result." -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  This window will close in 3 seconds..." -ForegroundColor DarkGray
} else {
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host "  SCAN DONE but server unreachable." -ForegroundColor Yellow
    Write-Host "  Please check your internet connection." -ForegroundColor Yellow
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Press any key to close..." -ForegroundColor DarkGray
}

# ============================================================
# WATCHER LOOP (Phase 3 - command-poll)
# Neu user da scan xong va chon tool, PS1 phai tiep tuc chay de nhan
# command tu server (POST /api/v1/system-scan/command... -> PS1 poll
# /api/v1/system-scan/command-poll?token=X).
# Vong lap chi thoat khi user nhan Ctrl+C hoac dong cua so.
# ============================================================
$CommandPollUrl = "$ApiBase/api/v1/system-scan/command-poll?token=$ScanToken"
$ResultSubmitted = $ok
Write-Host ""
Write-Step "Entering watcher mode (waits for tool commands)..."
Write-Host "  Press Ctrl+C to exit." -ForegroundColor DarkGray

# Status callback de tools panel biet scan da submit xong.
SendPing "complete"

while ($true) {
    try {
        $resp = Invoke-RestMethod -Uri $CommandPollUrl -Method Get -TimeoutSec 5
        if ($resp -and $resp.command -and $resp.command.action) {
            $cmd = $resp.command
            Write-Step "Received command: $($cmd.action) ($($cmd.toolId))"
            try {
                # Acknowledge receipt.
                $ackUrl = "$ApiBase/api/v1/system-scan/command?token=$ScanToken&ack=$($cmd.toolId)"
                Invoke-RestMethod -Uri $ackUrl -Method Post -TimeoutSec 5 | Out-Null
            } catch {}
            # Xu ly command that su:
            if ($cmd.action -eq "launch-tool") {
                Invoke-ToolCommand -cmd $cmd
            } else {
                if ($cmd.action -eq "stop-tool") {
                    # TODO: stop running tool by PID. Hien tai chi log.
                    Write-OK "Stop command received for $($cmd.toolId) (not implemented yet)."
                }
            }
        }
    } catch {
        # Silent - poll again
    }
    Start-Sleep -Milliseconds 3000
}
`;

// BAT don gian: chi goi powershell -File.
// PS1 se tu download smartctl.exe ve cache neu can. Neu user muon SMART chi
// tiet (wear level, reallocated sectors, NVMe smart), phai chay admin.
export const SCANNER_BAT = String.raw`@echo off
title Laptop System Scanner
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ================================================
echo   LAPTOP SYSTEM SCANNER
echo ================================================
echo.
echo   Waiting for scanner to start...
echo   (This window will stay open while scanning)
echo.
echo   For detailed disk SMART (wear, reallocated,
echo   temperature, NVMe health), run as Administrator.
echo.
echo   To stop: close this window or press Ctrl+C.
echo ================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0laplap-toolcheck.ps1"

echo.
echo Scanner finished. Press any key to close.
pause >nul
exit
`;
