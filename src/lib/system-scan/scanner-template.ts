// PowerShell template cho lap la p toolcheck mini - duoc nhung inline vi Worker
// (Cloudflare) khong co filesystem. File .ps1 tham chieu o `scripts/laplap-toolcheck-mini.ps1`
// la nguon can doi (dung khi dev local). Khi muon deploy, copy noi dung vao day
// (hoac dung script build-exe.ps1 de build script_embed.ts tu .ps1).
//
// Trong route /api/v1/system-scan/download, template duoc chen token bang replaceAll
// roi dong goi vao file zip cung voi LapLap-Scanner.bat + README.txt.
export const SCANNER_PS1_TEMPLATE = String.raw`param(
    [string]$ApiBase = "__API_BASE__",
    [string]$ScanToken = "__SCAN_TOKEN__"
)

# LapLap Toolcheck MINI - scanner nhanh (WMI / powercfg), KHONG can goi Toolcheck ngoai.
# Them tuy chon: neu nguoi dung da co thu muc Toolcheck canh script (tai lan truoc)
# thi hien menu mo CrystalDiskInfo / FurMark / GPU-Z / BatteryMon nhu cu.
$ErrorActionPreference = "SilentlyContinue"
$OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ToolRoot = Join-Path $ScriptRoot "Toolcheck"
$SubmitUrl = "$ApiBase/api/v1/system-scan/submit?token=$ScanToken"

$script:LastDeviceId = $env:COMPUTERNAME
$script:LastDeviceName = $env:COMPUTERNAME

function Write-Step { param($Message) Write-Host "  >> $Message" -ForegroundColor Cyan }
function Write-OK   { param($Message) Write-Host "  [OK] $Message" -ForegroundColor Green }
function Write-Warn { param($Message) Write-Host "  [!] $Message" -ForegroundColor Yellow }
function Write-Fail { param($Message) Write-Host "  [X] $Message" -ForegroundColor Red }
function NZ($Value, $Default) {
    if ($null -ne $Value -and [string]$Value -ne "") { return $Value }
    return $Default
}

function Invoke-ScanStatus {
    param([string]$Status)
    try {
        Invoke-RestMethod -Uri "$SubmitUrl&status=$Status" -Method Post -TimeoutSec 10 | Out-Null
    } catch {}
}

function Get-RamType {
    param($Module)
    $map = @{ 20 = "DDR"; 21 = "DDR2"; 24 = "DDR3"; 26 = "DDR4"; 34 = "DDR5" }
    $type = "N/A"
    if ($Module -and $Module.SMBIOSMemoryType -and $map.ContainsKey([int]$Module.SMBIOSMemoryType)) {
        $type = $map[[int]$Module.SMBIOSMemoryType]
    } elseif ($Module -and $Module.Speed) {
        $speed = [int]$Module.Speed
        if ($speed -ge 4000) { $type = "DDR5" }
        elseif ($speed -ge 1600) { $type = "DDR4" }
        elseif ($speed -ge 800)  { $type = "DDR3" }
    }
    return $type
}

function Get-StorageKind {
    param($Disk, $PhysicalDisk)
    $bus = if ($PhysicalDisk) { [string]$PhysicalDisk.BusType } else { "" }
    $media = if ($PhysicalDisk) { [string]$PhysicalDisk.MediaType } else { "" }
    if ($bus -eq "NVMe" -or $Disk.Model -like "*NVMe*") { return "NVMe SSD" }
    if ($media -eq "SSD" -or $Disk.Model -like "*SSD*") { return "SATA SSD" }
    if ($media -eq "HDD" -or $bus -eq "SATA") { return "HDD" }
    if ($Disk.Model -like "*SSD*") { return "SSD" }
    if ($bus) { return $bus }
    return "N/A"
}

# Lay suc khoe o cung - CHI dung WMI / Storage (khong can CrystalDiskInfo portable).
# SSD: lay Wear tu Get-StorageReliabilityCounter (do nha sx cung cap).
# HDD: doc WMI SMART attributes de suy ra trang thai that.
function Get-DiskHealthReport {
    param([string]$DiskModel, [string]$Kind, $PhysicalDisk)

    $health = "N/A"
    $status = "N/A"
    $temp = "N/A"
    $power = "N/A"
    $source = "Windows"

    $rc = $null
    if ($PhysicalDisk) {
        try { $rc = Get-StorageReliabilityCounter -PhysicalDisk $PhysicalDisk -ErrorAction SilentlyContinue } catch {}
    }

    if ($rc -and $rc.Wear -ne $null -and $rc.Wear -ge 0) {
        $health = [string](100 - [int]$rc.Wear) + "%"
    }

    if ($rc -and $rc.Temperature -gt 0) {
        $temp = [string][int]$rc.Temperature + " C"
    }
    if ($rc -and $rc.PowerOnHours -gt 0) {
        $power = [string][int]$rc.PowerOnHours + " gio"
    }

    if ($Kind -like "*SSD*") {
        $source = "Windows Reliability"
        if ($PhysicalDisk -and $PhysicalDisk.HealthStatus) { $status = [string]$PhysicalDisk.HealthStatus }
        return @{
            health = $health; status = $status; temperature = $temp
            powerOnTime = $power; source = $source; performance = "N/A"
        }
    }

    # HDD SMART - WMI MSStorageDriver_ATAPISmartData VendorSpecific la mang byte
    # 2 byte header + 30 attribute (12 byte moi). Doc truc tiep byte vi PS
    # khong co helper san cho S.M.A.R.T. raw.
    #   ID  5 = ReallocatedSectorsCount (HDD xau khi co bad sector)
    #   ID 10 = SpinRetryCount (motor yeu)
    #   ID 187 = ReportedUncorrectableErrors
    #   ID 188 = CommandTimeout
    #   ID 194 = Temperature (C)
    #   ID 196 = ReallocationEventCount
    #   ID 197 = CurrentPendingSectorCount (chua remap)
    #   ID 198 = OfflineUncorrectable
    $predictFailure = $null
    try {
        $fp = Get-CimInstance -Namespace "root/wmi" -ClassName MSStorageDriver_FailurePredictStatus -ErrorAction SilentlyContinue
        if ($fp) { $predictFailure = $fp.PredictFailure }
    } catch {}

    $reallocated = $null
    $pending = $null
    $tempC = $null
    try {
        $smartBlocks = @(Get-CimInstance -Namespace "root/wmi" -ClassName MSStorageDriver_ATAPISmartData -ErrorAction SilentlyContinue)
        foreach ($sb in $smartBlocks) {
            $vendor = $sb.VendorSpecific
            if (-not $vendor) { continue }
            $bytes = $sb.VendorSpecific
            for ($i = 2; $i -lt $bytes.Count; $i += 12) {
                $id = [int]$bytes[$i]
                $raw = [int]([uint32]$bytes[$i + 5] -bor ([uint32]$bytes[$i + 6] -shl 8) -bor ([uint32]$bytes[$i + 7] -shl 16) -bor ([uint32]$bytes[$i + 8] -shl 24))
                switch ($id) {
                    5  { if ($null -eq $reallocated -or $raw -gt $reallocated) { $reallocated = $raw } }
                    197 { if ($null -eq $pending -or $raw -gt $pending) { $pending = $raw } }
                    194 { if ($null -eq $tempC) { $tempC = $raw } }
                }
            }
        }
    } catch {}

    if ($tempC -ne $null -and $tempC -gt 0) { $temp = "$tempC C" }
    if ($power -eq "N/A" -and $rc -and $rc.PowerOnHours -gt 0) { $power = [string][int]$rc.PowerOnHours + " gio" }

    if ($null -ne $reallocated -or $null -ne $pending -or ($predictFailure -ne $null)) {
        $source = "SMART"
        if ($null -ne $reallocated -and $reallocated -gt 10) {
            $status = "Critical"; $health = "Bi loi nhieu"
        } elseif (($null -ne $pending -and $pending -gt 0) -or ($null -ne $reallocated -and $reallocated -gt 0)) {
            $status = "Warning"; $health = "Co dau hieu loi"
        } elseif ($predictFailure) {
            $status = "Warning"; $health = "SMART canh bao"
        } else {
            $status = "Healthy"; $health = "Tot"
        }
    } else {
        $source = "Windows SMART"
        $status = "Healthy"; $health = "Tot"
    }

    return @{
        health = $health; status = $status; temperature = $temp
        powerOnTime = $power; source = $source; performance = "N/A"
    }
}

function Invoke-SystemScan {
    Clear-Host
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  LAPLAP TOOLCHECK (mini) - SYSTEM SCANNER" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Token : $ScanToken" -ForegroundColor DarkGray
    Write-Host "Server: $ApiBase" -ForegroundColor DarkGray
    Write-Host ""

    Invoke-ScanStatus -Status "scanning"

    Write-Step "[1/6] Dang quet CPU..."
    $cpu = Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1
    $cpuTempC = "N/A"
    try {
        $tz = Get-CimInstance -Namespace "root/wmi" -ClassName MSAcpi_ThermalZoneTemperature
        if ($tz -and $tz.CurrentTemperature) {
            $cpuTempC = [string]([math]::Round(($tz.CurrentTemperature / 10) - 273.15, 1)) + " C"
        }
    } catch {}

    Write-Step "[2/6] Dang quet GPU..."
    $gpus = @(Get-CimInstance -ClassName Win32_VideoController | Where-Object { $_.Name -and $_.Name -ne "" })
    $regGpus = @(Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\*" -ErrorAction SilentlyContinue | Where-Object { $_."HardwareInformation.qwMemorySize" })
    $gpuArr = @()
    foreach ($g in $gpus) {
        $vram = "N/A"
        $match = $regGpus | Where-Object { $_.DriverDesc -eq $g.Name } | Select-Object -First 1
        if (-not $match) {
            $match = $regGpus | Where-Object { $g.Name -like ("*" + $_.DriverDesc + "*") -or $_.DriverDesc -like ("*" + $g.Name + "*") } | Select-Object -First 1
        }
        if ($match -and $match."HardwareInformation.qwMemorySize") { $vram = [math]::Round([int64]$match."HardwareInformation.qwMemorySize" / 1GB, 1) }
        elseif ($g.AdapterRAM -gt 0) { $vram = [math]::Round($g.AdapterRAM / 1GB, 1) }
        $gpuArr += @{ name = (NZ $g.Name "N/A"); vram = $vram; driver = (NZ $g.DriverVersion "N/A"); temp = "N/A" }
    }

    Write-Step "[3/6] Dang quet RAM..."
    $ram = @(Get-CimInstance -ClassName Win32_PhysicalMemory)
    $ramArray = Get-CimInstance -ClassName Win32_PhysicalMemoryArray | Select-Object -First 1
    $totalRAM = if ($ram) { ($ram | Measure-Object -Property Capacity -Sum).Sum / 1GB } else { 0 }
    $ramType = if ($ram.Count -gt 0) { Get-RamType $ram[0] } else { "N/A" }
    $ramSpeed = if ($ram.Count -gt 0 -and $ram[0].Speed) { [int]$ram[0].Speed } else { "N/A" }
    $ramModules = @()
    foreach ($m in $ram) {
        $mType = Get-RamType $m
        $slotName = if ($m.BankLabel -and $m.DeviceLocator) { [string]$m.BankLabel + " / " + [string]$m.DeviceLocator } else { (NZ $m.DeviceLocator (NZ $m.BankLabel "N/A")) }
        $ramModules += @{
            slot = $slotName
            capacity = [math]::Round($m.Capacity / 1GB, 0)
            manufacturer = (NZ ([string]$m.Manufacturer).Trim() "N/A")
            type = $mType
            speed = if ($m.Speed) { [string][int]$m.Speed + " MHz" } else { "N/A" }
            partNumber = (NZ ([string]$m.PartNumber).Trim() "N/A")
        }
    }
    $slots = if ($ramArray -and $ramArray.MemoryDevices) { [int]$ramArray.MemoryDevices } else { $ram.Count }
    $maxUp = if ($ramArray -and $ramArray.MaxCapacity) { [string]([math]::Round($ramArray.MaxCapacity / 1MB, 0)) + " GB" } else { "N/A" }

    Write-Step "[4/6] Dang quet o cung (WMI SMART)..."
    $disks = @(Get-CimInstance -ClassName Win32_DiskDrive)
    $phys = @()
    try { $phys = @(Get-PhysicalDisk) } catch {}
    $logical = @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=3")
    $freeTotal = if ($logical) { ($logical | Measure-Object -Property FreeSpace -Sum).Sum / 1GB } else { 0 }

    $storageArr = @()
    foreach ($d in $disks) {
        $pd = $phys | Where-Object { $_.DeviceId -eq $d.Index -or $_.FriendlyName -eq $d.Model } | Select-Object -First 1
        $kind = Get-StorageKind -Disk $d -PhysicalDisk $pd
        $healthReport = Get-DiskHealthReport -DiskModel ([string]$d.Model) -Kind $kind -PhysicalDisk $pd

        $finalStatus = $healthReport.status
        if ($finalStatus -eq "N/A" -and $pd -and $pd.HealthStatus) { $finalStatus = [string]$pd.HealthStatus }
        if ($finalStatus -eq "N/A" -and $d.Status) { $finalStatus = [string]$d.Status }

        $storageArr += @{
            name        = (NZ $d.Model "N/A")
            capacity    = if ($d.Size) { [math]::Round($d.Size / 1GB, 1) } else { "N/A" }
            type        = $kind
            free        = "N/A"
            temp        = $healthReport.temperature
            health      = $healthReport.health
            performance = $healthReport.performance
            powerOnTime = $healthReport.powerOnTime
            status      = $finalStatus
            source      = $healthReport.source
        }
    }
    if ($storageArr.Count -gt 0) { $storageArr[0].free = [math]::Round($freeTotal, 1) }

    Write-Step "[5/6] Dang quet pin..."
    $designedmWh = "N/A"
    $fullmWh = "N/A"
    $batteryHealth = "N/A"
    $cycles = "N/A"
    $dCap = 0
    $fCap = 0
    try {
        $bStatic = Get-CimInstance -Namespace "root/wmi" -ClassName BatteryStaticData
        $bFull   = Get-CimInstance -Namespace "root/wmi" -ClassName BatteryFullChargedCapacity
        $dCap = [int]($bStatic | Select-Object -First 1).DesignedCapacity
        $fCap = [int]($bFull   | Select-Object -First 1).FullChargedCapacity
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
                    if ([int]$bat.DesignCapacity -gt 0)     { $dCap = [int]$bat.DesignCapacity }
                    if ([int]$bat.FullChargeCapacity -gt 0) { $fCap = [int]$bat.FullChargeCapacity }
                    if ([int]$bat.CycleCount -gt 0)         { $cycles = [int]$bat.CycleCount }
                }
                Remove-Item $rptPath -Force -ErrorAction SilentlyContinue
            }
        } catch {}
    }
    if ($dCap -gt 0) { $designedmWh = $dCap }
    if ($fCap -gt 0) { $fullmWh     = $fCap }
    if ($dCap -gt 0 -and $fCap -gt 0) {
        $batteryHealth = [string]([math]::Round(($fCap / $dCap) * 100, 1)) + "%"
    }
    if ($cycles -eq "N/A") {
        try {
            $wb = Get-CimInstance -ClassName Win32_Battery | Select-Object -First 1
            if ($wb -and $wb.CycleCount) { $cycles = [int]$wb.CycleCount }
        } catch {}
    }

    Write-Step "[6/6] Dang quet man hinh / he thong..."
    $sysInfo = Get-CimInstance -ClassName Win32_ComputerSystem
    $bios    = Get-CimInstance -ClassName Win32_BIOS
    $vc = $gpus | Where-Object { $_.CurrentHorizontalResolution -gt 0 } | Select-Object -First 1
    if (-not $vc) { $vc = $gpus | Select-Object -First 1 }
    $resolution = if ($vc -and $vc.CurrentHorizontalResolution) { [string]$vc.CurrentHorizontalResolution + " x " + [string]$vc.CurrentVerticalResolution } else { "N/A" }
    $refresh    = if ($vc -and $vc.CurrentRefreshRate) { [string]$vc.CurrentRefreshRate + " Hz" } else { "N/A" }
    $screenSize = "N/A"
    try {
        $mon = Get-CimInstance -Namespace "root/wmi" -ClassName WmiMonitorBasicDisplayParams | Select-Object -First 1
        if ($mon -and $mon.MaxHorizontalImageSize -gt 0) {
            $diag = [math]::Sqrt([math]::Pow($mon.MaxHorizontalImageSize, 2) + [math]::Pow($mon.MaxVerticalImageSize, 2)) / 2.54
            $screenSize = [string][math]::Round($diag, 1) + " inch"
        }
    } catch {}

    $wifiProfiles = @()
    try {
        $profileLines = netsh wlan show profiles | Select-String "All User Profile"
        if ($profileLines) {
            $wifiProfiles = $profileLines | ForEach-Object { $_.Line.Split(":")[1].Trim() }
        }
    } catch {}

    $wifiArr = @()
    foreach ($w in $wifiProfiles) { $wifiArr += @{ ssid = $w; security = "WPA2" } }
    $script:LastDeviceId   = (NZ $bios.SerialNumber $env:COMPUTERNAME)
    $script:LastDeviceName = (NZ $sysInfo.Model (NZ $sysInfo.Name $env:COMPUTERNAME))

    $result = @{
        cpu = @{
            name       = (NZ $cpu.Name "Unknown")
            cores      = (NZ $cpu.NumberOfCores 0)
            threads    = (NZ $cpu.NumberOfLogicalProcessors 0)
            baseClock  = if ($cpu.MaxClockSpeed) { [string]$cpu.MaxClockSpeed + " MHz" } else { "N/A" }
            boostClock = "N/A"
            tdp        = "N/A"
            temp       = $cpuTempC
        }
        gpu     = $gpuArr
        ram     = @{
            total      = [string][math]::Round($totalRAM, 1) + " GB"
            type       = $ramType
            speed      = if ($ramSpeed -ne "N/A") { [string]$ramSpeed + " MHz" } else { "N/A" }
            slots      = $slots
            used       = $ram.Count
            free       = ($slots - $ram.Count)
            maxUpgrade = $maxUp
            modules    = $ramModules
        }
        storage = $storageArr
        battery = @{
            designed = if ($designedmWh -ne "N/A") { [string]$designedmWh + " mWh" } else { "N/A" }
            current  = if ($fullmWh -ne "N/A")     { [string]$fullmWh    + " mWh" } else { "N/A" }
            health   = $batteryHealth
            cycles   = $cycles
        }
        screen = @{
            resolution  = $resolution
            refreshRate = $refresh
            panel       = "N/A"
            size        = $screenSize
        }
        system = @{
            name       = (NZ $sysInfo.Name "Unknown")
            serial     = (NZ $bios.SerialNumber "N/A")
            windowsKey = "N/A"
            wifiSaved  = $wifiArr
            wifiNearby = @()
        }
    }

    $json = $result | ConvertTo-Json -Depth 12 -Compress
    Write-Step "Dang gui ket qua len server..."
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
        Invoke-RestMethod -Uri $SubmitUrl -Method Post -Body $bytes -ContentType "application/json; charset=utf-8" -TimeoutSec 30 | Out-Null
        Write-Host ""
        Write-Host "================================================" -ForegroundColor Green
        Write-Host "  QUET THANH CONG! DA GUI LEN SERVER!" -ForegroundColor Green
        Write-Host "================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Vui long mo trinh duyet de xem ket qua." -ForegroundColor Yellow
    } catch {
        Write-Host ""
        Write-Fail "Khong the gui du lieu len server."
        Write-Warn $_.Exception.Message
    }
}

function Open-Tool {
    param([string]$Label, [string[]]$RelativePaths)
    foreach ($rel in $RelativePaths) {
        $full = Join-Path $ToolRoot $rel
        if (Test-Path $full) {
            Write-OK "Mo $Label..."
            Start-Process -FilePath $full -WorkingDirectory (Split-Path $full -Parent)
            return
        }
    }
    Write-Warn "Khong tim thay $Label trong Toolcheck (hay bo qua neu ban khong can)."
}

function Show-ToolMenu {
    if (-not (Test-Path $ToolRoot)) {
        Write-Host ""
        Write-Host "  Scanner mini khong can goi Toolcheck ngoai." -ForegroundColor DarkGray
        Write-Host "  Ban co the dong cua so nay." -ForegroundColor DarkGray
        Write-Host ""
        Read-Host "Nhan Enter de dong"
        return
    }
    while ($true) {
        Write-Host ""
        Write-Host "================ TOOLCHECK MENU ================" -ForegroundColor Cyan
        Write-Host "  1) Mo CrystalDiskInfo"
        Write-Host "  2) Mo FurMark GUI"
        Write-Host "  3) Mo GPU-Z"
        Write-Host "  4) Mo BatteryMon"
        Write-Host "  5) Mo thu muc Toolcheck"
        Write-Host "  6) Quet lai he thong"
        Write-Host "  0) Thoat"
        Write-Host "================================================"
        $choice = Read-Host "Chon tinh nang"
        switch ($choice.Trim()) {
            "1" { Open-Tool "CrystalDiskInfo" @("CrystalDiskInfoPortable\App\CrystalDiskInfo\DiskInfo64.exe", "CrystalDiskInfoPortable\App\CrystalDiskInfo\DiskInfoA64.exe", "CrystalDiskInfoPortable\App\CrystalDiskInfo\DiskInfo32.exe", "CrystalDiskInfo\DiskInfo64.exe", "CrystalDiskInfo\DiskInfo32.exe", "CrystalDiskInfo\DiskInfo.exe") }
            "2" { Open-Tool "FurMark GUI" @("FurMark_win64\FurMark_GUI.exe", "FurMark_win64\_fm2-gui.exe") }
            "3" { Open-Tool "GPU-Z" @("FurMark_win64\gpuz\gpuz.exe") }
            "4" { Open-Tool "BatteryMon" @("pin\BatteryMonx64.exe", "pin\BatteryMon.exe") }
            "5" { if (Test-Path $ToolRoot) { Start-Process explorer.exe $ToolRoot } else { Write-Warn "Khong tim thay thu muc Toolcheck." } }
            "6" { Invoke-SystemScan }
            "0" { return }
            default { Write-Warn "Lua chon khong hop le." }
        }
    }
}

# === TOOLS LAZY DOWNLOADER (Phase 2) ===
# Server command-poll se goi khi user nhan tool tren UI.
# Khi nhan command launch-tool:<id>: PS1 download file zip/exe tu server
# luu vao %LOCALAPPDATA%\LapLap\Tools\<id>\<file>
# Verify SHA256 -> extract neu la zip -> launch .exe.
$Global:ToolsRoot = Join-Path $env:LOCALAPPDATA "LapLap\Tools"
if (-not (Test-Path $Global:ToolsRoot)) {
    New-Item -ItemType Directory -Path $Global:ToolsRoot -Force | Out-Null
}

function Get-LocalToolPath {
    param([string]$ToolId)
    return Join-Path $Global:ToolsRoot $ToolId
}

function Test-ToolInstalled {
    param([string]$ToolId, [string]$ExecName)
    $dir = Get-LocalToolPath $ToolId
    # Kiem tra exec co ton tai (extract roi) hoac file exe truc tiep da tai.
    $extracted = Get-ChildItem -Path $dir -Recurse -Filter $ExecName -ErrorAction SilentlyContinue | Select-Object -First 1
    return [bool]$extracted
}

function Send-Progress {
    # Gui progress len server de UI hien thi.
    # Su dung REST API nhe, khong block download chinh.
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
        $bytes = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress))
        Invoke-RestMethod -Uri "$ApiBase/api/v1/system-scan/progress?token=$ScanToken" -Method Post -Body $bytes -ContentType "application/json; charset=utf-8" -TimeoutSec 5 | Out-Null
    } catch {
        # Silent - progress loi khong can fail.
    }
}

function Get-FileSha256 {
    # Compute SHA256 cua file. Dung .NET de nhanh (PS native rat cham).
    param([string]$Path)
    try {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        $stream = [System.IO.File]::OpenRead($Path)
        try {
            $hashBytes = $sha.ComputeHash($stream)
        } finally {
            $stream.Close()
            $sha.Dispose()
        }
        return ([BitConverter]::ToString($hashBytes) -replace "-", "").ToLowerInvariant()
    } catch {
        return $null
    }
}

function Invoke-ToolDownload {
    param(
        [string]$ToolId,
        [string]$ToolName,
        [string]$ExecName,
        [bool]$Extract,
        [string[]]$LaunchArgs
    )

    $dir = Get-LocalToolPath $ToolId
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

    # Neu da install roi (extract) va exec con ton tai -> chi can launch.
    if ($Extract -and (Test-ToolInstalled $ToolId $ExecName)) {
        Write-OK "$ToolName da san sang, khoi dong..."
        Send-Progress -ToolId $ToolId -Stage "launching" -Percent 95 -Message "Da cai san, khoi dong..."
        $exe = (Get-ChildItem -Path $dir -Recurse -Filter $ExecName -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
        if ($LaunchArgs -and $LaunchArgs.Count -gt 0) {
            Start-Process -FilePath $exe -ArgumentList $LaunchArgs -WorkingDirectory (Split-Path $exe -Parent)
        } else {
            Start-Process -FilePath $exe -WorkingDirectory (Split-Path $exe -Parent)
        }
        Send-Progress -ToolId $ToolId -Stage "done" -Percent 100 -Message "Da mo $ToolName"
        return
    }

    # Tai file zip/exe tu server.
    $url = "$ApiBase/api/v1/tools/download?toolId=$ToolId"
    $ext = if ($Extract) { "zip" } else { "exe" }
    $zipPath = Join-Path $dir "$ToolId.$ext"

    Send-Progress -ToolId $ToolId -Stage "downloading" -Percent 0 -Message "Bat dau tai $ToolName..."

    Write-Step "Dang tai $ToolName tu server..."
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

        # Dung HttpClient + stream de co the bao progress % (Invoke-WebRequest
        # ProgressBar cu chi hien thi tren console, khong hook vao duoc).
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add("User-Agent", "LapLap-Toolcheck-Mini/1.0")

        # Hook event de bao progress len server moi 5%.
        $lastReported = -1
        Register-ObjectEvent -InputObject $wc -EventName DownloadProgressChanged -Action {
            $pct = $EventArgs.ProgressPercentage
            if ($pct - $script:lastReported -ge 5 -or $pct -eq 100) {
                $script:lastReported = $pct
                Send-Progress -ToolId $using:ToolId -Stage "downloading" -Percent $pct -Message "Dang tai $using:ToolName... $pct%"
            }
        } | Out-Null

        $wc.DownloadFile($url, $zipPath)
        $wc.Dispose()
        Unregister-Event -SourceIdentifier $wc.DownloadProgressChanged.Name -ErrorAction SilentlyContinue
    } catch {
        $msg = $_.Exception.Message
        Write-Fail "Tai $ToolName that bai: $msg"
        Send-Progress -ToolId $ToolId -Stage "error" -Percent 0 -Message "Loi tai: $msg"
        return
    }

    if (-not (Test-Path $zipPath)) {
        Write-Fail "File tai ve khong ton tai."
        Send-Progress -ToolId $ToolId -Stage "error" -Percent 0 -Message "File khong ton tai sau tai"
        return
    }

    # === SHA256 VERIFY ===
    # Server tra X-Tool-Sha256 qua header response. Voi Invoke-WebRequest co
    # the lay headers tu response, voi HttpClient thi phai gui 1 request
    # HEAD rieng. Don gian nhat: gui 1 GET request voi Range 0-0 chi de lay
    # headers, sau do download file that.
    #
    # Tuy nhien vi PS native lay headers tu DownloadFile kho, ta lam theo
    # cach thu cong: tai file, compute SHA256, verify voi expected hash.
    # Expected hash = catalog metadata (ta hardcode trong $ExpectedSha256Map).
    #
    # Hash catalog (phai khop voi src/lib/tools/catalog.ts):
    $ExpectedSha256Map = @{
        "cpu-z"            = "320e073a6f387464ac3faac5f010b5fe70e31fab30745883d023c8372e80f3c5"
        "furmark"          = "27ab2e723e2e65df720bcafea681d2104744eda4a1e0a0374d7e61eaa820e63b"
        "crystaldiskmark"  = "386f1d2f05a2f8c0a1a0b7d8deda63b8fd594ad9e90a2c4e75812348398dfa53"
        "gpu-z"            = "VERIFY_REQUIRED"
        "hwinfo"           = "VERIFY_REQUIRED"
        "hdsentinel"       = "VERIFY_REQUIRED"
    }
    $expectedHash = $ExpectedSha256Map[$ToolId]

    Send-Progress -ToolId $ToolId -Stage "verifying" -Percent 75 -Message "Dang verify SHA256..."

    $actualHash = Get-FileSha256 -Path $zipPath
    if (-not $actualHash) {
        Write-Warn "Khong the tinh SHA256, bo qua verify."
        Send-Progress -ToolId $ToolId -Stage "verifying" -Percent 75 -Message "Bo qua verify (file read error)" -VerifyStatus "skipped"
    } elseif ($expectedHash -eq "VERIFY_REQUIRED") {
        # Hash chua biet -> tin tuong file nhung log de admin sau nay verify.
        Write-Warn "Hash chua co trong catalog (VERIFY_REQUIRED). File da tai, SHA256=$actualHash"
        Write-Host "  (Hash that: $actualHash)" -ForegroundColor DarkGray
        Send-Progress -ToolId $ToolId -Stage "verifying" -Percent 75 -Message "Unverified (hash chua co trong catalog)" -ActualSha256 $actualHash -VerifyStatus "unverified"
    } elseif ($actualHash -ne $expectedHash) {
        Write-Fail "SHA256 KHONG KHOP!"
        Write-Host "  Expected: $expectedHash" -ForegroundColor Red
        Write-Host "  Actual:   $actualHash" -ForegroundColor Red
        Write-Warn "File co the bi hong hoac bi CDN cache version cu. Thu download lai 1 lan..."

        Send-Progress -ToolId $ToolId -Stage "error" -Percent 50 -Message "SHA256 mismatch, retry..." -ActualSha256 $actualHash -VerifyStatus "mismatch"

        # Retry 1 lan (CDN co the tra file cu).
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            (New-Object System.Net.WebClient).DownloadFile($url, $zipPath)
        } catch {
            Write-Fail "Retry that bai."
            Send-Progress -ToolId $ToolId -Stage "error" -Percent 0 -Message "Retry download that bai"
            Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
            return
        }

        $actualHash2 = Get-FileSha256 -Path $zipPath
        if ($actualHash2 -ne $expectedHash) {
            Write-Fail "SHA256 van khong khop sau retry. Huy."
            Send-Progress -ToolId $ToolId -Stage "error" -Percent 0 -Message "SHA256 mismatch sau retry" -ActualSha256 $actualHash2 -VerifyStatus "mismatch"
            Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
            return
        }
        Write-OK "SHA256 da khop sau retry."
        Send-Progress -ToolId $ToolId -Stage "verifying" -Percent 75 -Message "Verify OK (sau retry)" -ActualSha256 $actualHash2 -VerifyStatus "ok"
    } else {
        Write-OK "SHA256 verified."
        Send-Progress -ToolId $ToolId -Stage "verifying" -Percent 75 -Message "Verify OK" -ActualSha256 $actualHash -VerifyStatus "ok"
    }

    # Extract neu la zip.
    if ($Extract) {
        Send-Progress -ToolId $ToolId -Stage "extracting" -Percent 85 -Message "Dang giai nen..."
        Write-Step "Dang giai nen..."
        try {
            Expand-Archive -Path $zipPath -DestinationPath $dir -Force -ErrorAction Stop
            Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Warn "Giai nen that bai, giu zip de debug."
            Send-Progress -ToolId $ToolId -Stage "error" -Percent 90 -Message "Giai nen that bai: $($_.Exception.Message)"
        }
    }

    # Launch.
    if ($Extract) {
        $exe = (Get-ChildItem -Path $dir -Recurse -Filter $ExecName -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
    } else {
        $exe = $zipPath
    }

    if (-not $exe -or -not (Test-Path $exe)) {
        Write-Fail "Khong tim thay file thuc thi $ExecName trong $dir."
        Send-Progress -ToolId $ToolId -Stage "error" -Percent 90 -Message "Khong tim thay $ExecName"
        Write-Host "  Noi dung:" -ForegroundColor DarkGray
        Get-ChildItem -Path $dir -Recurse | Select-Object FullName | ForEach-Object { Write-Host "    $($_.FullName)" -ForegroundColor DarkGray }
        return
    }

    Send-Progress -ToolId $ToolId -Stage "launching" -Percent 95 -Message "Khoi dong $ToolName..."
    Write-OK "Khoi dong $ToolName..."
    if ($LaunchArgs -and $LaunchArgs.Count -gt 0) {
        Start-Process -FilePath $exe -ArgumentList $LaunchArgs -WorkingDirectory (Split-Path $exe -Parent)
    } else {
        Start-Process -FilePath $exe -WorkingDirectory (Split-Path $exe -Parent)
    }
    Send-Progress -ToolId $ToolId -Stage "done" -Percent 100 -Message "Da mo $ToolName"
}

function Start-CommandPoller {
    # Background loop poll server moi 3s de nhan command launch tool.
    # Chay song song voi menu, khong block menu input.
    $pollUrl = "$ApiBase/api/v1/system-scan/command-poll?token=$ScanToken"
    $running = $true

    while ($running) {
        try {
            $resp = Invoke-RestMethod -Uri $pollUrl -Method Get -TimeoutSec 5 -ErrorAction Stop
            if ($resp -and $resp.ok -and $resp.data -and $resp.data.command) {
                $cmd = $resp.data.command
                Write-Host ""
                Write-Host "  [REMOTE] Server yeu cau: $($cmd.action) $($cmd.toolName)" -ForegroundColor Magenta
                if ($cmd.action -eq "launch-tool") {
                    $extract = [bool]$cmd.extract
                    $args = if ($cmd.args) { $cmd.args } else { @() }
                    Invoke-ToolDownload -ToolId $cmd.toolId -ToolName $cmd.toolName -ExecName $cmd.exec -Extract $extract -LaunchArgs $args
                }
            }
        } catch {
            # Silent - poll loi khong can thong bao.
        }
        Start-Sleep -Seconds 3
    }
}

# Khoi dong command poller o background job (chay song song, khong block menu).
# Start-Job spawn process moi, de main thread xu ly menu input.
$pollerJob = Start-Job -ScriptBlock {
    param($Url)
    while ($true) {
        try {
            $r = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 5 -ErrorAction Stop
            if ($r -and $r.ok -and $r.data -and $r.data.command) {
                # Job khong the Start-Process truc tiep -> gui command ve main thread
                # qua file intermediate. Main thread se poll file nay.
                $cmdJson = $r.data.command | ConvertTo-Json -Compress
                $cmdFile = Join-Path $env:LOCALAPPDATA "LapLap\pending-cmd.json"
                [System.IO.File]::WriteAllText($cmdFile, $cmdJson, [System.Text.Encoding]::UTF8)
            }
        } catch {}
        Start-Sleep -Seconds 3
    }
} -ArgumentList "$ApiBase/api/v1/system-scan/command-poll?token=$ScanToken"

# Main thread: trong menu loop, kiem tra file pending-cmd.json moi vong lap.
# Neu co -> dispatch command -> xoa file.
$pendingCmdPath = Join-Path $env:LOCALAPPDATA "LapLap\pending-cmd.json"

# Tao wrapper loop: cho scan xong, sau do vua hien menu vua check command.
function Invoke-WatcherLoop {
    Write-Host ""
    Write-Host "  [REMOTE-WATCHER] Dang cho lenh tu server..." -ForegroundColor DarkGray
    Write-Host "  Nhan phim 'q' de thoat." -ForegroundColor DarkGray
    while ($true) {
        # Kiem tra pending command.
        if (Test-Path $pendingCmdPath) {
            try {
                $cmdJson = Get-Content -Path $pendingCmdPath -Raw -Encoding UTF8
                Remove-Item $pendingCmdPath -Force -ErrorAction SilentlyContinue
                $cmd = $cmdJson | ConvertFrom-Json
                Write-Host ""
                Write-Host "  [REMOTE] Server yeu cau: $($cmd.action) $($cmd.toolName)" -ForegroundColor Magenta
                if ($cmd.action -eq "launch-tool") {
                    $extract = [bool]$cmd.extract
                    $args = @()
                    if ($cmd.args) {
                        $args = @($cmd.args)
                    }
                    Invoke-ToolDownload -ToolId $cmd.toolId -ToolName $cmd.toolName -ExecName $cmd.exec -Extract $extract -LaunchArgs $args
                }
            } catch {
                Write-Warn "Lenh tu server loi: $($_.Exception.Message)"
            }
        }

        # Kiem tra phim q de thoat (non-blocking).
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            if ($key.KeyChar -eq 'q' -or $key.KeyChar -eq 'Q') {
                Write-Host ""
                Write-Host "  Dang dong watcher..." -ForegroundColor DarkGray
                Stop-Job -Job $pollerJob -ErrorAction SilentlyContinue
                Remove-Job -Job $pollerJob -Force -ErrorAction SilentlyContinue
                return
            }
        }

        Start-Sleep -Milliseconds 500
    }
}

Invoke-SystemScan
Invoke-WatcherLoop
`;

// BAT kich hoat scanner - khi user double-click se mo PowerShell, doi 1-2 giay
// cho Start-Process hien ra, sau do pause de cua so khong bien mat.
export const SCANNER_BAT = String.raw`@echo off
chcp 65001 >nul
cd /d "%~dp0"
title LapLap Toolcheck (mini)
echo.
echo ================================================
echo  LAPLAP TOOLCHECK (mini) - scanner nhanh, WMI.
echo  Phien ban nay KHONG can tai them goi Toolcheck.
echo ================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0laplap-toolcheck.ps1"
echo.
echo Nhan phim bat ky de dong...
pause >nul
`;
