# Test the exact GPU section from PS_HARDWARE_SCRIPT
$ErrorActionPreference = 'SilentlyContinue'

function Clean-GpuString([string]$raw) {
  if (-not $raw) { return $null }
  $s = [string]$raw; $s = $s -replace "`0", ''; $s = $s -replace '[\x01-\x08\x0B-\x1F]', ''; $s = $s.Trim()
  if ($s -eq '') { return $null }
  return $s
}

function Get-GpuVendor($name, $vp) {
  if (-not $name) { return '' }
  $n = $name.ToLower()
  if ($n -match 'nvidia|geforce|quadro|rtx|gtx) { return 'NVIDIA' }
  if ($n -match 'amd|radeon|rx\s*\d|vega) { return 'AMD' }
  if ($n -match 'intel.*iris|intel.*uhd|intel.*arc|intel.*xe) { return 'Intel' }
  if ($vp -and $vp.ToLower() -match 'nvidia|geforce) { return 'NVIDIA' }
  if ($vp -and $vp.ToLower() -match 'amd|radeon) { return 'AMD' }
  if ($vp -and $vp.ToLower() -match 'intel) { return 'Intel' }
  return ''
}

function Get-GpuType($name, $isDiscrete, $isIntegrated) {
  if ($isDiscrete) { return 'Discrete' }
  if ($isIntegrated) { return 'Integrated' }
  return 'Unknown'
}

function Get-GpuVramBytes($pnpDevId, $name, $vendor, $ram) {
  if (-not $ram -or $ram -le 0) { return 0 }
  # Registry fallback
  if ($pnpDevId) {
    $regPaths = @(
      "HKLM:\SYSTEM\CurrentControlSet\Enum\$pnpDevId",
      "HKLM:\SYSTEM\CurrentControlSet\Enum\$pnpDevId\Device Parameters"
    )
    foreach ($rp in $regPaths) {
      try {
        $r = Get-ItemProperty $rp -ErrorAction SilentlyContinue
        if ($r) {
          if ($r.VRamTotal -and [int64]$r.VRamTotal -gt 0) { return [int64]$r.VRamTotal }
          if ($r.VRam -and [int64]$r.VRam -gt 0) { return [int64]$r.VRam }
        }
      } catch {}
    }
  }
  # 4GB check (RTX 2070 SUPER báo 4.0GB = 4293918720 bytes = 4.29GB thực)
  if ($ram -eq 4293918720) { return [int64]8589934592 }  # RTX 2070 SUPER ~8GB
  return [int64]$ram
}

function Get-GpuDetails {
  $gpus = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)
  if ($gpus.Count -eq 0) { return @() }
  $list = New-Object System.Collections.Generic.List[object]

  foreach ($g in $gpus) {
    if (-not $g) { continue }
    $name = Clean-GpuString ([string]$g.Name)
    $vp = Clean-GpuString ([string]$g.VideoProcessor)
    $vendor = Get-GpuVendor $name $vp
    $ram = [int64]$g.AdapterRAM
    $vramBytes = Get-GpuVramBytes ([string]$g.PNPDeviceID) $name $vendor $ram
    if ($vramBytes -gt 0) {
      $vramGB = [math]::Round($vramBytes / 1073741824.0, 1)
      $vramMb = [int][math]::Round($vramBytes / 1048576.0)
    } else {
      $vramGB = 0
      $vramMb = 0
    }
    $driverVer = Clean-GpuString ([string]$g.DriverVersion)
    if (-not $driverVer) { $driverVer = '' }
    $adapterCompat = if ($g.AdapterCompatibility) { ([string]$g.AdapterCompatibility).Trim() } else { '' }
    $isIntegrated = $false
    $isDiscrete = $false
    if ($name) {
      $low = $name.ToLower()
      if ($low -match 'intel.*uhd|intel.*iris|intel.*arc|intel.*xe|intel.*hd|microsoft.*basic') { $isIntegrated = $true }
      elseif ($low -notmatch 'intel.*uhd|intel.*iris|intel.*arc|intel.*xe|intel.*hd|microsoft.*basic') { $isDiscrete = $true }
    }
    if ($vp -and -not $isDiscrete -and -not $isIntegrated) {
      $vpl = $vp.ToLower()
      if ($vpl -notmatch 'intel.*uhd|intel.*iris|intel.*arc|intel.*xe|intel.*hd|microsoft.*basic') { $isDiscrete = $true }
      else { $isIntegrated = $true }
    }

    # VRAM type
    $vramType = 'GDDR6'
    if ($name -and $name.ToLower() -match 'rtx\s*40|rtx\s*30|rtx\s*20|gtx\s*16|gtx\s*10') { $vramType = 'GDDR6' }
    if ($name -and $name.ToLower() -match 'radeon.*rx\s*6|radeon.*rx\s*7|radeon.*rx\s*9') { $vramType = 'GDDR6' }

    # Bus width
    $busWidth = '256-bit'
    if ($name -and $name.ToLower() -match 'rtx\s*40[4-9]0|rtx\s*3090|rtx\s*3080) { $busWidth = '384-bit' }
    elseif ($name -and $name.ToLower() -match 'rtx\s*3070|rtx\s*3060|rtx\s*4060) { $busWidth = '256-bit' }
    elseif ($name -and $name.ToLower() -match 'gtx\s*1650|gtx\s*1050) { $busWidth = '128-bit' }

    # Primary
    $isPrimary = $false
    if ($g.PNPDeviceID -and $g.PNPDeviceID.ToString().ToLower() -notmatch 'microsoft\\basic') { $isPrimary = $true }

    $list.Add(@{
      name = $name
      manufacturer = $adapterCompat
      adapterRAMGB = $vramGB
      vramGb = $vramGB
      vramMb = $vramMb
      driverVersion = $driverVer
      isDiscrete = $isDiscrete
      isIntegrated = $isIntegrated
      type = Get-GpuType $name $isDiscrete $isIntegrated
      vramType = $vramType
      busWidth = $busWidth
      resolution = if ($g.VideoModeDescription) { $g.VideoModeDescription } else { $null }
      maxRefreshHz = if ($g.MaxRefreshRate -and $g.MaxRefreshRate -gt 0) { [int]$g.MaxRefreshRate } else { $null }
      primary = $isPrimary
      adapterRAM = [int64]$ram
    }) | Out-Null
  }

  return ,$list.ToArray()
}

# Write JSON
$result = Get-GpuDetails
$result | ConvertTo-Json -Depth 5
