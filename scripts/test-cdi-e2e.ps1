# Test E2E: mo phong nhu scanner PS1 thuc su chay
# Doc Win32_DiskDrive -> do toi CDI DLL -> ket hop ket qua
param([string]$dllPath = ".\public\cdi\CDI_x64.dll")

if (-not (Test-Path $dllPath)) {
    Write-Error "DLL not found: $dllPath"; exit 1
}
$dllAbs = (Resolve-Path $dllPath).Path
$dllEscaped = $dllAbs -replace '\\','\\\\'

Add-Type -TypeDefinition @"
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
    public const string DLL = "$dllEscaped";
    [DllImport(DLL, EntryPoint="CreateAtaSmart", CallingConvention=CallingConvention.Cdecl)]
    public static extern IntPtr CreateAtaSmart();
    [DllImport(DLL, CharSet=CharSet.Auto)] public static extern void DestroyAtaSmart(IntPtr ptr);
    [DllImport(DLL, CharSet=CharSet.Auto)] public static extern void InitAtaSmart(IntPtr ptr,
        bool useWmi, bool advancedDiskSearch, bool workaroundHD204UI, bool workaroundAdataSsd,
        bool flagHideNoSmartDisk, bool flagSortDriveLetter);
    [DllImport(DLL, CharSet=CharSet.Auto)] public static extern int GetDiskCount(IntPtr ptr);
    [DllImport(DLL, CharSet=CharSet.Auto)] public static extern bool GetDiskInfo(IntPtr ptr, int index, ref CdiSmartInfo info);
}
"@ -Language CSharp

# === Mo phong nhu PS1 scanner template ===
$ptr = [CDI]::CreateAtaSmart()
if ($ptr -eq [IntPtr]::Zero) { Write-Error "Create null"; exit 2 }
[CDI]::InitAtaSmart($ptr, $true, $false, $false, $false, $true, $true)
$cdiCount = [CDI]::GetDiskCount($ptr)

# Index CDI theo serial
$cdiBySerial = @{}
$cdiByModel = @{}
for ($i = 0; $i -lt $cdiCount; $i++) {
    $inf = New-Object CdiSmartInfo
    if ([CDI]::GetDiskInfo($ptr, $i, [ref]$inf)) {
        $sn = if ($inf.SerialNumber) { $inf.SerialNumber.Trim() } else { "" }
        $md = if ($inf.Model) { $inf.Model.Trim() } else { "" }
        if ($sn) { $cdiBySerial[$sn] = $inf }
        if ($md -and -not $cdiByModel.ContainsKey($md)) { $cdiByModel[$md] = $inf }
    }
}

Write-Host "=== CDI indexed $($cdiBySerial.Count) disk(s) ===" -ForegroundColor Cyan
Write-Host ""

# Loop qua WMI nhu scanner thuc te
$disks = Get-CimInstance -ClassName Win32_DiskDrive | Select-Object Index, Model, Size, InterfaceType, PNPDeviceID
$phys = Get-CimInstance -ClassName MSFT_PhysicalDisk -ErrorAction SilentlyContinue

$results = @()
foreach ($d in $disks) {
    $dtype = "N/A"
    $pd = $phys | Where-Object { $_.DeviceId -eq $d.Index -or $_.FriendlyName -eq $d.Model } | Select-Object -First 1
    $bus = if ($pd) { [string]$pd.BusType } else { "" }
    $media = if ($pd) { [string]$pd.MediaType } else { "" }
    $diskNum = if ($null -ne $d.Index) { [int]$d.Index } else { 0 }
    $iface = if ($null -ne $d.InterfaceType) { [string]$d.InterfaceType } else { "" }
    $pnp = if ($null -ne $d.PNPDeviceID) { [string]$d.PNPDeviceID } else { "" }
    $isNvmeByPnp = $pnp -match "VEN_NVME"
    $isNvme = ($iface -eq "NVMe") -or ($bus -eq "NVMe") -or $isNvmeByPnp -or ($d.Model -like "*NVMe*")
    $isUsb = ($bus -eq "USB") -or ($iface -eq "USB") -or ($d.Model -match "USB")
    $isSsd = ($media -eq "SSD") -or ($d.Model -like "*SSD*")
    $modelLooksHdd = ($d.Model -match "^ST\d") -or ($d.Model -match "WDC\b") -or ($d.Model -match "^WD[A-Z]") -or ($d.Model -match "TOSHIBA") -or ($d.Model -match "Hitachi")
    $isHdd = ($media -eq "HDD") -or ($iface -eq "IDE") -or (($iface -eq "SCSI") -and $modelLooksHdd)
    if ($isNvme -and $isUsb) { $dtype = "USB NVMe" }
    elseif ($isNvme) { $dtype = "NVMe SSD" }
    elseif ($isSsd) { $dtype = "SATA SSD" }
    elseif ($isHdd) { $dtype = "HDD" }
    if ($dtype -eq "N/A" -and $bus -ne "") { $dtype = $bus }
    if ($dtype -eq "N/A" -and $iface -ne "" -and $iface -ne "SCSI") { $dtype = $iface }

    $entry = @{
        name = $d.Model
        type = $dtype
        capacity = if ($d.Size -gt 0) { [math]::Round($d.Size / 1GB, 1) } else { "N/A" }
    }

    # === BUOC 0: CDI ===
    $cdiInfo = $null
    $wmiSerial = if ($d.SerialNumber) { [string]$d.SerialNumber } else { "" }
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
        if ($cdiInfo.MeasuredPowerOnHours -gt 0) { $entry.cdiPowerOnHours = [int]$cdiInfo.MeasuredPowerOnHours }
        elseif ($cdiInfo.DetectedPowerOnHours -gt 0) { $entry.cdiPowerOnHours = [int]$cdiInfo.DetectedPowerOnHours }
        if ($cdiInfo.PowerOnCount -gt 0) { $entry.cdiPowerOnCount = [int]$cdiInfo.PowerOnCount }
        if ($cdiInfo.Life -ge 0 -and $cdiInfo.Life -le 100) { $entry.cdiLife = [int]$cdiInfo.Life }
        if ($cdiInfo.WearLevelingCount -ge 0 -and $cdiInfo.WearLevelingCount -le 100) { $entry.cdiWearLevel = [int]$cdiInfo.WearLevelingCount }
        if ($cdiInfo.HostWrites -gt 0) { $entry.cdiHostWrites = [int]$cdiInfo.HostWrites }
        if ($cdiInfo.HostReads -gt 0) { $entry.cdiHostReads = [int]$cdiInfo.HostReads }
        if ($cdiInfo.AlarmTemperature -gt 0) { $entry.cdiAlarmTemp = [int]$cdiInfo.AlarmTemperature }
        if ($null -ne $cdiInfo.DiskStatus) { $entry.cdiDiskStatus = [int]$cdiInfo.DiskStatus }
    } else {
        $entry.cdiAvailable = $false
    }

    $results += $entry
}

[CDI]::DestroyAtaSmart($ptr)

# === In JSON (giong scanner thuc te gui ve server) ===
Write-Host "=== FINAL JSON (what server will receive) ===" -ForegroundColor Magenta
$json = $results | ConvertTo-Json -Depth 3
Write-Host $json
