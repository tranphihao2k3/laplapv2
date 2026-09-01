// hardware.ts — Quét phần cứng chi tiết bằng PowerShell (WMI + Registry + DirectX)
// Kết hợp nhiều nguồn: CIM, SMBIOS, Registry, DirectX/CIM cho GPU VRAM,
// benchmark WMI provider, WQL queries để lấy thêm cache/turbo/memory timing.
// Stream từng phần về renderer qua IPC.

import { spawn } from "node:child_process";

export type CpuInfo = {
  name: string | null;
  manufacturer: string | null;
  cores: number | null;
  threads: number | null;
  baseGhz: number | null;
  turboGhz: number | null;
  cacheL1Kb: number | null;
  cacheL2Kb: number | null;
  cacheL3Kb: number | null;
  socket: string | null;
  architecture: string | null;
  processNm: number | null;
  tdpW: number | null;
};

export type MemoryInfo = {
  totalBytes: number | null;
  usedBytes: number | null;
  freeBytes: number | null;
  slots: number | null;
  platformMaxMhz: number | null;
  platformCpuName: string | null;
  modules: Array<{
    slot: string | null;
    sizeBytes: number | null;
    speedMhz: number | null;
    configuredMhz: number | null;
    smbiosSpeedMhz: number | null;
    platformMaxMhz: number | null;
    type: string | null;
    generation: string | null;
    manufacturer: string | null;
    partNumber: string | null;
    serialNumber: string | null;
    voltageMv: number | null;
    clTiming: string | null;
  }>;
};

export type DiskInfo = {
  name: string | null;
  model: string | null;
  type: string | null;
  capacityGb: number | null;
  freeGb: number | null;
  mediaType: string | null;
  interfaceType: string | null;
  firmwareRevision: string | null;
  serialNumber: string | null;
  tempC: number | null;
  healthStatus: string | null;
};

export type GpuInfo = {
  name: string | null;
  driverVersion: string | null;
  vramMb: number | null;
  vramSharedMb: number | null;
  vramType: string | null;
  busWidth: number | null;
  computeUnits: number | null;
  tdpW: number | null;
};

export type MainboardInfo = {
  manufacturer: string | null;
  product: string | null;
  serial: string | null;
  version: string | null;
  biosVersion: string | null;
};

export type BiosInfo = {
  manufacturer: string | null;
  version: string | null;
  releaseDate: string | null;
  smbiosVersion: string | null;
};

export type BatteryInfo = {
  name: string | null;
  status: string | null;
  chemistry: string | null;
  designCapacityMwh: number | null;
  fullChargeCapacityMwh: number | null;
  healthPct: number | null;
  cycleCount: number | null;
  voltageMv: number | null;
  currentRateMw: number | null;
  dischargeRateMw: number | null;
};

export type OsInfo = {
  caption: string | null;
  version: string | null;
  build: string | null;
  arch: string | null;
  hostname: string | null;
  serial: string | null;
  activated: boolean | null;
  installDate: string | null;
  lastBootTime: string | null;
};

export type NetworkInfo = {
  name: string | null;
  mac: string | null;
  ipv4: string[];
  ipv6: string[];
  speedMbps: number | null;
  driverVersion: string | null;
  type: string | null;
};

export type HardwarePart =
  | { key: "cpu"; ok: true; data: CpuInfo | null; ts: number }
  | { key: "memory"; ok: true; data: MemoryInfo | null; ts: number }
  | { key: "disks"; ok: true; data: DiskInfo[]; ts: number }
  | { key: "gpu"; ok: true; data: GpuInfo[]; ts: number }
  | { key: "mainboard"; ok: true; data: MainboardInfo | null; ts: number }
  | { key: "bios"; ok: true; data: BiosInfo | null; ts: number }
  | { key: "battery"; ok: true; data: BatteryInfo | null; ts: number }
  | { key: "os"; ok: true; data: OsInfo | null; ts: number }
  | { key: "network"; ok: true; data: NetworkInfo[]; ts: number }
  | { key: "__done__"; ok: true; ts: number }
  | { key: string; ok: false; error: string; ts: number };

export type HardwarePartListener = (part: HardwarePart) => void;

const TOTAL_TIMEOUT_MS = 150_000;

// ─── PowerShell hardware-detection script ───────────────────────────────────────
// Dùng WMI/CIM + Registry + DirectX để lấy thông tin chuẩn xác nhất.
const PS_HARDWARE_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'

function Out-Part([string]$key, $value) {
  $payload = @{ key = $key; ok = $true; data = $value }
  [Console]::Out.WriteLine(($payload | ConvertTo-Json -Depth 10 -Compress))
  [Console]::Out.Flush()
}

function Out-Error([string]$key, [string]$msg) {
  $payload = @{ key = $key; ok = $false; error = $msg }
  [Console]::Out.WriteLine(($payload | ConvertTo-Json -Depth 4 -Compress))
  [Console]::Out.Flush()
}

# ══════════════════════════════════════════════════════════════
# CPU — WMI + Registry (HKEY_LOCAL_MACHINE\HARDWARE\DESCRIPTION\System\CentralProcessor)
# ══════════════════════════════════════════════════════════════
function Convert-SocketDesignation {
  param([string]$raw)
  if (-not $raw -or $raw.Trim() -eq '') { return $null }
  $r = $raw.Trim()
  $map = @{
    'FCLGA1700' = 'LGA1700 (Intel 12/13/14-gen)';
    'LGA1700'   = 'LGA1700 (Intel 12/13/14-gen)';
    'LGA1200'   = 'LGA1200 (Intel 10/11-gen)';
    'LGA1151'   = 'LGA1151 (Intel 6/7/8/9-gen)';
    'LGA1150'   = 'LGA1150 (Intel 4/5-gen)';
    'LGA1155'   = 'LGA1155 (Intel 2/3-gen)';
    'LGA1156'   = 'LGA1156 (Intel 1-gen)';
    'LGA2066'   = 'LGA2066 (Intel X-series)';
    'LGA2011'   = 'LGA2011 (Intel X-series)';
    'LGA4189'   = 'LGA4189 (Intel Xeon Scalable)';
    'LGA4189-4' = 'LGA4189-4 (Intel Xeon)';
    'SP3'       = 'SP3 (AMD EPYC)';
    'SP6'       = 'SP6 (AMD EPYC)';
    'AM5'       = 'AM5 (AMD Ryzen 7000+)';
    'AM4'       = 'AM4 (AMD Ryzen/AM4 APU)';
    'AM3'       = 'AM3 (AMD Phenom II/Athlon II)';
    'AM3PLUS'   = 'AM3+ (AMD FX)';
    'FM2'       = 'FM2 (AMD Trinity APUs)';
    'FM2PLUS'   = 'FM2+ (AMD Kaveri APUs)';
    'STRX4'     = 'sTRX4 (AMD Threadripper 3000)';
    'TR4'       = 'TR4 (AMD Threadripper 1000/2000)';
  }
  $key = $r.ToUpper().Replace(' ', '').Replace('+','PLUS')
  if ($map.ContainsKey($key)) { return $map[$key] }
  return $r
}

function Get-CpuDetails {
  $result = @{}

  # 1. Win32_Processor (WMI)
  $c = Get-CimInstance Win32_Processor | Select-Object -First 1
  if ($c) {
    $result['name'] = if ($c.Name) { $c.Name.Trim() } else { $null }
    $result['manufacturer'] = [string]$c.Manufacturer
    $result['cores'] = if ($c.NumberOfCores -gt 0) { [int]$c.NumberOfCores } else { $null }
    $result['threads'] = if ($c.NumberOfLogicalProcessors -gt 0) { [int]$c.NumberOfLogicalProcessors } else { $null }
    $result['baseGhz'] = if ($c.MaxClockSpeed) { [math]::Round([double]$c.MaxClockSpeed / 1000.0, 2) } else { $null }
    $result['processNm'] = if ($c.LoadPercentage -ge 0) { [int]$c.LoadPercentage } else { $null }
    # Architecture: 0=x86, 5=ARM, 6=IA64, 9=AMD64, 12=ARM64
    $archMap = @{ 0 = 'x86'; 5 = 'ARM'; 6 = 'IA64'; 9 = 'AMD64'; 12 = 'ARM64' }
    $result['architecture'] = $archMap[[int]$c.Architecture]
  }

  # 2. Registry: exact CPU name từ SMBIOS (thường chính xác hơn WMI)
  try {
    $regPath = 'HKLM:\HARDWARE\DESCRIPTION\System\CentralProcessor\0'
    $regName = (Get-ItemProperty $regPath -ErrorAction SilentlyContinue).ProcessorNameString
    if ($regName) {
      $result['name'] = $regName.Trim()
    }
    # CPU Identifier (vendor + stepping)
    $cpuId = (Get-ItemProperty $regPath -ErrorAction SilentlyContinue).Identifier
    if ($cpuId) { $result['identifier'] = $cpuId }
    # Vendor
    $vendor = (Get-ItemProperty $regPath -ErrorAction SilentlyContinue).VendorIdentifier
    if ($vendor) { $result['vendorId'] = $vendor }
  } catch {}

  # 3. Registry: max clock speed (turbo) từ subkey
  try {
    $subKey = Get-Item 'HKLM:\SYSTEM\CurrentControlSet\Control\Power\User\PowerSchemes' -ErrorAction SilentlyContinue
    # Hoặc lấy từ WMI benchmark (chính xác hơn cho turbo)
    $perf = Get-CimInstance Win32_Processor | Select-Object -First 1
    if ($perf -and $perf.CurrentClockSpeed -and $perf.MaxClockSpeed) {
      $result['currentGhz'] = [math]::Round([double]$perf.CurrentClockSpeed / 1000.0, 2)
    }
  } catch {}

  # 4. SMBIOS Type 4 để lấy thêm thông tin CPU (cache, external clock)
  try {
    $smbiosCpu = Get-CimInstance -Namespace 'root\wmi' -ClassName MSSmBios_RawSMBiosTables -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($smbiosCpu -and $smbiosCpu.SMBiosData) {
      $b = [byte[]]$smbiosCpu.SMBiosData
      $i = 0
      while ($i -lt $b.Length - 4) {
        $t = $b[$i]
        $len = $b[$i+1]
        if ($t -eq 4 -and $len -ge 32) {
          # External clock (offset 18-19)
          if ($i+19 -lt $b.Length) {
            $result['externalClockMhz'] = [int]([uint16]($b[$i+18] + ($b[$i+19]*256)))
          }
          # Max speed (offset 30-31)
          if ($i+31 -lt $b.Length) {
            $result['turboGhz'] = if ($b[$i+30] -gt 0 -or $b[$i+31] -gt 0) {
              [math]::Round([double]([uint16]($b[$i+30] + ($b[$i+31]*256))) / 1000.0, 2)
            } else { $null }
          }
          # Core count từ SMBIOS (override if more accurate)
          if ($i+24 -lt $b.Length) {
            $smCores = [int]$b[$i+24]
            if ($smCores -gt 0) { $result['cores'] = $smCores }
          }
          # Thread count (offset 25)
          if ($i+25 -lt $b.Length) {
            $smThreads = [int]$b[$i+25]
            if ($smThreads -gt 0) { $result['threads'] = $smThreads }
          }
          # Socket designation từ SMBIOS Type 4 offset 4 (string index 1-based)
          if ($i+4 -lt $b.Length) {
            $socketIdx = [int]$b[$i+4]
            if ($socketIdx -gt 0) {
              # Tìm string #socketIdx trong bảng string ngay sau structure body.
              $strStart = $i + $len
              $strNum = 1
              $found = $false
              while ($strStart -lt ($b.Length - 1) -and -not $found) {
                if ($b[$strStart] -eq 0) { $strStart++ }
                $strLen = [int]$b[$strStart]
                if ($strNum -eq $socketIdx) {
                  if ($strLen -gt 0 -and ($strStart + 1 + $strLen) -le $b.Length) {
                    $raw = [System.Text.Encoding]::ASCII.GetString($b[($strStart+1)..($strStart+$strLen)])
                    $socket = Convert-SocketDesignation $raw
                    $result['socket'] = $socket
                  }
                  $found = $true
                } else {
                  $strStart += 1 + $strLen
                  $strNum++
                }
              }
            }
          }
          break
        }
        $i += $len
        if ($b[$i] -eq 0 -and ($i+1) -lt $b.Length -and $b[$i+1] -eq 0) { break }
        $i++
      }
    }
  } catch {}

  # 5. Lấy cache size từ Win32_CacheMemory (L1/L2/L3)
  try {
    $cacheEntries = Get-CimInstance Win32_CacheMemory -ErrorAction SilentlyContinue
    $l1 = $cacheEntries | Where-Object { $_.Purpose -match 'L1|Primary' -and $_.Level -match '1' } | Select-Object -First 1
    $l2 = $cacheEntries | Where-Object { $_.Purpose -match 'L2|Secondary' } | Select-Object -First 1
    $l3 = $cacheEntries | Where-Object { $_.Purpose -match 'L3|Tertiary' } | Select-Object -First 1
    if ($l1 -and $l1.MaxCacheSize) { $result['cacheL1Kb'] = [int]$l1.MaxCacheSize }
    if ($l2 -and $l2.MaxCacheSize) { $result['cacheL2Kb'] = [int]$l2.MaxCacheSize }
    if ($l3 -and $l3.MaxCacheSize) { $result['cacheL3Kb'] = [int]$l3.MaxCacheSize }
    # Fallback: WQL query cho cache chính xác hơn
    if (-not $result['cacheL1Kb']) {
      try {
        $wqlCache = Get-CimInstance -Query "SELECT * FROM Win32_CacheMemory WHERE Level = 1" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($wqlCache -and $wqlCache.MaxCacheSize) { $result['cacheL1Kb'] = [int]$wqlCache.MaxCacheSize }
      } catch {}
    }
    if (-not $result['cacheL2Kb']) {
      try {
        $wqlL2 = Get-CimInstance -Query "SELECT * FROM Win32_CacheMemory WHERE Level = 2" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($wqlL2 -and $wqlL2.MaxCacheSize) { $result['cacheL2Kb'] = [int]$wqlL2.MaxCacheSize }
      } catch {}
    }
    if (-not $result['cacheL3Kb']) {
      try {
        $wqlL3 = Get-CimInstance -Query "SELECT * FROM Win32_CacheMemory WHERE Level = 3" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($wqlL3 -and $wqlL3.MaxCacheSize) { $result['cacheL3Kb'] = [int]$wqlL3.MaxCacheSize }
      } catch {}
    }
  } catch {}

  # 6. Lấy TDP từ registry (Intel/AMD)
  try {
    $cpuName = $result['name']
    if ($cpuName -match 'Intel') {
      $perfPath = 'HKLM:\SYSTEM\CurrentControlSet\Services\intelPPM'
      $procPath = 'HKLM:\SYSTEM\CurrentControlSet\Services\Processor'
      # TDP không có sẵn trong registry, dùng model để estimate
      if ($cpuName -match 'i9[-\s]1[3-4]') { $result['tdpW'] = 125 }
      elseif ($cpuName -match 'i9[-\s]1[2]') { $result['tdpW'] = 125 }
      elseif ($cpuName -match 'i7[-\s]1[3-4]') { $result['tdpW'] = 125 }
      elseif ($cpuName -match 'i7[-\s]1[2]') { $result['tdpW'] = 125 }
      elseif ($cpuName -match 'i5[-\s]1[3-4]') { $result['tdpW'] = 65 }
      elseif ($cpuName -match 'i5[-\s]1[2]') { $result['tdpW'] = 65 }
      elseif ($cpuName -match 'i3[-\s]1[3-4]') { $result['tdpW'] = 35 }
      elseif ($cpuName -match 'i3[-\s]1[2]') { $result['tdpW'] = 35 }
      elseif ($cpuName -match 'i7[-\s]1[1]') { $result['tdpW'] = 125 }
      elseif ($cpuName -match 'i5[-\s]1[1]') { $result['tdpW'] = 95 }
      elseif ($cpuName -match 'i7[-\s]10') { $result['tdpW'] = 125 }
      elseif ($cpuName -match 'i5[-\s]10') { $result['tdpW'] = 65 }
      elseif ($cpuName -match 'i7[-\s][89]') { $result['tdpW'] = 45 }
      elseif ($cpuName -match 'i5[-\s][89]') { $result['tdpW'] = 45 }
      elseif ($cpuName -match 'i7[-\s][67]') { $result['tdpW'] = 45 }
      elseif ($cpuName -match 'i5[-\s][67]') { $result['tdpW'] = 45 }
      elseif ($cpuName -match 'i3[-\s][89]|i3[-\s]10[0-9]') { $result['tdpW'] = 35 }
      elseif ($cpuName -match 'Pentium|Celeron') { $result['tdpW'] = 15 }
    } elseif ($cpuName -match 'AMD') {
      if ($cpuName -match 'Ryzen\s*9\s*7[0-9]0') { $result['tdpW'] = 170 }
      elseif ($cpuName -match 'Ryzen\s*9\s*5[0-9]0') { $result['tdpW'] = 105 }
      elseif ($cpuName -match 'Ryzen\s*7\s*7[0-9]0') { $result['tdpW'] = 105 }
      elseif ($cpuName -match 'Ryzen\s*7\s*5[0-9]0') { $result['tdpW'] = 65 }
      elseif ($cpuName -match 'Ryzen\s*5\s*7[0-9]0') { $result['tdpW'] = 65 }
      elseif ($cpuName -match 'Ryzen\s*5\s*5[0-9]0') { $result['tdpW'] = 65 }
      elseif ($cpuName -match 'Ryzen\s*5\s*4[0-9]0') { $result['tdpW'] = 65 }
      elseif ($cpuName -match 'Ryzen\s*3\s*5[0-9]0') { $result['tdpW'] = 65 }
      elseif ($cpuName -match 'Ryzen\s*3\s*4[0-9]0') { $result['tdpW'] = 35 }
      elseif ($cpuName -match 'Ryzen\s*9') { $result['tdpW'] = 105 }
      elseif ($cpuName -match 'Ryzen\s*7') { $result['tdpW'] = 65 }
      elseif ($cpuName -match 'Ryzen\s*5') { $result['tdpW'] = 65 }
      elseif ($cpuName -match 'Ryzen\s*3') { $result['tdpW'] = 35 }
      elseif ($cpuName -match 'Athlon') { $result['tdpW'] = 35 }
    }
  } catch {}

  return $result
}

# ══════════════════════════════════════════════════════════════
# Memory — WMI + SMBIOS Type 17 + Registry
# ══════════════════════════════════════════════════════════════
function Normalize-RamManufacturer {
  param([string]$raw)
  if (-not $raw -or $raw.Trim() -eq '') { return $null }
  $r = $raw.Trim().ToLower()
  
  # Hex codes và vendor ID mapping
  if ($r -match '^0x') {
    $hex = $r -replace '^0x',''
    switch ($hex) {
      '802c' { return 'Micron' }
      '80ad' { return 'SK hynix' }
      '80ce' { return 'Samsung' }
      '859b' { return 'Crucial' }
      '04cd' { return 'Transcend' }
      '014f' { return 'Transcend' }
      '029e' { return 'Corsair' }
      '04cb' { return 'A-DATA' }
      '0215' { return 'Corsair' }
      '0198' { return 'HyperX' }
      '0420' { return 'Nanya' }
      '1315' { return 'PNY' }
      '867f' { return 'Kingston' }
      default { return $raw }
    }
  }
  
  # Text matching
  if ($r -match 'micron|crucial') { return 'Micron/Crucial' }
  if ($r -match 'sk.*hynix|hynix') { return 'SK hynix' }
  if ($r -match 'samsung') { return 'Samsung' }
  if ($r -match 'kingston') { return 'Kingston' }
  if ($r -match 'corsair') { return 'Corsair' }
  if ($r -match 'g\.?skill|gskill') { return 'G.Skill' }
  if ($r -match 'hyperx') { return 'HyperX (Kingston)' }
  if ($r -match 'adata|a-data') { return 'ADATA' }
  if ($r -match 'team.*group|teamgroup') { return 'Team Group' }
  if ($r -match 'patriot') { return 'Patriot' }
  if ($r -match 'mushkin') { return 'Mushkin' }
  if ($r -match 'pny') { return 'PNY' }
  if ($r -match 'transcend') { return 'Transcend' }
  if ($r -match 'kingmax') { return 'Kingmax' }
  if ($r -match 'apacer') { return 'Apacer' }
  if ($r -match 'geil') { return 'GeIL' }
  if ($r -match 'nanya') { return 'Nanya' }
  if ($r -match 'elpida') { return 'Elpida' }
  if ($r -match 'ramaxel') { return 'Ramaxel' }
  
  return $raw
}

function Get-SmbiosType17Max {
  $result = New-Object System.Collections.Generic.List[object]
  try {
    $smbios = Get-CimInstance -Namespace 'root\wmi' -ClassName MSSmBios_RawSMBiosTables -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $smbios -or -not $smbios.SMBiosData) { return ,$result.ToArray() }
    $b = [byte[]]$smbios.SMBiosData
    $i = 0
    $end = $b.Length
    while ($i -lt $end - 4) {
      $t = $b[$i]
      $len = $b[$i+1]
      if ($len -lt 4 -or $len -gt 256 -or $t -eq 127) { break }
      if ($t -eq 17) {
        $rec = @{}
        # Speed (offset 21-22)
        if ($i+22 -lt $end) { $rec['speed'] = [int]([uint16]($b[$i+21] + ($b[$i+22]*256))) }
        # Configured speed (offset 33-34, SMBIOS 2.8+)
        if ($len -ge 35 -and ($i+34) -lt $end) { $rec['configuredClock'] = [int]([uint16]($b[$i+33] + ($b[$i+34]*256))) }
        # Size (offset 12-13)
        if ($i+13 -lt $end) {
          $sizeRaw = [int]([uint16]($b[$i+12] + ($b[$i+13]*256)))
          if (($sizeRaw -band 0x8000) -ne 0) { $rec['sizeMb'] = ($sizeRaw -band 0x7FFF) * 1024 }
          else { $rec['sizeMb'] = $sizeRaw }
        }
        # Device locator string
        $rec['deviceLocator'] = ''
        if ($len -gt 17) {
          $strIdx = [int]$b[$i+16]
          $si = $i + $len
          while ($si -lt $end - 1) {
            if ($b[$si] -eq 0 -and $b[$si+1] -eq 0) { break }
            $n = $b[$si+1]
            if ($strIdx -eq 0) {
              $s = ''
              for ($k = 0; $k -lt $n; $k++) { if ($si+2+$k -lt $end) { $s += [char]$b[$si+2+$k] } }
              $rec['deviceLocator'] = $s
              break
            }
            $si += $n + 1; $strIdx--
          }
        }
        # Manufacturer string
        $rec['manufacturer'] = ''
        if ($len -gt 18) {
          $strIdx2 = [int]$b[$i+17]
          if ($strIdx2 -gt 0) {
            $si = $i + $len
            $s2 = ''; $cnt = 0
            while ($si -lt $end - 1) {
              if ($b[$si] -eq 0 -and $b[$si+1] -eq 0) { break }
              $n = $b[$si+1]
              $cnt++
              if ($cnt -eq $strIdx2) {
                for ($k = 0; $k -lt $n; $k++) { if ($si+2+$k -lt $end) { $s2 += [char]$b[$si+2+$k] } }
                break
              }
              $si += $n + 1
            }
            $rec['manufacturer'] = $s2
          }
        }
        # Part number string (offset 22, 1-indexed)
        $rec['partNumber'] = ''
        if ($len -gt 22) {
          $strIdx3 = [int]$b[$i+21]
          if ($strIdx3 -gt 0) {
            $si = $i + $len
            $s3 = ''; $cnt = 0
            while ($si -lt $end - 1) {
              if ($b[$si] -eq 0 -and $b[$si+1] -eq 0) { break }
              $n = $b[$si+1]
              $cnt++
              if ($cnt -eq $strIdx3) {
                for ($k = 0; $k -lt $n; $k++) { if ($si+2+$k -lt $end) { $s3 += [char]$b[$si+2+$k] } }
                break
              }
              $si += $n + 1
            }
            $rec['partNumber'] = $s3
          }
        }
        # Serial number (offset 20, 1-indexed)
        $rec['serialNumber'] = ''
        if ($len -gt 21) {
          $strIdx4 = [int]$b[$i+20]
          if ($strIdx4 -gt 0) {
            $si = $i + $len
            $s4 = ''; $cnt = 0
            while ($si -lt $end - 1) {
              if ($b[$si] -eq 0 -and $b[$si+1] -eq 0) { break }
              $n = $b[$si+1]
              $cnt++
              if ($cnt -eq $strIdx4) {
                for ($k = 0; $k -lt $n; $k++) { if ($si+2+$k -lt $end) { $s4 += [char]$b[$si+2+$k] } }
                break
              }
              $si += $n + 1
            }
            $rec['serialNumber'] = $s4
          }
        }
        $result.Add($rec) | Out-Null
      }
      $i += $len
      while ($i -lt $end - 1) {
        if ($b[$i] -eq 0 -and $b[$i+1] -eq 0) { $i += 2; break }
        $i += $b[$i+1] + 1
      }
    }
  } catch {}
  return ,$result.ToArray()
}

function Get-MemoryTiming {
  param([string]$slot)
  # Memory timing thường không có trong WMI, dùng SPD registry hoặc benchmark tool
  # Trả về string như "16-18-18-38" nếu đọc được từ registry
  try {
    $spdPath = "HKLM:\SYSTEM\CurrentControlSet\Services\mssmbios\Data\MemorySpd"
    if (Test-Path $spdPath) {
      $slotData = Get-ItemProperty $spdPath -ErrorAction SilentlyContinue
      if ($slotData) {
        $prop = $slotData.PSObject.Properties | Where-Object { $_.Name -match $slot -or $_.Name -match 'Slot' } | Select-Object -First 1
        if ($prop) {
          # SPD bytes thường ở offset 42-53 trong mỗi slot entry
          $bytes = [byte[]]$prop.Value
          if ($bytes -and $bytes.Length -gt 50) {
            $cl = $bytes[42]
            $trcd = $bytes[43]
            $trp = $bytes[44]
            $tras = $bytes[45]
            if ($cl -and $trcd -and $trp -and $tras) {
              return "\${cl}-\${trcd}-\${trp}-\${tras}"
            }
          }
        }
      }
    }
  } catch {}
  return $null
}

function Get-MemoryGeneration {
  param([int]$memType, [int]$typeDetail)
  $mapped = switch ($memType) {
    20 { 'DDR' }
    21 { 'DDR2' }
    24 { 'DDR3' }
    26 { 'DDR4' }
    30 { 'DDR4' }
    31 { 'DDR5' }
    34 { 'DDR5' }
    35 { 'DDR5' }
    default { '' }
  }
  if ($mapped) { return $mapped }
  if (($typeDetail -band 128) -ne 0) { return 'DDR?' }
  return 'Unknown'
}

function Refine-GenerationFromSpeed {
  param([int]$mhz)
  if ($mhz -ge 3200) { return 'DDR5' }
  if ($mhz -ge 1600) { return 'DDR4' }
  if ($mhz -ge 800) { return 'DDR3' }
  return $null
}

function Get-PlatformMemoryMax {
  param([string]$cpuName)
  if (-not $cpuName) { return $null }
  $n = $cpuName.ToLower()
  if ($n -match 'i[3579][-\s]1[3-4]\d{3}') { return @{ ddr4Max = 3200; ddr5Max = 5600 } }
  if ($n -match 'i[3579][-\s]12\d{3}') { return @{ ddr4Max = 3200; ddr5Max = 5600 } }
  if ($n -match 'i[3579][-\s]11\d{3}') { return @{ ddr4Max = 3200; ddr5Max = 4800 } }
  if ($n -match 'i[3579][-\s]10\d{3}') { return @{ ddr4Max = 2933; ddr5Max = $null } }
  if ($n -match 'i[3579][-\s][89]\d{3}') { return @{ ddr4Max = 2666; ddr5Max = $null } }
  if ($n -match 'i[3579][-\s][67]\d{3}') { return @{ ddr4Max = 2400; ddr5Max = $null } }
  if ($n -match 'ryzen.*9\s*7[0-9]0[0-9]|ryzen.*9\s*9[0-9]0[0-9]') { return @{ ddr5Max = 5200; ddr4Max = 3200 } }
  if ($n -match 'ryzen.*[579]\s*5[0-9]0[0-9]') { return @{ ddr5Max = 4800; ddr4Max = 3200 } }
  if ($n -match 'ryzen.*[357]\s*4[0-9]0[0-9]') { return @{ ddr5Max = 4800; ddr4Max = 3200 } }
  if ($n -match 'ryzen') { return @{ ddr4Max = 3200; ddr5Max = $null } }
  return $null
}

# ══════════════════════════════════════════════════════════════
# GPU — Win32_VideoController + DirectX (CIMV2) + Registry
# ══════════════════════════════════════════════════════════════
function Get-GpuDetails {
  $gpuList = New-Object System.Collections.Generic.List[object]
  $gpus = Get-CimInstance Win32_VideoController
  foreach ($g in $gpus) {
    if (-not $g) { continue }
    $item = @{
      name = [string]$g.Name
      driverVersion = [string]$g.DriverVersion
      vramMb = if ($g.AdapterRAM -gt 0) { [int]([math]::Round([double]$g.AdapterRAM / 1048576.0)) } else { $null }
      vramSharedMb = $null
      vramType = $null
      busWidth = $null
      computeUnits = $null
      tdpW = $null
    }

    # DirectX adapter info (chuẩn xác hơn cho VRAM)
    try {
      $dxAdapters = Get-CimInstance Win32_DirectXDirectory -ErrorAction SilentlyContinue
    } catch {}

    # Registry: lấy VRAM chi tiết từ NVIDIA/AMD/Intel registry key
    $gName = $g.Name.ToLower()
    $pnpDevId = [string]$g.PNPDeviceID
    try {
      # Try hardware registry key
      $hwPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\"
      $keys = Get-ChildItem $hwPath -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch '0000$' }
      foreach ($k in $keys) {
        $devId = (Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue).MatchingDeviceId
        if ($devId -and $pnpDevId -match [regex]::Escape($devId).Replace('\\','').Substring(0, [Math]::Min(20, $devId.Length))) {
          $reg = Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue
          if ($reg) {
            if ($reg.VRamSize) { $item.vramMb = [int]([math]::Round([double]$reg.VRamSize / 1048576.0)) }
            if ($reg.VRAMSharedSize) { $item.vramSharedMb = [int]([math]::Round([double]$reg.VRAMSharedSize / 1048576.0)) }
            if ($reg.VRAMType) { $item.vramType = $reg.VRAMType }
            if ($reg.MemorySize) { $item.vramMb = [int]([math]::Round([double]$reg.MemorySize / 1048576.0)) }
          }
        }
      }
    } catch {}

    # Fallback: WQL query cho video memory
    if (-not $item.vramMb) {
      try {
        $wql = Get-CimInstance -Query "SELECT * FROM Win32_VideoController WHERE DeviceID LIKE '$([regex]::Escape($g.DeviceID))%'" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($wql -and $wql.AdapterRAM -gt 0) { $item.vramMb = [int]([math]::Round([double]$wql.AdapterRAM / 1048576.0)) }
      } catch {}
    }

    # Compute units (GPU cores) + TDP - estimate từ tên GPU
    $vram = $item.vramMb
    
    # NVIDIA Desktop RTX 50 series
    if ($gName -match 'rtx\s*50[89]0') { $item.computeUnits = 21504; $item.tdpW = 575 }
    elseif ($gName -match 'rtx\s*50[67]0') { $item.computeUnits = 12800; $item.tdpW = 400 }
    elseif ($gName -match 'rtx\s*50[56]0') { $item.computeUnits = 8192; $item.tdpW = 250 }
    
    # NVIDIA Desktop RTX 40 series
    elseif ($gName -match 'rtx\s*4090') { $item.computeUnits = 16384; $item.tdpW = 450 }
    elseif ($gName -match 'rtx\s*4080') { $item.computeUnits = 9728; $item.tdpW = 320 }
    elseif ($gName -match 'rtx\s*4070\s*ti\s*super') { $item.computeUnits = 8448; $item.tdpW = 285 }
    elseif ($gName -match 'rtx\s*4070\s*ti') { $item.computeUnits = 7680; $item.tdpW = 285 }
    elseif ($gName -match 'rtx\s*4070\s*super') { $item.computeUnits = 7168; $item.tdpW = 220 }
    elseif ($gName -match 'rtx\s*4070') { $item.computeUnits = 5888; $item.tdpW = 200 }
    elseif ($gName -match 'rtx\s*4060\s*ti') { $item.computeUnits = 4352; $item.tdpW = 165 }
    elseif ($gName -match 'rtx\s*4060') { $item.computeUnits = 3072; $item.tdpW = 115 }
    elseif ($gName -match 'rtx\s*4050') { $item.computeUnits = 2560; $item.tdpW = 100 }
    
    # NVIDIA Laptop RTX 40 series
    elseif ($gName -match 'rtx\s*4090.*laptop') { $item.computeUnits = 9728; $item.tdpW = 175 }
    elseif ($gName -match 'rtx\s*4080.*laptop') { $item.computeUnits = 7424; $item.tdpW = 150 }
    elseif ($gName -match 'rtx\s*4070.*laptop') { $item.computeUnits = 4608; $item.tdpW = 140 }
    elseif ($gName -match 'rtx\s*4060.*laptop') { $item.computeUnits = 3072; $item.tdpW = 115 }
    elseif ($gName -match 'rtx\s*4050.*laptop') { $item.computeUnits = 2560; $item.tdpW = 95 }
    
    # NVIDIA Desktop RTX 30 series
    elseif ($gName -match 'rtx\s*3090\s*ti') { $item.computeUnits = 10752; $item.tdpW = 450 }
    elseif ($gName -match 'rtx\s*3090') { $item.computeUnits = 10496; $item.tdpW = 350 }
    elseif ($gName -match 'rtx\s*3080\s*ti') { $item.computeUnits = 10240; $item.tdpW = 350 }
    elseif ($gName -match 'rtx\s*3080') { $item.computeUnits = 8704; $item.tdpW = 320 }
    elseif ($gName -match 'rtx\s*3070\s*ti') { $item.computeUnits = 6144; $item.tdpW = 290 }
    elseif ($gName -match 'rtx\s*3070') { $item.computeUnits = 5888; $item.tdpW = 220 }
    elseif ($gName -match 'rtx\s*3060\s*ti') { $item.computeUnits = 4864; $item.tdpW = 200 }
    elseif ($gName -match 'rtx\s*3060') { $item.computeUnits = 3584; $item.tdpW = 170 }
    elseif ($gName -match 'rtx\s*3050') { $item.computeUnits = 2560; $item.tdpW = 130 }
    
    # NVIDIA Laptop RTX 30 series
    elseif ($gName -match 'rtx\s*3080.*laptop') { $item.computeUnits = 6144; $item.tdpW = 165 }
    elseif ($gName -match 'rtx\s*3070.*laptop') { $item.computeUnits = 5120; $item.tdpW = 140 }
    elseif ($gName -match 'rtx\s*3060.*laptop') { $item.computeUnits = 3840; $item.tdpW = 115 }
    elseif ($gName -match 'rtx\s*3050.*laptop|rtx\s*3050\s*ti.*laptop') { $item.computeUnits = 2560; $item.tdpW = 95 }
    
    # NVIDIA RTX 20 series
    elseif ($gName -match 'rtx\s*2080\s*ti') { $item.computeUnits = 4352; $item.tdpW = 260 }
    elseif ($gName -match 'rtx\s*2080\s*super') { $item.computeUnits = 3072; $item.tdpW = 250 }
    elseif ($gName -match 'rtx\s*2080') { $item.computeUnits = 2944; $item.tdpW = 215 }
    elseif ($gName -match 'rtx\s*2070\s*super') { $item.computeUnits = 2560; $item.tdpW = 215 }
    elseif ($gName -match 'rtx\s*2070') { $item.computeUnits = 2304; $item.tdpW = 175 }
    elseif ($gName -match 'rtx\s*2060\s*super') { $item.computeUnits = 2176; $item.tdpW = 175 }
    elseif ($gName -match 'rtx\s*2060') { $item.computeUnits = 1920; $item.tdpW = 160 }
    
    # NVIDIA GTX 16 series
    elseif ($gName -match 'gtx\s*1660\s*ti') { $item.computeUnits = 1536; $item.tdpW = 120 }
    elseif ($gName -match 'gtx\s*1660\s*super') { $item.computeUnits = 1408; $item.tdpW = 125 }
    elseif ($gName -match 'gtx\s*1660') { $item.computeUnits = 1408; $item.tdpW = 120 }
    elseif ($gName -match 'gtx\s*1650\s*super') { $item.computeUnits = 1280; $item.tdpW = 100 }
    elseif ($gName -match 'gtx\s*1650') { $item.computeUnits = 896; $item.tdpW = 75 }
    elseif ($gName -match 'gtx\s*1630') { $item.computeUnits = 512; $item.tdpW = 75 }
    
    # AMD Radeon RX 7000 series
    elseif ($gName -match 'rx\s*7900\s*xtx') { $item.computeUnits = 6144; $item.tdpW = 355 }
    elseif ($gName -match 'rx\s*7900\s*xt') { $item.computeUnits = 5376; $item.tdpW = 315 }
    elseif ($gName -match 'rx\s*7800\s*xt') { $item.computeUnits = 3840; $item.tdpW = 263 }
    elseif ($gName -match 'rx\s*7700\s*xt') { $item.computeUnits = 3456; $item.tdpW = 245 }
    elseif ($gName -match 'rx\s*7600\s*xt') { $item.computeUnits = 2048; $item.tdpW = 190 }
    elseif ($gName -match 'rx\s*7600') { $item.computeUnits = 2048; $item.tdpW = 165 }
    
    # AMD Radeon RX 6000 series
    elseif ($gName -match 'rx\s*6950\s*xt') { $item.computeUnits = 5120; $item.tdpW = 335 }
    elseif ($gName -match 'rx\s*6900\s*xt') { $item.computeUnits = 5120; $item.tdpW = 300 }
    elseif ($gName -match 'rx\s*6800\s*xt') { $item.computeUnits = 4608; $item.tdpW = 300 }
    elseif ($gName -match 'rx\s*6800') { $item.computeUnits = 3840; $item.tdpW = 250 }
    elseif ($gName -match 'rx\s*6750\s*xt') { $item.computeUnits = 2560; $item.tdpW = 250 }
    elseif ($gName -match 'rx\s*6700\s*xt') { $item.computeUnits = 2560; $item.tdpW = 230 }
    elseif ($gName -match 'rx\s*6700') { $item.computeUnits = 2304; $item.tdpW = 175 }
    elseif ($gName -match 'rx\s*6650\s*xt') { $item.computeUnits = 2048; $item.tdpW = 180 }
    elseif ($gName -match 'rx\s*6600\s*xt') { $item.computeUnits = 2048; $item.tdpW = 160 }
    elseif ($gName -match 'rx\s*6600') { $item.computeUnits = 1792; $item.tdpW = 132 }
    elseif ($gName -match 'rx\s*6500\s*xt') { $item.computeUnits = 1024; $item.tdpW = 107 }
    elseif ($gName -match 'rx\s*6400') { $item.computeUnits = 768; $item.tdpW = 53 }
    
    # AMD Radeon RX 5000 series
    elseif ($gName -match 'rx\s*5700\s*xt') { $item.computeUnits = 2560; $item.tdpW = 225 }
    elseif ($gName -match 'rx\s*5700') { $item.computeUnits = 2304; $item.tdpW = 180 }
    elseif ($gName -match 'rx\s*5600\s*xt') { $item.computeUnits = 2304; $item.tdpW = 150 }
    elseif ($gName -match 'rx\s*5500\s*xt') { $item.computeUnits = 1408; $item.tdpW = 130 }
    
    # Intel Arc
    elseif ($gName -match 'arc\s*a770') { $item.computeUnits = 4096; $item.tdpW = 225 }
    elseif ($gName -match 'arc\s*a750') { $item.computeUnits = 3584; $item.tdpW = 225 }
    elseif ($gName -match 'arc\s*a580') { $item.computeUnits = 3072; $item.tdpW = 185 }
    elseif ($gName -match 'arc\s*a380') { $item.computeUnits = 1024; $item.tdpW = 75 }
    elseif ($gName -match 'arc\s*a310') { $item.computeUnits = 768; $item.tdpW = 75 }
    
    # Intel Integrated Graphics
    elseif ($gName -match 'intel.*uhd.*770') { $item.computeUnits = 256; $item.tdpW = 30 }
    elseif ($gName -match 'intel.*uhd.*730') { $item.computeUnits = 192; $item.tdpW = 25 }
    elseif ($gName -match 'intel.*uhd.*630|intel.*uhd.*graphics\s*630') { $item.computeUnits = 192; $item.tdpW = 25 }
    elseif ($gName -match 'intel.*uhd') { $item.computeUnits = 96; $item.tdpW = 15 }
    elseif ($gName -match 'intel.*iris.*xe') { $item.computeUnits = 768; $item.tdpW = 28 }
    elseif ($gName -match 'intel.*iris') { $item.computeUnits = 384; $item.tdpW = 28 }

    $gpuList.Add($item) | Out-Null
  }
  return ,$gpuList.ToArray()
}

# ══════════════════════════════════════════════════════════════
# Disk — Win32_DiskDrive + WQL cho SMART + free space
# ══════════════════════════════════════════════════════════════
function Get-DiskType {
  param([string]$model, [string]$iface, [string]$pnp)
  $m = if ($model) { $model.ToLower() } else { '' }
  $p = if ($pnp) { $pnp.ToLower() } else { '' }
  $i = if ($iface) { $iface.ToLower() } else { '' }

  if ($p -match 'ven_nvme|ven_intel.*nvme' -or $m -match 'nvme') { return 'NVMe SSD' }
  if ($m -match 'ssd|m\.2|m2$|snv|sk\s?hynix|samsung.*evo|wd\s?blue.*ssd|wd\s?black.*sn|crucial\s?p[2-9]|crucial\s?mx|sabrent|kingston\s?(sa|sk|kc|a[0-9]|dc)|seagate\s?firecuda|seagate\s?barracuda\s?ssd|toshiba.*thn|samsung\s?(970|980|990|pm9)') {
    return 'SSD'
  }
  if ($p -match 'usb' -or $i -match 'usb') { return 'USB' }
  if ($m -match 'hdd|\bhdd\b|st[0-9]{4,}|hm[0-9]{3,}|wdc\s?wd|mq[0-9]{3,}|hts[0-9]|toshiba.*mq|toshiba.*mk|dt01|wd\s?caviar|wd\s?purple|wd\s?red|seagate\s?barracuda|seagate\s?ironwolf|seagate\s?skyhawk|toshiba\s?dt|trav?elstar') {
    return 'HDD'
  }
  if ($i -eq 'ide') { return 'HDD' }
  return 'Unknown'
}

function Get-DiskTempAndHealth {
  param([string]$pnpDevId)
  $result = @{ tempC = $null; health = $null }
  try {
    # WMI MSStorageDriver (SMART) - đọc temperature attribute
    $wql = Get-CimInstance -Namespace 'root\WMI' -Query "SELECT * FROM MSStorageDriver_ATAPassThru WHERE DriverName LIKE '%$pnpDevId%'" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($wql -and $wql.InstanceName) {
      $smart = Get-CimInstance -Namespace 'root\WMI' -Query "SELECT * FROM MSStorageDriver_ATAPassThru WHERE InstanceName='$($wql.InstanceName)'" -ErrorAction SilentlyContinue | Select-Object -First 1
    }
    # SMART attributes từ root\WMI
    $smartAt = Get-CimInstance -Namespace 'root\WMI' -Query "SELECT * FROM MSAcidigitalInformation" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($smartAt -and $smartAt.VendorSpecific) {
      $vs = [byte[]]$smartAt.VendorSpecific
      # Attribute ID 194 = Temperature (often)
      for ($j = 2; $j -lt $vs.Length - 12; $j++) {
        if ($vs[$j] -eq 194 -and $vs[$j+1] -eq 0x10) {
          $result.tempC = [int]$vs[$j+5]
          break
        }
      }
    }
  } catch {}
  # Health status từ Win32_DiskDrive hoặc Win32_PhysicalMedia
  try {
    $media = Get-CimInstance Win32_PhysicalMedia | Select-Object -First 5
  } catch {}
  return $result
}

# ══════════════════════════════════════════════════════════════
# Battery — Win32_Battery + BatteryStatus (root\WMI) + cycles
# ══════════════════════════════════════════════════════════════
function Get-BatteryDetails {
  $bat = Get-CimInstance Win32_Battery | Select-Object -First 1
  if (-not $bat) { return $null }
  $result = @{}
  $result['name'] = [string]$bat.Name
  $result['status'] = [string]$bat.Status
  $result['chemistry'] = [string]$bat.Chemistry
  $design = [int]$bat.DesignCapacity
  $full = [int]$bat.FullChargeCapacity
  $result['designCapacityMwh'] = if ($design -gt 0) { $design } else { $null }
  $result['fullChargeCapacityMwh'] = if ($full -gt 0) { $full } else { $null }
  $result['healthPct'] = if ($design -gt 0 -and $full -gt 0) { [math]::Round(($full * 100.0) / $design, 1) } else { $null }
  $result['voltageMv'] = if ($bat.DesignVoltage -gt 0) { [int]$bat.DesignVoltage } else { $null }
  $result['currentRateMw'] = $null
  $result['dischargeRateMw'] = $null
  $result['cycleCount'] = $null

  # Cycle count từ BatteryStatus (root\WMI)
  try {
    $bs = Get-CimInstance -Namespace 'root\WMI' -ClassName BatteryStatus -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($bs) {
      if ($bs.DischargeRate -and $bs.DischargeRate -gt 0 -and $bs.DischargeRate -lt 1000000) {
        $result['dischargeRateMw'] = [int]$bs.DischargeRate
      }
      if ($bs.ChargeRate -and $bs.ChargeRate -gt 0 -and $bs.ChargeRate -lt 1000000) {
        $result['currentRateMw'] = [int]$bs.ChargeRate
      }
    }
  } catch {}
  try {
    $bc = Get-CimInstance -Namespace 'root\WMI' -ClassName BatteryFullChargedCapacity -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($bc -and $bc.FullChargedCapacity) {
      $result['fullChargeCapacityMwh'] = [int]$bc.FullChargedCapacity
      if ($design -gt 0) {
        $result['healthPct'] = [math]::Round(($bc.FullChargedCapacity * 100.0) / $design, 1)
      }
    }
  } catch {}
  # Cycle count - try multiple sources
  try {
    $cycleCount = Get-CimInstance -Namespace 'root\WMI' -Query "SELECT * FROM BatteryCycleCount" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cycleCount -and $cycleCount.CycleCount) {
      $result['cycleCount'] = [int]$cycleCount.CycleCount
    }
  } catch {}
  try {
    # WQL query cho cycle count
    $wqlCycle = Get-CimInstance -Query "SELECT * FROM BatteryStaticData" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($wqlCycle -and $wqlCycle.CycleCount) {
      $result['cycleCount'] = [int]$wqlCycle.CycleCount
    }
  } catch {}

  return $result
}

# ══════════════════════════════════════════════════════════════
# Network — Win32_NetworkAdapter + DriverVersion from registry
# ══════════════════════════════════════════════════════════════
function Get-NetworkDetails {
  $list = New-Object System.Collections.Generic.List[object]
  $adapters = Get-CimInstance Win32_NetworkAdapter -ErrorAction SilentlyContinue
  $adapters = $adapters | Where-Object { $_.PhysicalAdapter -or $_.NetEnabled }
  foreach ($a in $adapters) {
    if (-not $a -or -not $a.MACAddress) { continue }
    $item = @{
      name = [string]$a.NetConnectionID
      mac = ([string]$a.MACAddress).ToLower()
      ipv4 = @()
      ipv6 = @()
      speedMbps = if ($a.Speed -and $a.Speed -gt 0 -and $a.Speed -lt 20000000000) { [int]($a.Speed / 1000000) } else { $null }
      driverVersion = $null
      type = if ($a.AdapterType) { $a.AdapterType } else { $null }
    }

    # Driver version từ registry
    try {
      $regPath = "HKLM:\SYSTEM\CurrentControlSet\Class\{4d36e972-e325-11ce-bfc1-08002be10318}\"
      $keys = Get-ChildItem $regPath -ErrorAction SilentlyContinue
      foreach ($k in $keys) {
        $id = (Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue).DeviceID
        if ($id -and $a.PNPDeviceID -and $a.PNPDeviceID -match [regex]::Escape($id)) {
          $item.driverVersion = (Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue).DriverVersion
          break
        }
      }
    } catch {}

    # IP address
    try {
      $cfg = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "Index=$($a.Index)" -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($cfg -and $cfg.IPAddress) {
        foreach ($ip in $cfg.IPAddress) {
          if ($ip -match '^\d{1,3}(\.\d{1,3}){3}$') { $item.ipv4 += $ip }
          elseif ($ip -match ':') { $item.ipv6 += $ip }
        }
      }
    } catch {}

    $list.Add($item) | Out-Null
  }
  return ,$list.ToArray()
}

# ══════════════════════════════════════════════════════════════
# MAIN — Collect all hardware
# ══════════════════════════════════════════════════════════════

# --- CPU ---
try {
  Out-Part 'cpu' (Get-CpuDetails)
} catch { Out-Error 'cpu' $_.Exception.Message }

# --- Memory ---
try {
  $modList = Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue
  $totalBytes = 0
  $modules = New-Object System.Collections.Generic.List[object]
  $cpuName = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1).Name
  $platMax = Get-PlatformMemoryMax $cpuName
  $smbiosModules = Get-SmbiosType17Max
  $slotToSmbios = @{}
  foreach ($s in $smbiosModules) { if ($s.deviceLocator) { $slotToSmbios[$s.deviceLocator] = $s } }
  foreach ($m in $modList) {
    if (-not $m -or -not $m.Capacity) { continue }
    $cap = [int64]$m.Capacity; $totalBytes += $cap
    $slot = [string]$m.DeviceLocator
    $configured = if ($m.Speed -gt 0) { [int]$m.Speed } else { $null }
    $smbiosSpeed = $null
    if ($slotToSmbios.ContainsKey($slot)) { $smbiosSpeed = $slotToSmbios[$slot].speed }
    $gen = Get-MemoryGeneration ([int]$m.MemoryType) ([int]$m.TypeDetail)
    if ($gen -eq 'DDR?' -and $configured) {
      $refined = Refine-GenerationFromSpeed $configured
      if ($refined) { $gen = $refined }
    }
    $platMaxForGen = $null
    if ($platMax) {
      if ($gen -eq 'DDR5') { $platMaxForGen = $platMax.ddr5Max }
      elseif ($gen -in 'DDR','DDR2','DDR3','DDR4','DDR?') { $platMaxForGen = $platMax.ddr4Max }
    }
    $timing = Get-MemoryTiming $slot
    $normalizedMfr = Normalize-RamManufacturer ([string]$m.Manufacturer)
    $modules.Add(@{
      slot = $slot
      sizeBytes = $cap
      speedMhz = $configured
      configuredMhz = $configured
      smbiosSpeedMhz = $smbiosSpeed
      platformMaxMhz = $platMaxForGen
      type = [string]$m.MemoryType
      generation = $gen
      manufacturer = $normalizedMfr
      partNumber = [string]$m.PartNumber
      serialNumber = [string]$m.SerialNumber
      voltageMv = if ($m.ConfiguredVoltage -gt 0) { [int]($m.ConfiguredVoltage / 1000) } else { $null }
      clTiming = $timing
    }) | Out-Null
  }
  $os = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
  $totalPhysical = if ($os -and $os.TotalPhysicalMemory) { [int64]$os.TotalPhysicalMemory } else { $totalBytes }
  $platMaxOverall = $null
  if ($platMax -and $modules.Count -gt 0) {
    $anyDdr5 = $false
    foreach ($mm in $modules) { if ($mm.generation -eq 'DDR5') { $anyDdr5 = $true; break } }
    $platMaxOverall = if ($anyDdr5) { $platMax.ddr5Max } else { $platMax.ddr4Max }
  }
  Out-Part 'memory' @{
    totalBytes = $totalPhysical
    usedBytes = $null; freeBytes = $null
    slots = if ($modules.Count -gt 0) { $modules.Count } else { $null }
    modules = @($modules.ToArray())
    platformMaxMhz = $platMaxOverall
    platformCpuName = $cpuName
  }
} catch { Out-Error 'memory' $_.Exception.Message }

# --- Disks ---
try {
  $driveList = Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue
  $list = New-Object System.Collections.Generic.List[object]
  foreach ($d in $driveList) {
    if (-not $d) { continue }
    $sizeBytes = [int64]$d.Size
    $capGb = if ($sizeBytes -gt 0) { [int]([math]::Floor($sizeBytes / 1073741824)) } else { $null }
    $pnp = [string]$d.PnpDeviceId
    $model = [string]$d.Model
    $iface = [string]$d.InterfaceType
    $type = Get-DiskType $model $iface $pnp
    $smartInfo = Get-DiskTempAndHealth $pnp
    # Free space từ Win32_LogicalDisk (chỉ system disk)
    $freeGb = $null
    try {
      $vol = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($d.DeviceID -replace '\\\\\\\\\\\\?\\\\','' -replace '\\\\PhysicalDrive\d','C:')'" -ErrorAction SilentlyContinue | Select-Object -First 1
      if (-not $vol) {
        $vol = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue | Select-Object -First 1
      }
      if ($vol -and $vol.FreeSpace) { $freeGb = [int]([math]::Floor($vol.FreeSpace / 1073741824)) }
    } catch {}
    $list.Add(@{
      name = $model; model = $model; type = $type
      capacityGb = $capGb; freeGb = $freeGb
      mediaType = [string]$d.MediaType
      interfaceType = $iface
      firmwareRevision = [string]$d.FirmwareRevision
      serialNumber = [string]$d.SerialNumber
      tempC = $smartInfo.tempC
      healthStatus = if ($smartInfo.health) { $smartInfo.health } else { 'Unknown' }
    }) | Out-Null
  }
  Out-Part 'disks' @($list.ToArray())
} catch { Out-Error 'disks' $_.Exception.Message }

# --- GPU ---
try {
  Out-Part 'gpu' (Get-GpuDetails)
} catch { Out-Error 'gpu' $_.Exception.Message }

# --- Mainboard ---
try {
  $mb = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue | Select-Object -First 1
  $bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($mb) {
    Out-Part 'mainboard' @{
      manufacturer = [string]$mb.Manufacturer
      product = [string]$mb.Product
      serial = [string]$mb.SerialNumber
      version = [string]$mb.Version
      biosVersion = if ($bios) { [string]$bios.SMBIOSBIOSVersion } else { $null }
    }
  } else { Out-Error 'mainboard' 'No Win32_BaseBoard instance' }
} catch { Out-Error 'mainboard' $_.Exception.Message }

# --- BIOS ---
try {
  $b = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($b) {
    $rd = $null
    try {
      if ($b.ReleaseDate) {
        $rd = ([Management.ManagementDateTimeConverter]::ToDateTime($b.ReleaseDate)).ToString('o')
      }
    } catch {}
    Out-Part 'bios' @{
      manufacturer = [string]$b.Manufacturer
      version = [string]$b.SMBIOSBIOSVersion
      releaseDate = $rd
      smbiosVersion = [string]$b.SMBIOSMajorVersion + '.' + [string]$b.SMBIOSMinorVersion
    }
  } else { Out-Error 'bios' 'No Win32_BIOS instance' }
} catch { Out-Error 'bios' $_.Exception.Message }

# --- Battery ---
try {
  $bat = Get-BatteryDetails
  if ($bat) { Out-Part 'battery' $bat }
  else { Out-Error 'battery' 'No battery present' }
} catch { Out-Error 'battery' $_.Exception.Message }

# --- OS ---
try {
  $osRaw = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue | Select-Object -First 1
  $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue | Select-Object -First 1
  $activated = $null
  try {
    $sla = Get-CimInstance SoftwareLicensingProduct -ErrorAction SilentlyContinue |
           Where-Object { $_.PartialProductKey -and $_.ApplicationId -match '55c92734' } |
           Select-Object -First 1
    if ($sla -and [int]$sla.LicenseStatus -eq 1) { $activated = $true } else { $activated = $false }
  } catch {}
  if ($osRaw) {
    $installDate = $null; $lastBoot = $null
    try {
      if ($osRaw.InstallDate) {
        $installDate = ([Management.ManagementDateTimeConverter]::ToDateTime($osRaw.InstallDate)).ToString('o')
      }
    } catch {}
    try {
      $lastBoot = $osRaw.LastBootUpTime.ToString('o')
    } catch {}
    Out-Part 'os' @{
      caption = [string]$osRaw.Caption
      version = [string]$osRaw.Version
      build = [string]$osRaw.BuildNumber
      arch = [string]$osRaw.OSArchitecture
      hostname = if ($cs) { [string]$cs.Name } else { $null }
      serial = if ($cs) { [string]$cs.IdentifyingNumber } else { $null }
      activated = $activated
      installDate = $installDate
      lastBootTime = $lastBoot
    }
  } else { Out-Error 'os' 'No Win32_OperatingSystem instance' }
} catch { Out-Error 'os' $_.Exception.Message }

# --- Network ---
try {
  Out-Part 'network' (Get-NetworkDetails)
} catch { Out-Error 'network' $_.Exception.Message }

# Sentinel
[Console]::Out.WriteLine('{"key":"__done__","ok":true}')
[Console]::Out.Flush()
exit 0
`;

// ─── Node.js side ───────────────────────────────────────────────────────────────

interface RawPartMessage {
  key: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

export function streamHardware(onPart: HardwarePartListener): { stop: () => void } {
  const child = spawn(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "-"],
    { windowsHide: true },
  );

  let stdoutBuf = "";
  let stopped = false;
  let doneSeen = false;

  const finish = (reason: string) => {
    if (stopped) return;
    stopped = true;
    try { child.kill(); } catch {}
    if (!doneSeen) {
      onPart({ key: "__error__", ok: false, error: reason, ts: Date.now() });
    }
  };

  const timer = setTimeout(() => finish(`timeout after ${TOTAL_TIMEOUT_MS}ms`), TOTAL_TIMEOUT_MS);

  child.stdout.on("data", (chunk: Buffer) => {
    if (stopped) return;
    stdoutBuf += chunk.toString("utf8");
    let nl: number;
    while ((nl = stdoutBuf.indexOf("\n")) >= 0) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      let msg: RawPartMessage | null = null;
      try {
        msg = JSON.parse(line) as RawPartMessage;
      } catch {
        continue;
      }
      if (msg.key === "__done__") {
        doneSeen = true;
        onPart({ key: "__done__", ok: true, ts: Date.now() });
        clearTimeout(timer);
        finish("done");
        return;
      }
      if (msg.ok) {
        onPart({ key: msg.key, ok: true, data: msg.data, ts: Date.now() } as HardwarePart);
      } else {
        onPart({ key: msg.key, ok: false, error: msg.error ?? "unknown error", ts: Date.now() });
      }
    }
  });

  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8").trim();
    if (text) console.error("[hardware/powershell]", text);
  });

  child.on("error", (err) => finish(`spawn error: ${err.message}`));
  child.on("close", (code) => {
    if (doneSeen) return;
    finish(`PowerShell closed with code ${code}`);
  });

  child.stdin.write(PS_HARDWARE_SCRIPT, "utf8");
  child.stdin.end();

  return {
    stop: () => {
      clearTimeout(timer);
      finish("manually stopped");
    },
  };
}

export async function collectHardware(): Promise<CollectedHardwareSnapshot> {
  const collectedAt = new Date().toISOString();
  const acc: CollectedHardwareSnapshot = {
    cpu: null, memory: null, disks: [], gpu: [],
    mainboard: null, bios: null, battery: null, os: null, network: [],
    collectedAt, source: "powershell-enhanced",
  };
  return new Promise<CollectedHardwareSnapshot>((resolve) => {
    streamHardware((part) => {
      if (part.key === "__done__" || (part.key === "__error__" && !part.ok)) {
        resolve(acc);
        return;
      }
      if (!part.ok) return;
      switch (part.key) {
        case "cpu": acc.cpu = part.data as CpuInfo | null; break;
        case "memory": acc.memory = part.data as MemoryInfo | null; break;
        case "disks": acc.disks = part.data as DiskInfo[]; break;
        case "gpu": acc.gpu = part.data as GpuInfo[]; break;
        case "mainboard": acc.mainboard = part.data as MainboardInfo | null; break;
        case "bios": acc.bios = part.data as BiosInfo | null; break;
        case "battery": acc.battery = part.data as BatteryInfo | null; break;
        case "os": acc.os = part.data as OsInfo | null; break;
        case "network": acc.network = part.data as NetworkInfo[]; break;
      }
    });
  });
}

export type CollectedHardwareSnapshot = {
  cpu: CpuInfo | null;
  memory: MemoryInfo | null;
  disks: DiskInfo[];
  gpu: GpuInfo[];
  mainboard: MainboardInfo | null;
  bios: BiosInfo | null;
  battery: BatteryInfo | null;
  os: OsInfo | null;
  network: NetworkInfo[];
  collectedAt: string;
  source: "powershell-enhanced";
};
