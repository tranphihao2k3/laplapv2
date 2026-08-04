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

Invoke-SystemScan
Show-ToolMenu
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
