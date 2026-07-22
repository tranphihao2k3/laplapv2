param(
    [string]$ApiBase = "__API_BASE__",
    [string]$ScanToken = "__SCAN_TOKEN__"
)

$ErrorActionPreference = "SilentlyContinue"
$OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ToolRoot = Join-Path $ScriptRoot "Toolcheck"
$SubmitUrl = "$ApiBase/api/v1/system-scan/submit?token=$ScanToken"
$script:LastDeviceId = $env:COMPUTERNAME
$script:LastDeviceName = $env:COMPUTERNAME

function Write-Step { param($Message) Write-Host "  >> $Message" -ForegroundColor Cyan }
function Write-OK { param($Message) Write-Host "  [OK] $Message" -ForegroundColor Green }
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
    $map = @{
        20 = "DDR"
        21 = "DDR2"
        24 = "DDR3"
        26 = "DDR4"
        34 = "DDR5"
    }
    $type = "N/A"
    if ($Module -and $Module.SMBIOSMemoryType -and $map.ContainsKey([int]$Module.SMBIOSMemoryType)) {
        $type = $map[[int]$Module.SMBIOSMemoryType]
    } elseif ($Module -and $Module.Speed) {
        $speed = [int]$Module.Speed
        if ($speed -ge 4000) { $type = "DDR5" }
        elseif ($speed -ge 1600) { $type = "DDR4" }
        elseif ($speed -ge 800) { $type = "DDR3" }
    }
    return $type
}

function Normalize-Model {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
    return ($Text.ToLowerInvariant() -replace "[^a-z0-9]+", "")
}

function Invoke-CrystalDiskInfo {
    param([string]$ExePath, [string]$WorkDir, [int]$TimeoutSeconds = 30)
    try {
        # /CopyExit chay am tham: xuat DiskInfo.txt roi tu thoat, khong hien popup nhu HD Sentinel eval.
        $proc = Start-Process -FilePath $ExePath -ArgumentList "/CopyExit" -WorkingDirectory $WorkDir -PassThru -WindowStyle Hidden -ErrorAction SilentlyContinue
        if ($proc) {
            if (-not $proc.WaitForExit($TimeoutSeconds * 1000)) {
                try { $proc.Kill() } catch {}
            }
        }
    } catch {}
}

function Parse-CrystalDiskInfo {
    param([string]$Path)
    $items = @()
    if (-not (Test-Path $Path)) { return $items }

    $text = $null
    try { $text = Get-Content $Path -Raw -Encoding UTF8 } catch {}
    if (-not $text) { try { $text = Get-Content $Path -Raw } catch {} }
    if (-not $text) { return $items }

    # CrystalDiskInfo ghi mot khoi chi tiet cho moi o, cach nhau bang dong gach ngang.
    # Chi cac khoi co truong "Health Status" moi la khoi chi tiet that su
    # (phan "Disk List" tom tat o dau file thi khong co).
    $blocks = $text -split "(?m)^\s*-{5,}\s*$"
    foreach ($block in $blocks) {
        if ($block -notmatch "(?im)Health\s*Status\s*:") { continue }

        $model = "N/A"
        if ($block -match "(?im)^\s*Model\s*:\s*(.+?)\s*$") { $model = $matches[1].Trim() }

        $health = "N/A"
        $status = "N/A"
        if ($block -match "(?im)Health\s*Status\s*:\s*([A-Za-z][A-Za-z ]*?)\s*(?:\(\s*(\d+)\s*%\s*\))?\s*$") {
            $status = $matches[1].Trim()
            if ($matches[2]) { $health = $matches[2] + "%" }
        }

        $temperature = "N/A"
        if ($block -match "(?im)Temperature\s*:\s*(\d+)\s*C") { $temperature = $matches[1] + " C" }

        # Gio chay: CDI ghi "Power On Hours : 12345 hours" (co the kem so lan bat may).
        $power = "N/A"
        if ($block -match "(?im)Power On Hours\s*:\s*([0-9\.,]+)\s*hours") { $power = $matches[1] + " gio" }

        $items += @{
            name = $model
            health = $health
            performance = "N/A"
            powerOnTime = $power
            temperature = $temperature
            status = $status
            source = "CrystalDiskInfo"
        }
    }

    return $items
}

function Get-DiskHealth {
    # Nguon chinh: CrystalDiskInfo (mien phi) -> suc khoe % + gio chay.
    # Du phong: Windows Storage (Get-StorageReliabilityCounter) khi CDI khong chay duoc.
    $items = @()
    $cdiExe = $null
    $cdiCandidates = @(
        "CrystalDiskInfoPortable\App\CrystalDiskInfo\DiskInfo64.exe",
        "CrystalDiskInfoPortable\App\CrystalDiskInfo\DiskInfoA64.exe",
        "CrystalDiskInfoPortable\App\CrystalDiskInfo\DiskInfo32.exe",
        "CrystalDiskInfo\DiskInfo64.exe",
        "CrystalDiskInfo\DiskInfo32.exe",
        "CrystalDiskInfo\DiskInfo.exe"
    )
    foreach ($rel in $cdiCandidates) {
        $candidate = Join-Path $ToolRoot $rel
        if (Test-Path $candidate) { $cdiExe = $candidate; break }
    }
    if (-not $cdiExe) {
        Write-Warn "Khong tim thay HD Sentinel CLI / CrystalDiskInfo. Chuyen sang du lieu Windows..."
        return @(Get-WindowsDiskHealth)
    }

    Write-Step "Doc suc khoe o cung tu CrystalDiskInfo..."
    $workDir = Split-Path $cdiExe -Parent
    Invoke-CrystalDiskInfo -ExePath $cdiExe -WorkDir $workDir -TimeoutSeconds 30

    # DiskInfo.txt co the nam o thu muc exe, Smart\, hoac bi PortableApps chuyen ve Data\.
    $portableRoot = $null
    if ($cdiExe -match "(?i)\\CrystalDiskInfoPortable\\") {
        $portableRoot = $cdiExe.Substring(0, $cdiExe.ToLower().IndexOf("\crystaldiskinfoportable\") + "\crystaldiskinfoportable".Length)
    }
    $reportDirs = @($workDir, (Join-Path $workDir "Smart"))
    if ($portableRoot) {
        $reportDirs += @(
            (Join-Path $portableRoot "Data\Smart"),
            (Join-Path $portableRoot "Data"),
            (Join-Path $portableRoot "Data\CrystalDiskInfo")
        )
    }
    foreach ($dir in $reportDirs) {
        $items = @(Parse-CrystalDiskInfo -Path (Join-Path $dir "DiskInfo.txt"))
        if ($items.Count -gt 0) {
            Write-OK "Da doc duoc report CrystalDiskInfo ($($items.Count) o)."
            return $items
        }
    }

    Write-Warn "Chua doc duoc report tu CrystalDiskInfo. Chuyen sang du lieu Windows..."
    return @(Get-WindowsDiskHealth)
}

# Du phong: khi CrystalDiskInfo khong chay/khong xuat report, lay suc khoe tu WMI/Storage cua Windows.
# Tra ve cung dinh dang voi Parse-CrystalDiskInfo de phan con lai cua scanner dung lai duoc.
function Get-WindowsDiskHealth {
    $items = @()
    $phys = @()
    try { $phys = @(Get-PhysicalDisk -ErrorAction SilentlyContinue) } catch {}

    foreach ($pd in $phys) {
        $rc = $null
        try { $rc = Get-StorageReliabilityCounter -PhysicalDisk $pd -ErrorAction SilentlyContinue } catch {}

        $temperature = "N/A"
        if ($rc -and $rc.Temperature -gt 0) { $temperature = [string][int]$rc.Temperature + " C" }

        # Wear = % da hao mon (chu yeu cho SSD) -> suc khoe = 100 - Wear.
        $health = "N/A"
        if ($rc -and $rc.Wear -ne $null -and $rc.Wear -ge 0) {
            $health = [string](100 - [int]$rc.Wear) + "%"
        }

        $status = "N/A"
        if ($pd.HealthStatus) { $status = [string]$pd.HealthStatus }   # Healthy / Warning / Unhealthy

        # Gio chay tu reliability counter (neu driver ho tro).
        $power = "N/A"
        if ($rc -and $rc.PowerOnHours -gt 0) { $power = [string][int]$rc.PowerOnHours + " gio" }

        $items += @{
            name = (NZ ([string]$pd.FriendlyName) "N/A")
            health = $health
            performance = "N/A"
            powerOnTime = $power
            temperature = $temperature
            status = $status
            source = "Windows Storage"
        }
    }

    return $items
}

function Match-DiskHealth {
    param($Disk, $HdsItems, [int]$Index)
    if (-not $HdsItems -or $HdsItems.Count -eq 0) { return $null }
    $diskModel = Normalize-Model ([string]$Disk.Model)
    foreach ($item in $HdsItems) {
        $itemModel = Normalize-Model ([string]$item.name)
        if ($diskModel -and $itemModel -and ($diskModel.Contains($itemModel) -or $itemModel.Contains($diskModel))) {
            return $item
        }
    }
    if ($Index -lt $HdsItems.Count) { return $HdsItems[$Index] }
    return $null
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

function Invoke-SystemScan {
    Clear-Host
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  LAPLAP TOOLCHECK - SYSTEM SCANNER" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Token : $ScanToken" -ForegroundColor DarkGray
    Write-Host "Server: $ApiBase" -ForegroundColor DarkGray
    Write-Host ""

    Invoke-ScanStatus -Status "scanning"

    Write-Step "[1/8] Dang quet CPU..."
    $cpu = Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1
    $cpuTempC = "N/A"
    try {
        $tz = Get-CimInstance -Namespace "root/wmi" -ClassName MSAcpi_ThermalZoneTemperature
        if ($tz -and $tz.CurrentTemperature) {
            $cpuTempC = [string]([math]::Round(($tz.CurrentTemperature / 10) - 273.15, 1)) + " C"
        }
    } catch {}

    Write-Step "[2/8] Dang quet GPU..."
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

    Write-Step "[3/8] Dang quet RAM..."
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

    Write-Step "[4/8] Dang quet o cung..."
    $disks = @(Get-CimInstance -ClassName Win32_DiskDrive)
    $phys = @()
    try { $phys = @(Get-PhysicalDisk) } catch {}
    $logical = @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=3")
    $freeTotal = if ($logical) { ($logical | Measure-Object -Property FreeSpace -Sum).Sum / 1GB } else { 0 }
    $hdsItems = @(Get-DiskHealth)
    $smartPredict = @()
    try { $smartPredict = @(Get-CimInstance -Namespace "root/wmi" -ClassName MSStorageDriver_FailurePredictStatus) } catch {}

    Write-Step "[5/8] Dang quet pin..."
    $designedmWh = "N/A"
    $fullmWh = "N/A"
    $health = "N/A"
    $cycles = "N/A"
    $dCap = 0
    $fCap = 0
    try {
        $bStatic = Get-CimInstance -Namespace "root/wmi" -ClassName BatteryStaticData
        $bFull = Get-CimInstance -Namespace "root/wmi" -ClassName BatteryFullChargedCapacity
        $dCap = [int]($bStatic | Select-Object -First 1).DesignedCapacity
        $fCap = [int]($bFull | Select-Object -First 1).FullChargedCapacity
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
    if ($dCap -gt 0 -and $fCap -gt 0) { $health = [string]([math]::Round(($fCap / $dCap) * 100, 1)) + "%" }
    if ($cycles -eq "N/A") {
        try {
            $wb = Get-CimInstance -ClassName Win32_Battery | Select-Object -First 1
            if ($wb -and $wb.CycleCount) { $cycles = [int]$wb.CycleCount }
        } catch {}
    }

    Write-Step "[6/8] Dang lay thong tin man hinh va he thong..."
    $sysInfo = Get-CimInstance -ClassName Win32_ComputerSystem
    $bios = Get-CimInstance -ClassName Win32_BIOS
    $vc = $gpus | Where-Object { $_.CurrentHorizontalResolution -gt 0 } | Select-Object -First 1
    if (-not $vc) { $vc = $gpus | Select-Object -First 1 }
    $resolution = if ($vc -and $vc.CurrentHorizontalResolution) { [string]$vc.CurrentHorizontalResolution + " x " + [string]$vc.CurrentVerticalResolution } else { "N/A" }
    $refresh = if ($vc -and $vc.CurrentRefreshRate) { [string]$vc.CurrentRefreshRate + " Hz" } else { "N/A" }
    $screenSize = "N/A"
    try {
        $mon = Get-CimInstance -Namespace "root/wmi" -ClassName WmiMonitorBasicDisplayParams | Select-Object -First 1
        if ($mon -and $mon.MaxHorizontalImageSize -gt 0) {
            $diag = [math]::Sqrt([math]::Pow($mon.MaxHorizontalImageSize, 2) + [math]::Pow($mon.MaxVerticalImageSize, 2)) / 2.54
            $screenSize = [string][math]::Round($diag, 1) + " inch"
        }
    } catch {}

    Write-Step "[7/8] Dang lay WiFi da luu..."
    $wifiProfiles = @()
    try {
        $profileLines = netsh wlan show profiles | Select-String "All User Profile"
        if ($profileLines) {
            $wifiProfiles = $profileLines | ForEach-Object { $_.Line.Split(":")[1].Trim() }
        }
    } catch {}

    Write-Step "[8/8] Dang chuan bi du lieu..."
    $storageArr = @()
    for ($i = 0; $i -lt $disks.Count; $i++) {
        $d = $disks[$i]
        $pd = $phys | Where-Object { $_.DeviceId -eq $d.Index -or $_.FriendlyName -eq $d.Model } | Select-Object -First 1
        $hds = Match-DiskHealth -Disk $d -HdsItems $hdsItems -Index $i
        $predict = if ($i -lt $smartPredict.Count) { $smartPredict[$i] } else { $null }
        $status = "N/A"
        if ($hds -and $hds.status -and $hds.status -ne "N/A") { $status = $hds.status }
        elseif ($predict) { $status = if ($predict.PredictFailure) { "Warning" } else { "OK" } }

        $storageArr += @{
            name = (NZ $d.Model "N/A")
            capacity = if ($d.Size) { [math]::Round($d.Size / 1GB, 1) } else { "N/A" }
            type = Get-StorageKind -Disk $d -PhysicalDisk $pd
            free = "N/A"
            temp = if ($hds -and $hds.temperature -and $hds.temperature -ne "N/A") { $hds.temperature } else { "N/A" }
            health = if ($hds -and $hds.health -and $hds.health -ne "N/A") { $hds.health } else { "N/A" }
            performance = if ($hds -and $hds.performance -and $hds.performance -ne "N/A") { $hds.performance } else { "N/A" }
            powerOnTime = if ($hds -and $hds.powerOnTime -and $hds.powerOnTime -ne "N/A") { $hds.powerOnTime } else { "N/A" }
            status = $status
            source = if ($hds) { $hds.source } elseif ($predict) { "Windows SMART" } else { "Windows" }
        }
    }
    if ($storageArr.Count -gt 0) { $storageArr[0].free = [math]::Round($freeTotal, 1) }

    $wifiArr = @()
    foreach ($w in $wifiProfiles) { $wifiArr += @{ ssid = $w; security = "WPA2" } }
    $script:LastDeviceId = (NZ $bios.SerialNumber $env:COMPUTERNAME)
    $script:LastDeviceName = (NZ $sysInfo.Model (NZ $sysInfo.Name $env:COMPUTERNAME))

    $result = @{
        cpu = @{
            name = (NZ $cpu.Name "Unknown")
            cores = (NZ $cpu.NumberOfCores 0)
            threads = (NZ $cpu.NumberOfLogicalProcessors 0)
            baseClock = if ($cpu.MaxClockSpeed) { [string]$cpu.MaxClockSpeed + " MHz" } else { "N/A" }
            boostClock = "N/A"
            tdp = "N/A"
            temp = $cpuTempC
        }
        gpu = $gpuArr
        ram = @{
            total = [string][math]::Round($totalRAM, 1) + " GB"
            type = $ramType
            speed = if ($ramSpeed -ne "N/A") { [string]$ramSpeed + " MHz" } else { "N/A" }
            slots = $slots
            used = $ram.Count
            free = ($slots - $ram.Count)
            maxUpgrade = $maxUp
            modules = $ramModules
        }
        storage = $storageArr
        battery = @{
            designed = if ($designedmWh -ne "N/A") { [string]$designedmWh + " mWh" } else { "N/A" }
            current = if ($fullmWh -ne "N/A") { [string]$fullmWh + " mWh" } else { "N/A" }
            health = $health
            cycles = $cycles
        }
        screen = @{
            resolution = $resolution
            refreshRate = $refresh
            panel = "N/A"
            size = $screenSize
        }
        system = @{
            name = (NZ $sysInfo.Name "Unknown")
            serial = (NZ $bios.SerialNumber "N/A")
            windowsKey = "N/A"
            wifiSaved = $wifiArr
            wifiNearby = @()
        }
    }

    $json = $result | ConvertTo-Json -Depth 12 -Compress
    Write-Step "Dang gui du lieu len server..."
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
        Invoke-RestMethod -Uri $SubmitUrl -Method Post -Body $bytes -ContentType "application/json; charset=utf-8" -TimeoutSec 30 | Out-Null
        Write-Host ""
        Write-Host "================================================" -ForegroundColor Green
        Write-Host "  QUET THANH CONG! DA GUI LEN SERVER!" -ForegroundColor Green
        Write-Host "================================================" -ForegroundColor Green
        Write-Host ""
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
    Write-Warn "Khong tim thay $Label trong Toolcheck."
}

function Start-FurMarkBenchmark {
    $benchScript = Join-Path $ScriptRoot "scripts\furmark-benchmark.ps1"
    $furmarkExe = Join-Path $ToolRoot "FurMark_win64\furmark.exe"
    if (-not (Test-Path $benchScript)) {
        Write-Warn "Khong tim thay scripts\furmark-benchmark.ps1 trong goi zip."
        return
    }
    if (-not (Test-Path $furmarkExe)) {
        Write-Warn "Khong tim thay FurMark_win64\furmark.exe trong Toolcheck."
        return
    }

    Write-Host ""
    Write-Host "FurMark benchmark se hoi thoi gian va do phan giai test." -ForegroundColor Cyan
    Write-Host "Sau khi chay xong, ket qua se upload len web va tu mo trang luu DB." -ForegroundColor Cyan
    Write-Host ""
    # Bao ngoac tung tham so: ten may / duong dan co dau cach (vd "code ne", "ASUS TUF F15")
    # neu de mang tho, Start-Process se tach chuoi -> gan nham vao -DurationMin [int] va crash.
    $q = { param($v) '"' + ([string]$v).Replace('"', '') + '"' }
    $argLine = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", (& $q $benchScript),
        "-FurMarkPath", (& $q $furmarkExe),
        "-ApiBase", (& $q $ApiBase),
        "-DeviceId", (& $q $script:LastDeviceId),
        "-DeviceName", (& $q $script:LastDeviceName)
    ) -join " "
    Start-Process -FilePath "powershell.exe" -ArgumentList $argLine -Wait
}

function Show-ToolMenu {
    while ($true) {
        Write-Host ""
        Write-Host "================ TOOLCHECK MENU ================" -ForegroundColor Cyan
        Write-Host "  1) Mo CrystalDiskInfo"
        Write-Host "  2) Mo FurMark GUI"
        Write-Host "  3) Chay FurMark benchmark + upload ranking"
        Write-Host "  4) Mo GPU-Z"
        Write-Host "  5) Mo BatteryMon"
        Write-Host "  6) Mo thu muc Toolcheck"
        Write-Host "  7) Quet lai he thong"
        Write-Host "  0) Thoat"
        Write-Host "================================================"
        $choice = Read-Host "Chon tinh nang"

        switch ($choice.Trim()) {
            "1" { Open-Tool "CrystalDiskInfo" @("CrystalDiskInfoPortable\App\CrystalDiskInfo\DiskInfo64.exe", "CrystalDiskInfoPortable\App\CrystalDiskInfo\DiskInfoA64.exe", "CrystalDiskInfoPortable\App\CrystalDiskInfo\DiskInfo32.exe", "CrystalDiskInfo\DiskInfo64.exe", "CrystalDiskInfo\DiskInfo32.exe", "CrystalDiskInfo\DiskInfo.exe") }
            "2" { Open-Tool "FurMark GUI" @("FurMark_win64\FurMark_GUI.exe", "FurMark_win64\_fm2-gui.exe") }
            "3" { Start-FurMarkBenchmark }
            "4" { Open-Tool "GPU-Z" @("FurMark_win64\gpuz\gpuz.exe") }
            "5" { Open-Tool "BatteryMon" @("pin\BatteryMonx64.exe", "pin\BatteryMon.exe") }
            "6" {
                if (Test-Path $ToolRoot) { Start-Process explorer.exe $ToolRoot }
                else { Write-Warn "Khong tim thay thu muc Toolcheck." }
            }
            "7" { Invoke-SystemScan }
            "0" { return }
            default { Write-Warn "Lua chon khong hop le." }
        }
    }
}

if (-not (Test-Path $ToolRoot)) {
    Write-Fail "Khong tim thay thu muc Toolcheck. Hay giai nen day du file zip truoc khi chay."
    Read-Host "Nhan Enter de dong"
    exit 1
}

Invoke-SystemScan
Show-ToolMenu
