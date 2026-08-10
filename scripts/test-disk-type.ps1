# Test logic disk-type detection (khong can admin)
$disks = Get-CimInstance -ClassName Win32_DiskDrive | Select-Object Index, Model, Size, InterfaceType, PNPDeviceID
$phys = Get-CimInstance -ClassName MSFT_PhysicalDisk -ErrorAction SilentlyContinue

foreach ($d in $disks) {
    $pd = $phys | Where-Object { $_.DeviceId -eq $d.Index -or $_.FriendlyName -eq $d.Model } | Select-Object -First 1
    $bus = if ($pd) { [string]$pd.BusType } else { "" }
    $media = if ($pd) { [string]$pd.MediaType } else { "" }
    $iface = if ($null -ne $d.InterfaceType) { [string]$d.InterfaceType } else { "" }
    $pnp = if ($null -ne $d.PNPDeviceID) { [string]$d.PNPDeviceID } else { "" }
    $isNvmeByPnp = $pnp -match "VEN_NVME"

    # === Logic moi (paste tu scanner-template) ===
    $isNvme = ($iface -eq "NVMe") -or ($bus -eq "NVMe") -or $isNvmeByPnp -or ($d.Model -like "*NVMe*")
    $isUsb = ($bus -eq "USB") -or ($iface -eq "USB") -or ($d.Model -match "USB")
    $isSsd = ($media -eq "SSD") -or ($d.Model -like "*SSD*")
    $modelLooksHdd = ($d.Model -match "^ST\d") -or ($d.Model -match "WDC\b") -or ($d.Model -match "^WD[A-Z]") -or ($d.Model -match "TOSHIBA") -or ($d.Model -match "Hitachi")
    $isHdd = ($media -eq "HDD") -or ($iface -eq "IDE") -or (($iface -eq "SCSI") -and $modelLooksHdd)
    $dtype = "N/A"
    if ($isNvme -and $isUsb) { $dtype = "USB NVMe" }
    elseif ($isNvme) { $dtype = "NVMe SSD" }
    elseif ($isSsd) { $dtype = "SATA SSD" }
    elseif ($isHdd) { $dtype = "HDD" }
    if ($dtype -eq "N/A" -and $bus -ne "") { $dtype = $bus }
    if ($dtype -eq "N/A" -and $iface -ne "" -and $iface -ne "SCSI") { $dtype = $iface }

    $capGB = if ($d.Size -gt 0) { [math]::Round($d.Size / 1GB, 1) } else { "?" }
    Write-Host ("[Index {0}] {1,-30} cap={2,6} GB iface={3,-5} bus={4,-5} media={5,-12} -> {6}" -f $d.Index, ($d.Model.Substring(0, [Math]::Min(30, $d.Model.Length))), $capGB, $iface, $bus, $media, $dtype)
}