#requires -Version 5.1
<#
.SYNOPSIS
  Thu thap thong tin phan cung (CPU, battery, disks, OS, network) qua WMI/CIM.

.DESCRIPTION
  Output: 1 dong JSON cuoi stdout. Moi thu khac (progress, debug) viet ra stderr.
  Exit code 0 = success, 1 = fail (khi do JSON error object cung duoc in ra stdout).

.NOTES
  Tuong thich -ExecutionPolicy Bypass. Chay non-elevated (WMI doc duoc CPU/disk/OS).
#>
[CmdletBinding()]
param()

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'SilentlyContinue'

function Write-ErrLine([string]$msg) {
    try { [Console]::Error.WriteLine($msg) } catch { Write-Host $msg }
}

function ConvertTo-JsonLine($obj) {
    try {
        if ($null -eq $obj) { return 'null' }
        return ($obj | ConvertTo-Json -Depth 10 -Compress)
    } catch {
        Write-ErrLine "[json-error] $($_.Exception.Message)"
        return '{"ok":false,"error":"json-serialize-failed"}'
    }
}

function Fail-Out([string]$msg) {
    $payload = @{ ok = $false; error = $msg }
    Write-ErrLine "[get-specs] FAIL: $msg"
    [Console]::Out.WriteLine((ConvertTo-JsonLine $payload))
    exit 1
}

try {
    Write-ErrLine "[get-specs] starting CIM/WMI queries..."

    # ---------- CPU ----------
    $cpu = $null
    try {
        $cpuRaw = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($cpuRaw) {
            $cores    = [int]$cpuRaw.NumberOfCores
            $logical  = [int]$cpuRaw.NumberOfLogicalProcessors
            $baseGhz  = if ($cpuRaw.MaxClockSpeed) { [math]::Round([double]$cpuRaw.MaxClockSpeed / 1000.0, 2) } else { $null }
            # Win32_Processor khong co boost clock truc tiep; neu Win11 co Name co "GHz" parse nhe.
            $boostGhz = $null
            $cpu = @{
                name     = [string]$cpuRaw.Name
                cores    = if ($cores -gt 0) { $cores } else { $null }
                threads  = if ($logical -gt 0) { $logical } else { $null }
                baseGhz  = $baseGhz
                boostGhz = $boostGhz
            }
        }
    } catch { Write-ErrLine "[get-specs] cpu query: $($_.Exception.Message)" }

    # ---------- Battery ----------
    $battery = $null
    try {
        $bat = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($bat) {
            $design = [int]$bat.DesignCapacity
            $full   = [int]$bat.FullChargeCapacity
            $healthPct = $null
            if ($design -gt 0 -and $full -gt 0) {
                $healthPct = [math]::Round(($full * 100.0) / $design, 1)
            }
            # Win32_Battery khong co cycles/voltage -> null de tool fallback PowerShell khac.
            $battery = @{
                designMwh = if ($design -gt 0) { $design } else { $null }
                fullMwh   = if ($full -gt 0)   { $full   } else { $null }
                healthPct = $healthPct
                cycles    = $null
                voltageMv = $null
            }
        }
    } catch { Write-ErrLine "[get-specs] battery query: $($_.Exception.Message)" }

    # ---------- Disks ----------
    $disks = New-Object System.Collections.Generic.List[object]
    try {
        $driveList = Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue
        foreach ($d in $driveList) {
            if (-not $d) { continue }
            $sizeBytes = [int64]$d.Size
            $capGb = if ($sizeBytes -gt 0) { [int]([math]::Floor($sizeBytes / 1073741824)) } else { $null }
            # InterfaceType = "IDE" / "SATA" / "NVMe" / "SCSI" / "USB"; ket hop voi MediaType (khi co).
            $itype = [string]$d.InterfaceType
            $media = [string]$d.MediaType
            $model = [string]$d.Model
            # Uu tien: NVMe > SSD (model co "SSD"/"NVMe" hoac MediaType="Solid State") > HDD > USB > Unknown.
            if ($itype -match 'NVMe' -or $model -match 'NVMe') { $type = 'NVMe SSD' }
            elseif ($model -match 'SSD' -or $media -match 'Solid State') { $type = 'SSD' }
            elseif ($itype -match 'USB') { $type = 'USB' }
            elseif ($itype -match 'SCSI' -or $itype -match 'SATA' -or $itype -match 'IDE') {
                if ($media -match 'Fixed' -or $media -match 'Hard') { $type = 'HDD' }
                else { $type = 'Unknown' }
            }
            else { $type = 'Unknown' }
            $disks.Add(@{
                name        = $model
                type        = $type
                capacityGb  = $capGb
                healthPct   = $null   # SMART can smartctl hoac CDI - de tool fallback.
            }) | Out-Null
        }
    } catch { Write-ErrLine "[get-specs] disk query: $($_.Exception.Message)" }

    # ---------- OS ----------
    $os = $null
    try {
        $osRaw = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($osRaw) {
            $caption  = [string]$osRaw.Caption
            $version  = [string]$osRaw.Version
            $build    = [string]$osRaw.BuildNumber
            $arch     = [string]$osRaw.OSArchitecture
            $productType = [int]$osRaw.ProductType
            # ProductType=1 workstation, !=1 server/Domain controller.
            $workstation = ($productType -eq 1)
            # Kiem tra activated: query SoftwareLicensingService (Win10/11).
            $activated = $null
            try {
                $sla = Get-CimInstance SoftwareLicensingProduct -ErrorAction SilentlyContinue |
                       Where-Object { $_.PartialProductKey -and $_.ApplicationId -match '55c92734' -and $_.LicenseStatus -ne $null } |
                       Select-Object -First 1
                # LicenseStatus=1 = Licensed.
                if ($sla -and [int]$sla.LicenseStatus -eq 1) { $activated = $true } else { $activated = $false }
            } catch { $activated = $null }
            $os = @{
                name      = $caption
                version   = $version
                build     = $build
                arch      = $arch
                activated = $activated
            }
        }
    } catch { Write-ErrLine "[get-specs] os query: $($_.Exception.Message)" }

    # ---------- Network ----------
    $network = New-Object System.Collections.Generic.List[object]
    try {
        $adapters = Get-CimInstance Win32_NetworkAdapter -ErrorAction SilentlyContinue |
                    Where-Object { $_.PhysicalAdapter -eq $true -or $_.NetEnabled -eq $true }
        foreach ($a in $adapters) {
            if (-not $a -or -not $a.MACAddress) { continue }
            $ipv4 = New-Object System.Collections.Generic.List[string]
            try {
                $cfg = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "Index = $($a.Index)" -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($cfg -and $cfg.IPAddress) {
                    foreach ($ip in $cfg.IPAddress) {
                        if ($ip -match '^\d{1,3}(\.\d{1,3}){3}$') { $ipv4.Add([string]$ip) | Out-Null }
                    }
                }
            } catch { }
            $network.Add(@{
                iface = [string]$a.NetConnectionID
                mac   = ([string]$a.MACAddress).ToLower()
                ipv4  = @($ipv4.ToArray())
            }) | Out-Null
        }
    } catch { Write-ErrLine "[get-specs] network query: $($_.Exception.Message)" }

    $payload = @{
        ok      = $true
        cpu     = $cpu
        battery = $battery
        disks   = @($disks.ToArray())
        os      = $os
        network = @($network.ToArray())
    }

    Write-ErrLine "[get-specs] done. cpu=$($null -ne $cpu) battery=$($null -ne $battery) disks=$($disks.Count) os=$($null -ne $os) net=$($network.Count)"
    [Console]::Out.WriteLine((ConvertTo-JsonLine $payload))
    exit 0
}
catch {
    Fail-Out $_.Exception.Message
}
