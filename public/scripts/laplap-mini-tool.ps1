# ============================================================
#  laplap-mini-tool.ps1
#  ALL-IN-ONE Mini Tool: quet phan cung + benchmark FurMark +
#  sign HMAC-SHA256 + POST /api/v1/mini-tool/upload + mo leaderboard.
#
#  Cu phap:
#    .\laplap-mini-tool.ps1 -ApiBase "https://laplapcantho.store" `
#                            -SessionId "abc123..."       (optional)
#                            -DurationMin 5
#                            -Preset "1080"
#
#  Build portable .exe (chi PS2EXE):
#    Invoke-PS2EXE -InputFile "public\scripts\laplap-mini-tool.ps1" `
#                   -OutputFile "public\scripts\laplap-mini-tool.exe" `
#                   -RequireAdmin -NoConsole:$false `
#                   -Title "LapLap Mini Tool" -Version "1.0.0.0"
# ============================================================

param(
    [string]$ApiBase     = "http://localhost:3000",
    [string]$SessionId   = "",       # Neu trong -> tool se tu goi POST /api/v1/mini-tool/sessions
    [int]$DurationMin    = 5,
    [string]$Preset      = "1080",  # 1080 | 1440 | 2160
    [int]$GpuIndex       = 0,
    [string]$SharedSecret = $(if ($env:MINI_TOOL_SHARED_SECRET) { $env:MINI_TOOL_SHARED_SECRET } else { "laplap-mini-tool-dev-secret-DO-NOT-USE-IN-PROD" }),
    [switch]$AutoUpload  = $true,    # -AutoUpload:$false de in payload ra stdout ma khong upload
    [string]$FurMarkPath = "",
    [string]$FurMarkDownloadUrl = "https://www.geeks3d.com/dl/get/740"
)

# StrictMode v2.0 de tranh loi .Count tren $null, nhung van cho phep su dung
# cac cmdlet tra ve $null mot cach an toan.
Set-StrictMode -Version 2.0

# Init state vars that are only conditionally set later (avoid StrictMode "not set" errors).
$SkipBenchmark = $false
$ErrorActionPreference = "Stop"

# ============================================================
#  Helpers console (giong furmark-benchmark.ps1)
# ============================================================
function Write-Step  { param($msg) Write-Host "  >> $msg"  -ForegroundColor Cyan }
function Write-OK    { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "  [!] $msg"  -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "  [X] $msg"  -ForegroundColor Red }

# Luoi an toan: in loi ro rang, giu cua so mo de user doc.
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

# ============================================================
#  ConvertTo-CanonicalJson + Compute-HmacSha256
#  Phai khop 100% voi src/lib/mini-tool/signature.ts (canonicalJson)
#
#  Quy tac:
#   - sort keys RECURSIVE
#   - khong whitespace
#   - null -> "null"
#   - bool -> "true" / "false" (KHONG co dau nhay)
#   - string -> JSON string (co dau nhay, escape theo JSON)
#   - number -> so (khong ep thanh string co dau nhay)
#   - array -> [v1,v2,...]
#   - object -> {k1:v1,k2:v2,...}
# ============================================================
function ConvertTo-CanonicalJson {
    param($Value)
    if ($null -eq $Value) { return "null" }

    # Bool phai check TRUOC string (PS co the ep bool thanh string trong 1 so ngu canh).
    if ($Value -is [bool]) {
        if ($Value) { return "true" } else { return "false" }
    }

    # Number: dung ConvertTo-Json de co output giong JSON.stringify
    # (giu so nguyen la "42", khong them ".0").
    if ($Value -is [int] -or $Value -is [long] -or $Value -is [bigint]) {
        return "$Value"
    }
    if ($Value -is [double] -or $Value -is [decimal] -or $Value -is [single] -or $Value -is [float]) {
        if ([double]::IsNaN([double]$Value) -or [double]::IsInfinity([double]$Value)) {
            throw "Non-finite number not allowed"
        }
        # ConvertTo-Json se xuat "1.5" (khong them quotes)
        return (ConvertTo-Json -InputObject $Value -Compress)
    }

    # String: dung ConvertTo-Json de escape chinh xac
    if ($Value -is [string]) {
        # ConvertTo-Json "abc" -> "abc" (co dau nhay, escape \n, \", \\)
        return (ConvertTo-Json -InputObject $Value -Compress)
    }

    # Array
    if ($Value -is [array]) {
        if ($Value.Count -eq 0) { return "[]" }
        $parts = @()
        foreach ($v in $Value) { $parts += ConvertTo-CanonicalJson $v }
        return "[" + ($parts -join ",") + "]"
    }

    # Object (hashtable hoac pscustomobject)
    if ($Value -is [hashtable] -or $Value -is [pscustomobject] -or $Value -is [System.Collections.IDictionary]) {
        $keys = @()
        if ($Value -is [hashtable] -or $Value -is [System.Collections.IDictionary]) {
            $keys = @($Value.Keys)
        } else {
            $keys = @($Value.PSObject.Properties.Name)
        }
        $sortedKeys = $keys | Sort-Object
        $parts = @()
        foreach ($k in $sortedKeys) {
            $v = $null
            if ($Value -is [hashtable] -or $Value -is [System.Collections.IDictionary]) {
                $v = $Value[$k]
            } else {
                $v = $Value.$k
            }
            # PowerShell khong phan biet "key khong co" va "key = $null". Ca hai
            # deu tra ve $null. Vi TS chi skip "undefined" (giu lai null), nen
            # can emit "null" de khop canonical server-side. Neu that su muon
            # skip (vi key that su khong ton tai), pscustomobject da loc
            # bang $Value.PSObject.Properties.Name o tren, nen $v = $null chi
            # xay ra khi key ton tai nhung set thanh $null.
            $parts += ('"' + $k + '":' + (ConvertTo-CanonicalJson $v))
        }
        return "{" + ($parts -join ",") + "}"
    }

    throw "Unsupported type: $($Value.GetType().FullName)"
}

function Compute-HmacSha256 {
    param($Payload, [string]$Secret)
    $canonical = ConvertTo-CanonicalJson $Payload
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = [Text.Encoding]::UTF8.GetBytes($Secret)
    $bytes = [Text.Encoding]::UTF8.GetBytes($canonical)
    $hash  = $hmac.ComputeHash($bytes)
    return ([BitConverter]::ToString($hash) -replace '-','').ToLower()
}

# ============================================================
#  Helpers cho Invoke-RestMethod co timeout + retry
# ============================================================
function Invoke-ApiJson {
    param(
        [string]$Method,
        [string]$Uri,
        [object]$Body = $null,
        [int]$TimeoutSec = 30
    )
    $headers = @{ "Content-Type" = "application/json" }
    $jsonBody = $null
    if ($null -ne $Body) {
        $jsonBody = $Body | ConvertTo-Json -Depth 10 -Compress
    }
    try {
        return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -Body $jsonBody -TimeoutSec $TimeoutSec
    } catch {
        $statusCode = 0
        $msg = $_.Exception.Message
        try {
            if ($_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode
            }
        } catch {}
        throw "API $Method $Uri failed (HTTP $statusCode): $msg"
    }
}

# ============================================================
#  Banner
# ============================================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "   LapLap Mini Tool - All-in-One            " -ForegroundColor Magenta
Write-Host "   Quet + Benchmark + Upload                " -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  API    : $ApiBase" -ForegroundColor DarkGray
Write-Host "  Phien  : $(if ($SessionId) { $SessionId } else { '(chua co - se tu tao)' })" -ForegroundColor DarkGray
Write-Host ""

# ============================================================
#  Stage 1: Session bootstrap (neu khong truyen san SessionId)
# ============================================================
if ($SessionId -eq "") {
    Write-Step "Tao phien Mini Tool..."
    try {
        $resp = Invoke-ApiJson -Method POST -Uri "$ApiBase/api/v1/mini-tool/sessions" -Body @{
            redirectAfterUpload = "/test-laptop"
        }
        if (-not $resp.ok) {
            throw "Server tu choi: $($resp.error.message)"
        }
        $SessionId = $resp.data.sessionId
        Write-OK "Phien moi: $SessionId"
        Write-Host "  Verify URL: $($resp.data.verifyUrl)" -ForegroundColor DarkGray
    } catch {
        Write-Fail "Tao phien that bai: $_"
        Write-Host "  Kiem tra $ApiBase dang chay va endpoint /api/v1/mini-tool/sessions hoat dong." -ForegroundColor DarkGray
        throw
    }
} else {
    Write-Step "Verify session $SessionId..."
    try {
        $resp = Invoke-ApiJson -Method GET -Uri "$ApiBase/api/v1/mini-tool/session?sid=$SessionId"
        if (-not $resp.ok -or -not $resp.data.valid) {
            throw "Session khong hop le hoac da het han"
        }
        Write-OK "Session hop le (het han: $($resp.data.expiresAt))"
    } catch {
        Write-Fail "Verify session that bai: $_"
        throw
    }
}

# ============================================================
#  Stage 2: Hardware scan (WMI) - tao $payload (camelCase)
# ============================================================
Write-Step "Quet phan cung..."
$payload = @{
    payloadVersion = "mini-tool-v1"
    nonce          = [guid]::NewGuid().Guid
    device         = @{
        deviceId   = $env:COMPUTERNAME
        deviceName = $env:COMPUTERNAME
        serial     = @{
            bios        = $null
            motherboard = $null
        }
        os = @{
            name      = $null
            version   = $null
            build     = $null
            arch      = $null
            activated = $null
        }
    }
    hardware = @{
        cpu       = @{ name = $null; cores = $null; threads = $null; baseGhz = $null; boostGhz = $null }
        ram       = @{ totalGb = $null; type = $null; speedMhz = $null; slots = $null; modules = @() }
        storage   = @()
        gpu       = @()
        mainboard = @{ model = $null; biosVersion = $null }
        battery   = @{ designMwh = $null; fullMwh = $null; healthPct = $null; cycles = $null; voltageMv = $null }
        network   = @{ mac = $null; ip = $null; wifi = $null }
    }
    benchmark = @{
        tool       = "FurMark 2"
        gpuScore   = $null
        fpsAvg     = $null
        testWidth  = 1920
        testHeight = 1080
        testPreset = "1080p"
        duration   = $DurationMin * 60
    }
    tests = @()
}

# --- OS ---
try {
    $osInfo = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($osInfo) {
        $payload.device.os.name      = $osInfo.Caption
        $payload.device.os.version   = $osInfo.Version
        $payload.device.os.build     = $osInfo.BuildNumber
        $payload.device.os.arch      = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
        $payload.device.os.activated = $true   # WMI khong cho bi OS co active hay khong
        Write-OK "OS: $($osInfo.Caption)"
    }
} catch { Write-Warn "Khong lay duoc OS" }

# --- BIOS serial ---
try {
    $bios = Get-CimInstance -ClassName Win32_BIOS -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($bios) {
        $payload.device.serial.bios = $bios.SerialNumber
        $payload.hardware.mainboard.biosVersion = $bios.SMBIOSBIOSVersion
    }
} catch {}
try {
    $baseboard = Get-CimInstance -ClassName Win32_BaseBoard -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($baseboard) {
        $payload.device.serial.motherboard = $baseboard.SerialNumber
        $payload.hardware.mainboard.model = $baseboard.Product
    }
} catch {}

# --- CPU ---
try {
    $cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cpu) {
        $payload.hardware.cpu.name    = $cpu.Name.Trim()
        $payload.hardware.cpu.cores   = [int]$cpu.NumberOfCores
        $payload.hardware.cpu.threads = [int]$cpu.NumberOfLogicalProcessors
        $payload.hardware.cpu.baseGhz = [Math]::Round([double]$cpu.MaxClockSpeed / 1000, 2)
        Write-OK "CPU: $($cpu.Name.Trim())"
    }
} catch { Write-Warn "Khong lay duoc CPU" }

# --- GPU ---
try {
    $gpus = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.Name -and $_.Name -ne '' })
    # Query registry de lay VRAM chinh xac hon (Win32_VideoController.AdapterRAM bi gioi han 4GB tren Windows 7+).
    # Wrap rieng de mot key bi chan khong lam vo ca block GPU detection.
    $regGpus = @()
    try {
        $regGpus = @(Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\*' -ErrorAction SilentlyContinue | Where-Object { $_.'HardwareInformation.qwMemorySize' })
    } catch {}
    foreach ($g in $gpus) {
        $vramGb = $null
        $match = $regGpus | Where-Object { $_.DriverDesc -eq $g.Name } | Select-Object -First 1
        if (-not $match) {
            $match = $regGpus | Where-Object { $g.Name -like ('*' + $_.DriverDesc + '*') -or $_.DriverDesc -like ('*' + $g.Name + '*') } | Select-Object -First 1
        }
        if ($match -and $match.'HardwareInformation.qwMemorySize') {
            $vramGb = [Math]::Round([int64]$match.'HardwareInformation.qwMemorySize' / 1GB, 1)
        } elseif ($g.AdapterRAM -gt 0) {
            $vramGb = [Math]::Round($g.AdapterRAM / 1GB, 1)
        }
        $payload.hardware.gpu += @{
            name            = $g.Name
            vendor          = switch -Regex ($g.Name) {
                '^NVIDIA'  { 'NVIDIA' }
                '^AMD|^ATI' { 'AMD' }
                '^Intel'   { 'Intel' }
                default    { 'Other' }
            }
            vramGb          = $vramGb
            driverVersion   = $g.DriverVersion
        }
    }
    if ($payload.hardware.gpu.Count -gt 0) {
        Write-OK "GPU: $($payload.hardware.gpu[0].name)"
    }
} catch { Write-Warn "Khong lay duoc GPU" }

# --- RAM ---
try {
    $ram = @(Get-CimInstance -ClassName Win32_PhysicalMemory -ErrorAction SilentlyContinue)
    $ramArray = Get-CimInstance -ClassName Win32_PhysicalMemoryArray -ErrorAction SilentlyContinue | Select-Object -First 1
    $totalRAM = 0
    if ($ram) { $totalRAM = ($ram | Measure-Object -Property Capacity -Sum).Sum / 1GB }
    $memTypeMap = @{ 20='DDR'; 21='DDR2'; 22='DDR2'; 24='DDR3'; 26='DDR4'; 28='DDR5' }
    $ramType = $null
    if ($ram -and $ram[0].SMBIOSMemoryType -and $memTypeMap.ContainsKey([int]$ram[0].SMBIOSMemoryType)) {
        $ramType = $memTypeMap[[int]$ram[0].SMBIOSMemoryType]
    }
    $ramSpeedMhz = $null
    if ($ram -and $ram[0].Speed) { $ramSpeedMhz = [int]$ram[0].Speed }
    # Fallback: suy ra type tu speed
    if (-not $ramType -and $ramSpeedMhz) {
        if ($ramSpeedMhz -ge 4000) { $ramType = "DDR5" }
        elseif ($ramSpeedMhz -ge 1600) { $ramType = "DDR4" }
        elseif ($ramSpeedMhz -ge 800)  { $ramType = "DDR3" }
    }
    $ramModules = @()
    foreach ($m in $ram) {
        $mType = $null
        if ($m.SMBIOSMemoryType -and $memTypeMap.ContainsKey([int]$m.SMBIOSMemoryType)) {
            $mType = $memTypeMap[[int]$m.SMBIOSMemoryType]
        }
        if (-not $mType -and $m.Speed) {
            if ([int]$m.Speed -ge 4000) { $mType = "DDR5" }
            elseif ([int]$m.Speed -ge 1600) { $mType = "DDR4" }
            elseif ([int]$m.Speed -ge 800)  { $mType = "DDR3" }
        }
        $ramModules += @{
            sizeGb    = [int][Math]::Round($m.Capacity / 1GB, 0)
            speedMhz  = if ($m.Speed) { [int]$m.Speed } else { $null }
            type      = $mType
            brand     = if ($m.Manufacturer) { ([string]$m.Manufacturer).Trim() } else { $null }
            slot      = $null
        }
    }
    $slots = 0
    if ($ramArray -and $ramArray.MemoryDevices) { $slots = [int]$ramArray.MemoryDevices }
    if ($slots -eq 0) { $slots = $ram.Count }
    $payload.hardware.ram = @{
        totalGb = [int][Math]::Round($totalRAM, 1)
        type    = $ramType
        speedMhz = $ramSpeedMhz
        slots   = $slots
        modules = $ramModules
    }
    Write-OK "RAM: $([int][Math]::Round($totalRAM,1)) GB ($ramType)"
} catch { Write-Warn "Khong lay duoc RAM" }

# --- Storage ---
try {
    $disks = @(Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction SilentlyContinue)
    $phys = @()
    try { $phys = @(Get-PhysicalDisk -ErrorAction SilentlyContinue) } catch {}
    $logical = @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction SilentlyContinue)
    $freeTotal = 0
    if ($logical) { $freeTotal = ($logical | Measure-Object -Property FreeSpace -Sum).Sum / 1GB }
    foreach ($d in $disks) {
        $dtype = $null
        $pd = $phys | Where-Object { $_.DeviceId -eq $d.Index -or $_.FriendlyName -eq $d.Model } | Select-Object -First 1
        $bus = if ($pd) { [string]$pd.BusType } else { '' }
        $media = if ($pd) { [string]$pd.MediaType } else { '' }
        if ($bus -eq 'NVMe' -or $d.Model -like '*NVMe*') { $dtype = 'NVMe SSD' }
        elseif ($media -eq 'SSD' -or $d.Model -like '*SSD*') { $dtype = 'SATA SSD' }
        elseif ($media -eq 'HDD' -or $bus -eq 'SATA') { $dtype = 'HDD' }
        elseif ($d.Model -like '*SSD*') { $dtype = 'SSD' }
        elseif ($bus) { $dtype = $bus }
        $payload.hardware.storage += @{
            name       = $d.Model
            type       = $dtype
            capacityGb = [int][Math]::Round($d.Size / 1GB, 0)
            healthPct  = $null
            smart      = $null
        }
    }
    if ($payload.hardware.storage.Count -gt 0) {
        Write-OK "Storage: $($payload.hardware.storage[0].name) ($($payload.hardware.storage[0].capacityGb) GB)"
    }
} catch { Write-Warn "Khong lay duoc storage" }

# --- Battery ---
try {
    $bStatic = Get-CimInstance -Namespace 'root/wmi' -ClassName BatteryStaticData -ErrorAction SilentlyContinue
    $bFull   = Get-CimInstance -Namespace 'root/wmi' -ClassName BatteryFullChargedCapacity -ErrorAction SilentlyContinue
    $dCap = 0; $fCap = 0
    if ($bStatic) { $dCap = [int]($bStatic | Select-Object -First 1).DesignedCapacity }
    if ($bFull)   { $fCap = [int]($bFull | Select-Object -First 1).FullChargedCapacity }
    # Fallback: powercfg /batteryreport
    if ($dCap -le 0 -or $fCap -le 0) {
        try {
            $rptPath = Join-Path $env:TEMP ('battreport_' + [guid]::NewGuid().ToString() + '.xml')
            powercfg /batteryreport /xml /output $rptPath | Out-Null
            if (Test-Path $rptPath) {
                [xml]$rpt = Get-Content $rptPath -Encoding UTF8
                $bat = $rpt.BatteryReport.Batteries.Battery
                if ($bat -is [array]) { $bat = $bat[0] }
                if ($bat) {
                    if ([int]$bat.DesignCapacity -gt 0)    { $dCap = [int]$bat.DesignCapacity }
                    if ([int]$bat.FullChargeCapacity -gt 0) { $fCap = [int]$bat.FullChargeCapacity }
                }
                Remove-Item $rptPath -Force -ErrorAction SilentlyContinue
            }
        } catch {}
    }
    $cycles = $null
    try {
        $wb = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($wb -and $wb.CycleCount) { $cycles = [int]$wb.CycleCount }
    } catch {}
    $healthPct = $null
    if ($dCap -gt 0 -and $fCap -gt 0) { $healthPct = [Math]::Round(($fCap / $dCap) * 100, 1) }
    $payload.hardware.battery = @{
        designMwh = if ($dCap -gt 0) { $dCap } else { $null }
        fullMwh   = if ($fCap -gt 0) { $fCap } else { $null }
        healthPct = $healthPct
        cycles    = $cycles
        voltageMv = $null
    }
    if ($dCap -gt 0) {
        Write-OK "Battery: $dCap mWh design / $fCap mWh full"
    }
} catch { Write-Warn "Khong lay duoc battery" }

# --- Network (WiFi adapter + IP) ---
try {
    $wifiAdapter = Get-CimInstance -ClassName Win32_NetworkAdapter -ErrorAction SilentlyContinue | Where-Object {
        $_.NetEnabled -and ($_.Name -like '*Wi-Fi*' -or $_.Name -like '*Wireless*')
    } | Select-Object -First 1
    if ($wifiAdapter) {
        $payload.hardware.network.wifi = $wifiAdapter.Name
    }
    $ipAddr = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
        $_.IPAddress -and $_.IPAddress -notlike '169.254*' -and $_.InterfaceAlias -notlike '*Loopback*'
    } | Select-Object -First 1 -ExpandProperty IPAddress
    if ($ipAddr) { $payload.hardware.network.ip = $ipAddr }
} catch {}

# ============================================================
#  Stage 3: Detect / install / launch FurMark 2
# ============================================================
Write-Step "Kiem tra FurMark 2..."

# Lay GPU info neu co
$GpuName = if ($payload.hardware.gpu.Count -gt 0) { $payload.hardware.gpu[0].name } else { "GPU" }
$CpuName = if ($payload.hardware.cpu.name) { $payload.hardware.cpu.name } else { "CPU" }
$RamGb   = if ($payload.hardware.ram.totalGb) { $payload.hardware.ram.totalGb } else { 0 }

$furmarkCandidates = @(
    "C:\Program Files\Geeks3D\FurMark2_x64\furmark.exe",
    "C:\Program Files\Geeks3D\FurMark2\furmark.exe",
    "C:\Program Files\Geeks3D\Benchmarks\FurMark2\furmark.exe",
    "C:\Program Files (x86)\Geeks3D\FurMark2_x64\furmark.exe",
    "C:\Program Files (x86)\Geeks3D\FurMark2\furmark.exe",
    "${env:LOCALAPPDATA}\Programs\Geeks3D\FurMark2\furmark.exe"
)

if ($FurMarkPath -eq "" -or -not (Test-Path $FurMarkPath)) {
    # Uu tien 1: Portable mode - user tu dat furmark.exe canh .bat/.ps1 hoac trong thu muc con
    # (Tai FurMark 2 portable zip tu https://geeks3d.com/furmark/ -> giai nen -> copy furmark.exe
    # vao cung folder voi laplap-mini-tool.bat, hoac vao thu muc con `FurMark2/`).
    # Day la cach hop le nhat de khong phai cai dat + tranh van de phan phoi lai ban quyen.
    $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
    $portableCandidates = @(
        (Join-Path $scriptDir "furmark.exe"),
        (Join-Path $scriptDir "FurMark2\furmark.exe"),
        (Join-Path $scriptDir "FurMark2_x64\furmark.exe"),
        (Join-Path $scriptDir "FurMark_win64\furmark.exe"),
        (Join-Path $scriptDir "tools\furmark.exe"),
        (Join-Path $scriptDir "tools\FurMark2\furmark.exe")
    )
    $found = $null
    foreach ($cand in $portableCandidates) {
        if ($cand -and (Test-Path $cand)) { $found = $cand; break }
    }

    # Uu tien 2: Tim trong cac duong dan cai dat chuan
    if (-not $found) {
        foreach ($cand in $furmarkCandidates) {
            if ($cand -and (Test-Path $cand)) { $found = $cand; break }
        }
    }

    # Uu tien 3: Quet toan Program Files\Geeks3D
    if (-not $found) {
        foreach ($root in @("C:\Program Files\Geeks3D", "C:\Program Files (x86)\Geeks3D")) {
            if (Test-Path $root) {
                $hit = Get-ChildItem -Path $root -Filter "furmark.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($hit) { $found = $hit.FullName; break }
            }
        }
    }

    if ($found) {
        $FurMarkPath = $found
        Write-OK "Tim thay FurMark (portable hoac installed): $FurMarkPath"
    } else {
        Write-Warn "Khong thay FurMark tren may."
        Write-Host ""
        Write-Host "  Cach nhanh nhat: Tai FurMark 2 PORTABLE zip (~70 MB):" -ForegroundColor Cyan
        Write-Host "    1. Tru cap https://geeks3d.com/furmark/" -ForegroundColor Gray
        Write-Host "    2. Download 'FurMark 2 - portable version (zip)'" -ForegroundColor Gray
        Write-Host "    3. Giai nen -> copy `furmark.exe` vao cung folder voi laplap-mini-tool.bat" -ForegroundColor Gray
        Write-Host "       (hoac vao thu muc con `FurMark2\` canh tool)" -ForegroundColor Gray
        Write-Host "    4. Chay lai .bat - script se tu detect" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  HOAC tool se tu dong tai portable zip tu server LapLap..." -ForegroundColor DarkGray
        $portableZipPath = Join-Path $env:TEMP "furmark2_portable.zip"
        $downloaded = $false
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $ProgressPreference = 'SilentlyContinue'
            # Buoc 1: Goi LapLap API de lay URL download chinh thuc tu Geeks3D.
            # (Dam bao khong redistribute ban quyen - chi redirect user ve nguon goc Geeks3D)
            $metaUrl = "$Server/api/v1/tools/furmark-portable/download"
            $meta = Invoke-RestMethod -Uri $metaUrl -TimeoutSec 30
            $realUrl = $met.dat.zipUrl
            if ($realUrl) {
                Write-Host "  [i] Tai tu nguon chinh thuc: $realUrl" -ForegroundColor DarkGray
                Invoke-WebRequest -Uri $realUrl -OutFile $portableZipPath -UseBasicParsing -TimeoutSec 300
                if ((Test-Path $portableZipPath) -and ((Get-Item $portableZipPath).Length -gt 1000000)) {
                    $downloaded = $true
                }
            }
        } catch { Write-Warn "Tai portable zip that bai: $_" }

        if ($downloaded) {
            try {
                $extractDir = Join-Path $scriptDir "FurMark2"
                New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
                Add-Type -AssemblyName System.IO.Compression.FileSystem
                [System.IO.Compression.ZipFile]::ExtractToDirectory($portableZipPath, $extractDir)
                $hit = Get-ChildItem -Path $extractDir -Filter "furmark.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($hit) {
                    $FurMarkPath = $hit.FullName
                    Write-OK "Da giai nen FurMark portable: $FurMarkPath"
                }
            } catch { Write-Warn "Giai nen that bai: $_" }
            Remove-Item $portableZipPath -Force -ErrorAction SilentlyContinue
        }

        # Fallback cuoi: huong dan thu cong
        if ($FurMarkPath -eq "" -or -not (Test-Path $FurMarkPath)) {
            Write-Warn "Khong tu dong tai/giai nen duoc FurMark."
            Write-Host "  Mo trang tai: https://geeks3d.com/furmark/" -ForegroundColor DarkGray
            try { Start-Process "https://geeks3d.com/furmark/" } catch {}
            while ($true) {
                $userPath = Read-Host "  Cai/dat xong, nhap duong dan toi furmark.exe (Enter de bo qu)"
                if ([string]::IsNullOrWhiteSpace($userPath)) {
                    Write-Warn "Bo qua benchmark. Payload se khong co gpuScore."
                    $SkipBenchmark = $true
                    break
                }
                $userPath = $userPath.Trim('"').Trim()
                if (Test-Path $userPath) { $FurMarkPath = $userPath; break }
                Write-Warn "Duong dan khong ton tai, thu lai."
            }
        }
    }
}
if (-not $SkipBenchmark -and ($FurMarkPath -ne "" -and (Test-Path $FurMarkPath))) {
    Write-OK "FurMark: $FurMarkPath"
}

# ============================================================
#  Stage 3b: Chay FurMark + parse score
#  Tuong tu furmark-benchmark.ps1 phan "Chay benchmark"
# ============================================================
if ($SkipBenchmark) {
    Write-Warn "Bo qua FurMark benchmark. gpuScore se la null."
    $score  = 0
    $fpsAvg = 0
} else {
Write-Step "Chay benchmark $DurationMin phut (preset $Preset)..."

# Tinh toan resolution tu preset
$width  = [int]$Preset
$height = if ($Preset -eq "1080") { 1920 } elseif ($Preset -eq "1440") { 2560 } else { 3840 }
# FurMark 2 dung width x height (nguoc voi nhieu tool khac)
$actualWidth  = $height
$actualHeight = $width

# File log de parse score
$scoreLog = Join-Path $env:TEMP "furmark_score_$($SessionId).txt"
$errorLog = Join-Path $env:TEMP "furmark_error_$($SessionId).txt"
@"
GPU_SCORE_START
"@ | Out-File -FilePath $scoreLog -Encoding UTF8 -Force

# FurMark 2 portable CLI dung `--flag value` (double-dash, space). Mot so flag:
#   --width X --height Y          : resolution
#   --benchmark                   : run benchmark mode
#   --duration-ms N               : thoi gian chay (ms)
#   --print-render-speed          : in FPS ra stdout (de parse)
#   --no-score-box                : khong hien thi score overlay
#   --fullscreen                  : chay fullscreen
#   --gpu-index N                 : chon GPU (0 = first)
#   --logfile-suffix <name>       : ghi log ra file
#   --demo furmark-gl             : stress mode
$furmarkArgs = @(
    "--demo", "furmark-gl"
    "--width", "$actualWidth"
    "--height", "$actualHeight"
    "--fullscreen"
    "--gpu-index", "0"
    "--benchmark"
    "--duration-ms", "$($DurationMin * 60 * 1000)"
    "--no-score-box"
    "--print-render-speed"
    "--logfile-suffix", "laplap_$SessionId"
)
Write-Host "  Cmd: $FurMarkPath $($furmarkArgs -join ' ')" -ForegroundColor DarkGray

# ChAo A1/2: KHA"NG dA1ng `-NoNewWindow` cA1ng `-WindowStyle` (PowerShell bA!o l"-i conflict).
# FurMark la GUI app, nen tao cua so moi voi style Normal. Dung -RedirectStandardOutput
# de bat log FPS tu stdout (FurMark 2 co the in score ra stdout trong benchmark mode).
$furmarkProc = Start-Process -FilePath $FurMarkPath `
    -ArgumentList $furmarkArgs `
    -PassThru `
    -WindowStyle Normal `
    -RedirectStandardOutput $scoreLog `
    -RedirectStandardError $errorLog
if (-not $furmarkProc) {
    throw "Khong the khoi dong FurMark"
}

# Polling log de lay score + tien do
$score = 0
$fpsAvg = 0
$elapsed = 0
$totalSec = $DurationMin * 60
$lastLogSize = 0
$lastScoreLog = 0
while (-not $furmarkProc.HasExited -and $elapsed -lt $totalSec + 60) {
    Start-Sleep -Seconds 2
    $elapsed += 2
    if (Test-Path $scoreLog) {
        $current = (Get-Item $scoreLog -ErrorAction SilentlyContinue).Length
        if ($current -ne $lastLogSize) {
            $lastLogSize = $current
            try {
                $logContent = Get-Content $scoreLog -Raw -ErrorAction SilentlyContinue
                # Tim pattern "Score: <number>" hoac "GPU score: <number>"
                $scoreMatch = [regex]::Match($logContent, '(?i)(?:score|points?)\s*[:=]\s*(\d{3,6})')
                if ($scoreMatch.Success) {
                    $lastScoreLog = [int]$scoreMatch.Groups[1].Value
                }
                # FPS
                $fpsMatch = [regex]::Match($logContent, '(?i)fps\s*[:=]\s*(\d+(?:\.\d+)?)')
                if ($fpsMatch.Success) {
                    $fpsAvg = [double]$fpsMatch.Groups[1].Value
                }
            } catch {}
        }
    }
    $pct = [Math]::Min(100, [int](($elapsed / $totalSec) * 100))
    Write-Host "`r  Tien do: $pct% ($elapsed/$totalSec s)    " -NoNewline -ForegroundColor Cyan
}
Write-Host ""

# Do cho process ket thuc
if (-not $furmarkProc.HasExited) {
    Write-Warn "FurMark van chay sau $totalSec s. Cho them 30s..."
    $furmarkProc | Wait-Process -Timeout 30 -ErrorAction SilentlyContinue
    if (-not $furmarkProc.HasExited) {
        Write-Warn "FurMark khong tu dong thoat. Kill..."
        Stop-Process -Id $furmarkProc.Id -Force -ErrorAction SilentlyContinue
    }
}

# Lay score cuoi cung tu log - thu nhieu pattern (FurMark 2 viet stdout theo nhieu format)
if (Test-Path $scoreLog) {
    try {
        $logContent = Get-Content $scoreLog -Raw -ErrorAction SilentlyContinue
        # Pattern 1: "GPU score: 12345" hoac "Score: 12345 points" (FurMark 1/2)
        $scoreMatch = [regex]::Match($logContent, '(?i)(?:gpu\s*score|final\s*score|total\s*score|score|points?)\s*[:=]\s*(\d{2,7})')
        if ($scoreMatch.Success) {
            $lastScoreLog = [int]$scoreMatch.Groups[1].Value
        }
        # Pattern 2: FurMark 2 in FPS moi giay -> lay AVG
        if ($lastScoreLog -le 0) {
            # Match "FPS: 71.5", "Render speed: 71.5 FPS", "Average FPS: 71.5", v.v.
            $fpsMatches = [regex]::Matches($logContent, '(?im)(?:^\s*FPS\s*[:=]|render\s*speed\s*[:=]|average\s*FPS\s*[:=])\s*(\d+(?:\.\d+)?)\s*(?:FPS|$)')
            if ($fpsMatches.Count -gt 0) {
                # Tinh trung binh FPS, score = avg FPS A- duration
                $sum = 0.0
                foreach ($m in $fpsMatches) { $sum += [double]$m.Groups[1].Value }
                $fpsAvg = [math]::Round($sum / $fpsMatches.Count, 1)
                # FurMark score thuong = avg FPS * 1000 (xap xi)
                $lastScoreLog = [int]($fpsAvg * 1000)
                Write-Host "  [i] Tinh score tu FPS avg: $fpsAvg -> $lastScoreLog" -ForegroundColor DarkGray
            }
        }
        # Pattern 3: "Average FPS: 60.5" (mot so version)
        if ($fpsAvg -eq 0) {
            $avgFps = [regex]::Match($logContent, '(?i)average\s*fps\s*[:=]\s*(\d+(?:\.\d+)?)')
            if ($avgFps.Success) { $fpsAvg = [double]$avgFps.Groups[1].Value }
        }
    } catch {}
}
$score = $lastScoreLog

# Fallback: neu khong parse duoc score -> hoi user
if ($score -le 0) {
    Write-Warn "Khong tu dong parse duoc score tu log FurMark."
    Write-Host "  Vui long xem so Score tren man hinh FurMark (hoac mo file log):" -ForegroundColor DarkGray
    if (Test-Path $scoreLog) {
        Write-Host "  Log: $scoreLog" -ForegroundColor DarkGray
    }
    while ($true) {
        $userScore = Read-Host "  Nhap diem GPU (Enter de bo qu)"
        if ([string]::IsNullOrWhiteSpace($userScore)) {
            Write-Warn "Bo qua score. Payload se co gpuScore = null."
            break
        }
        $tryScore = 0
        if ([int]::TryParse($userScore.Trim(), [ref]$tryScore) -and $tryScore -gt 0) {
            $score = $tryScore
            Write-OK "Da lay score: $score"
            break
        }
        Write-Warn "Score phai la so nguyen > 0."
    }
} else {
    Write-OK "Score: $score (FPS avg: $fpsAvg)"
}

# Cleanup
Remove-Item $scoreLog -Force -ErrorAction SilentlyContinue
Remove-Item $errorLog -Force -ErrorAction SilentlyContinue

# Dien benchmark vao payload
$payload.benchmark.gpuScore = $score
$payload.benchmark.fpsAvg   = $fpsAvg
$payload.benchmark.testWidth  = $actualWidth
$payload.benchmark.testHeight = $actualHeight
$payload.benchmark.testPreset = "${Preset}p"
$payload.benchmark.duration   = $totalSec
} # end if (-not $SkipBenchmark)

# ============================================================
#  Stage 4: Build payload (canonical) + HMAC sign
# ============================================================
Write-Step "Ky HMAC-SHA256 payload..."
$signature = Compute-HmacSha256 -Payload $payload -Secret $SharedSecret
Write-OK "Signature: $($signature.Substring(0,16))..."

# ============================================================
#  Stage 5: In payload (optional) + POST upload + open browser
# ============================================================
if (-not $AutoUpload) {
    Write-Host ""
    Write-Warn "AutoUpload = false. In payload ra stdout (khong POST)."
    $payloadForJson = $payload.Clone()
    $payloadForJson.signature = $signature
    $payloadForJson | ConvertTo-Json -Depth 10 -Compress
    Write-Host ""
    Read-Host "Nhan Enter de dong"
    exit 0
}

$body = $payload.Clone()
$body.signature = $signature
$bodyJson = $body | ConvertTo-Json -Depth 10 -Compress

Write-Step "POST /api/v1/mini-tool/upload..."
try {
    $resp = Invoke-ApiJson -Method POST `
        -Uri "$ApiBase/api/v1/mini-tool/upload?sid=$SessionId" `
        -Body $body `
        -TimeoutSec 60

    if (-not $resp.ok) {
        throw "Server tu choi: $($resp.error.message)"
    }
    $laptopId = $resp.data.laptopId
    # gpuRank is computed client-side (or from /ranking API); here we just show pending.
    $rank     = "Pending"
    $specsUpdated = $resp.data.saved.specsUpdated
    $benchmarkId = $resp.data.saved.benchmarkId
    Write-OK "Upload thanh cong! Laptop ID: $laptopId"
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "   DA LEN BANG XEP HANG!                   " -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  GPU Score : $score" -ForegroundColor White
    Write-Host "  Hang      : $rank" -ForegroundColor White
    Write-Host "  URL leaderboard: $ApiBase/test-laptop?highlight=$laptopId" -ForegroundColor Cyan
    Write-Host ""
    Write-Step "Mo trinh duyet..."
    try {
        Start-Process "$ApiBase/test-laptop?highlight=$laptopId&rank=$rank"
    } catch {
        Write-Warn "Khong tu mo duoc trinh duyet. Vao URL ben tren de xem."
    }
} catch {
    Write-Fail "Upload that bai: $_"
    Write-Host "  Ban co the copy payload ben duoi va POST thu cong:" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host $bodyJson
    throw
}

Read-Host "  Nhan Enter de dong"
exit 0
