// hardware.ts — Stream phần cứng từng phần: spawn PowerShell, parse line-by-line,
// mỗi `Out-Part` line sẽ được emit ngay khi PS ghi ra (không đợi cả script xong).

import { spawn } from "node:child_process";

export type CpuInfo = {
  name: string | null;
  manufacturer: string | null;
  cores: number | null;
  threads: number | null;
  baseGhz: number | null;
  socket: string | null;
};

export type MemoryInfo = {
  totalBytes: number | null;
  usedBytes: number | null;
  freeBytes: number | null;
  slots: number | null;
  modules: Array<{
    sizeBytes: number | null;
    speedMhz: number | null;
    type: string | null;
    manufacturer: string | null;
    slot: string | null;
  }>;
};

export type DiskInfo = {
  name: string | null;
  model: string | null;
  type: string | null;
  capacityGb: number | null;
  mediaType: string | null;
  interfaceType: string | null;
};

export type GpuInfo = {
  name: string | null;
  driverVersion: string | null;
  vramMb: number | null;
};

export type MainboardInfo = {
  manufacturer: string | null;
  product: string | null;
  serial: string | null;
  version: string | null;
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
  voltageMv: number | null;
};

export type OsInfo = {
  caption: string | null;
  version: string | null;
  build: string | null;
  arch: string | null;
  hostname: string | null;
  serial: string | null;
  activated: boolean | null;
};

export type NetworkInfo = {
  name: string | null;
  mac: string | null;
  ipv4: string[];
  ipv6: string[];
  speedMbps: number | null;
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

/**
 * PowerShell script — gọi Get-CimInstance cho từng thành phần, build hashtable,
 * convert sang JSON 1 dòng. Mọi lỗi được catch riêng để 1 phần fail không
 * chặn phần còn lại.
 */
const PS_HARDWARE_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'

function Out-Part([string]$key, $value) {
  $payload = @{ key = $key; ok = $true; data = $value }
  [Console]::Out.WriteLine(($payload | ConvertTo-Json -Depth 8 -Compress))
  [Console]::Out.Flush()
}

function Out-Error([string]$key, [string]$msg) {
  $payload = @{ key = $key; ok = $false; error = $msg }
  [Console]::Out.WriteLine(($payload | ConvertTo-Json -Depth 4 -Compress))
  [Console]::Out.Flush()
}

# --- CPU ---
try {
  $c = Get-CimInstance Win32_Processor | Select-Object -First 1
  if ($c) {
    $baseGhz = if ($c.MaxClockSpeed) { [math]::Round([double]$c.MaxClockSpeed / 1000.0, 2) } else { $null }
    Out-Part 'cpu' @{
      name        = if ($c.Name) { $c.Name.Trim() } else { $null }
      manufacturer = [string]$c.Manufacturer
      cores       = if ($c.NumberOfCores -gt 0) { [int]$c.NumberOfCores } else { $null }
      threads     = if ($c.NumberOfLogicalProcessors -gt 0) { [int]$c.NumberOfLogicalProcessors } else { $null }
      baseGhz     = $baseGhz
      socket      = [string]$c.SocketDesignation
    }
  } else { Out-Error 'cpu' 'No Win32_Processor instance' }
} catch { Out-Error 'cpu' $_.Exception.Message }

# Parse SMBIOS raw structure table → list of type 17 (Memory Device) entries.
# Each entry: @{ speed (=running bus as reported by BIOS), sizeMb, configuredClock (since 2.8+) }
# Dùng để lấy "bus tối đa theo BIOS". Trên nhiều máy BIOS không populate → trả về null.
function Get-SmbiosType17Max {
  $result = New-Object System.Collections.Generic.List[object]
  try {
    $smbios = Get-CimInstance -Namespace 'root\wmi' -ClassName MSSmBios_RawSMBiosTables -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $smbios -or -not $smbios.SMBiosData) { return ,$result.ToArray() }
    $b = [byte[]]$smbios.SMBiosData
    $i = 0
    $end = $b.Length
    $loop = 0
    while ($i -lt $end - 2 -and $loop -lt 500) {
      $loop++
      $t = $b[$i]
      $len = $b[$i + 1]
      if ($len -lt 4 -or $len -gt 256) { break }
      if ($t -eq 127) { break }
      if ($t -eq 17) {
        $rec = @{}
        if ($i + 22 -lt $b.Length) {
          $rec['speed'] = [int]([uint16]($b[$i+21] + ($b[$i+22] * 256)))
        } else { $rec['speed'] = $null }
        if ($len -ge 35 -and ($i + 34) -lt $b.Length) {
          $rec['configuredClock'] = [int]([uint16]($b[$i+33] + ($b[$i+34] * 256)))
        } else { $rec['configuredClock'] = $null }
        if ($i + 13 -lt $b.Length) {
          $sizeRaw = [int]([uint16]($b[$i+12] + ($b[$i+13] * 256)))
          if (($sizeRaw -band 0x8000) -ne 0) { $rec['sizeMb'] = ($sizeRaw -band 0x7FFF) * 1024 }
          else { $rec['sizeMb'] = $sizeRaw }
        } else { $rec['sizeMb'] = $null }
        $rec['deviceLocator'] = ''
        if ($len -gt 17) {
          $strIdx = [int]$b[$i+16]
          # Walk strings after structured header.
          $si = $i + $len
          while ($si -lt $end - 1) {
            if ($b[$si] -eq 0 -and $b[$si+1] -eq 0) { break }
            $n = $b[$si+1]
            if ($strIdx -eq 0) {
              $str = ''
              for ($k = 0; $k -lt $n; $k++) { $str += [char]$b[$si + 2 + $k] }
              $rec['deviceLocator'] = $str
              break
            }
            $si += $n + 1
            $strIdx--
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

# Map CPU brand / family → platform max RAM bus (MT/s).
# Dựa theo Intel/AMD memory controller spec. Trả về @{ ddr4Max, ddr5Max } cho CPU đó.
# Nếu không match → $null.
function Get-PlatformMemoryMax {
  param([string]$cpuName)
  if (-not $cpuName) { return $null }
  $n = $cpuName.ToLower()
  # --- DDR5 mặc định cho Intel 12th+ (đa số). Có thể cả DDR4 tuỳ mainboard. ---
  # --- Intel: theo generation ---
  if ($n -match 'i[3579]-\s*1[2-9]\d{3}' -or $n -match 'i[3579]-1[2-9]\d{3}') {
    return @{ ddr4Max = 3200; ddr5Max = 5600 }   # 12th-14th gen
  }
  if ($n -match 'i[3579]-\s*1[1]\d{3}') { return @{ ddr4Max = 3200; ddr5Max = 4800 } } # 11th
  if ($n -match 'i[3579]-\s*10\d{3}')  { return @{ ddr4Max = 2933; ddr5Max = $null } } # 10th
  if ($n -match 'i[3579]-\s*[89]\d{3}')  { return @{ ddr4Max = 2666; ddr5Max = $null } } # 8-9th
  if ($n -match 'i[3579]-\s*[7]\d{3}')  { return @{ ddr4Max = 2400; ddr5Max = $null } } # 7th
  if ($n -match 'i[3579]-\s*[6]\d{3}')  { return @{ ddr4Max = 2133; ddr5Max = $null } } # 6th
  # --- AMD ---
  if ($n -match 'ryzen.*[79]\d{3}' -or $n -match 'ryzen.*9\d{3}0[0-9]') { return @{ ddr4Max = 3200; ddr5Max = $null } } # Zen3
  if ($n -match 'ryzen') { return @{ ddr4Max = 2933; ddr5Max = $null } }
  return $null
}

# Decide DDR4 or DDR5 dựa trên MemoryType CIM.
function Get-MemoryGeneration {
  param([int]$memType, [int]$typeDetail)
  # Win32_PhysicalMemory.MemoryType: 20=DDR, 21=DDR2, 24=DDR3, 26=DDR4, 30=DDR4, 31=DDR5, 34=DDR5
  # Nhiều máy (đặc biệt MSI/desktop) trả MemoryType=0 → fallback sang TypeDetail.
  $mapped = switch ($memType) {
    20 { 'DDR' }
    21 { 'DDR2' }
    24 { 'DDR3' }
    26 { 'DDR4' }
    30 { 'DDR4' }
    31 { 'DDR5' }
    34 { 'DDR5' }
    default { '' }
  }
  if ($mapped) { return $mapped }
  # TypeDetail bitmask (SMBIOS type 17, offset 19):
  # 1=Reserved, 4=EDO, 8=FPM, 16=ROM, 32=SRAM, 64=DRAM, 128=Synchronous, 256=CMOS, ...
  if (($typeDetail -band 128) -ne 0) {
    # Synchronous (DDR-family). Phân biệt DDR3/4/5 bằng speed heuristic.
    return 'DDR?'  # sẽ refine theo speed + platform
  }
  return 'Unknown'
}

function Refine-GenerationFromSpeed {
  param([int]$mhz)
  # DDR3 thường 800-2133, DDR4 1600-3200, DDR5 3200-8400.
  if ($mhz -ge 3200) { return 'DDR5' }
  if ($mhz -ge 1600) { return 'DDR4' }
  if ($mhz -ge 800) { return 'DDR3' }
  return $null
}

# --- Memory ---
try {
  $modList = Get-CimInstance Win32_PhysicalMemory
  $totalBytes = 0
  $modules = New-Object System.Collections.Generic.List[object]
  # Lấy CPU name (đã có ở trên qua $c.Name nếu cần).
  $cpuName = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name
  $platMax = Get-PlatformMemoryMax $cpuName
  # Lấy SMBIOS type 17 (nếu có).
  $smbiosModules = Get-SmbiosType17Max
  $slotToSmbios = @{}
  foreach ($s in $smbiosModules) {
    if ($s.deviceLocator) { $slotToSmbios[$s.deviceLocator] = $s }
  }
  foreach ($m in $modList) {
    if ($m -and $m.Capacity) {
      $cap = [int64]$m.Capacity
      $totalBytes += $cap
      $slot = [string]$m.DeviceLocator
      $configured = if ($m.Speed -gt 0) { [int]$m.Speed } else { $null }
      $smbiosSpeed = $null
      if ($slotToSmbios.ContainsKey($slot)) {
        $smbiosSpeed = $slotToSmbios[$slot].speed
      }
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
      $modules.Add(@{
        sizeBytes       = $cap
        speedMhz        = $configured
        smbiosSpeedMhz  = $smbiosSpeed
        configuredMhz   = $configured
        platformMaxMhz  = $platMaxForGen
        type            = [string]$m.MemoryType
        generation      = $gen
        manufacturer    = [string]$m.Manufacturer
        slot            = $slot
      }) | Out-Null
    }
  }
  $os = Get-CimInstance Win32_ComputerSystem
  $totalPhysical = if ($os -and $os.TotalPhysicalMemory) { [int64]$os.TotalPhysicalMemory } else { $totalBytes }
  # Platform max overall: prefer DDR4 or DDR5 dựa trên detection phổ biến.
  $platformMaxOverall = $null
  if ($platMax -and $modules.Count -gt 0) {
    $anyDdr5 = $false
    foreach ($mm in $modules) {
      if ($mm.generation -eq 'DDR5') { $anyDdr5 = $true; break }
    }
    $platformMaxOverall = if ($anyDdr5) { $platMax.ddr5Max } else { $platMax.ddr4Max }
  }
  Out-Part 'memory' @{
    totalBytes          = $totalPhysical
    usedBytes           = $null
    freeBytes           = $null
    slots               = if ($modules.Count -gt 0) { $modules.Count } else { $null }
    modules             = @($modules.ToArray())
    platformMaxMhz      = $platformMaxOverall
    platformCpuName     = $cpuName
  }
} catch { Out-Error 'memory' $_.Exception.Message }

# Detect disk type robustly:
# 1. PnpDeviceId chứa NVME → NVMe SSD (chắc chắn).
# 2. Model chứa pattern SSD → SSD.
# 3. PnpDeviceId có USB → USB.
# 4. Model match HDD pattern (Seagate ST*, WDC WD*, "HDD" trong tên, ...).
# 5. Fallback: nếu InterfaceType=IDE + không match SSD/NVMe → HDD (laptop 2.5" HDD cũ).
# 6. Còn lại: Unknown.
function Get-DiskType {
  param([string]$model, [string]$iface, [string]$pnp)
  $m = if ($model) { $model.ToLower() } else { '' }
  $p = if ($pnp) { $pnp.ToLower() } else { '' }
  $i = if ($iface) { $iface.ToLower() } else { '' }

  # 1. NVMe qua PnP hoặc model
  if ($p -match 'ven_nvme|ven_intel.*nvme' -or $m -match 'nvme') { return 'NVMe SSD' }
  # 2. SSD rõ ràng trong model
  if ($m -match 'ssd|m\.2 |m\.2$|m2$|snv|sk\s?hynix|samsung.*evo|wd\s?blue.*ssd|wd\s?black.*sn|crucial\s?p[2-9]|crucial\s?mx|crucial\s?b|crucial\s?m|sabrent|kingston\s?sa|kingston\s?sk|kingston\s?kc|kingston\s?a[0-9]|kingston\s?dc|seagate\s?firecuda|seagate\s?barracuda\s?ssd|toshiba.*thn|tr-181|tr-188|samsung.*970|samsung.*980|samsung.*990') {
    return 'SSD'
  }
  # 3. USB
  if ($p -match 'usb' -or $i -match 'usb') { return 'USB' }
  # 4. HDD: model chứa "HDD", Seagate ST*, Samsung HM*, WD WDC..., Toshiba MQ*, Hitachi HTS...
  if ($m -match 'hdd|\bhdd\b|st[0-9]{4,}|hm[0-9]{3,}|wdc\s?wd|mq[0-9]{3,}|mq0[0-9]{3}|hts[0-9]|toshiba.*mq|toshiba.*mk|dt01|wd\d|wd\s?caviar|wd\s?blue\s?\d|trav?elstar|seagate\s?barracuda|seagate\s?ironwolf|seagate\s?skyhawk|wd\s?purple|wd\s?red') {
    return 'HDD'
  }
  # 5. InterfaceType IDE cũ (laptop HDD cũ, optical drive) → thường là HDD
  if ($i -eq 'ide') { return 'HDD' }
  # 6. Mặc định: nếu MediaType = removable → Removable; nếu không → Unknown
  return 'Unknown'
}

# --- Disks ---
try {
  $driveList = Get-CimInstance Win32_DiskDrive
  $list = New-Object System.Collections.Generic.List[object]
  foreach ($d in $driveList) {
    if (-not $d) { continue }
    $sizeBytes = [int64]$d.Size
    $capGb = if ($sizeBytes -gt 0) { [int]([math]::Floor($sizeBytes / 1073741824)) } else { $null }
    $model = [string]$d.Model
    $media = [string]$d.MediaType
    $iface = [string]$d.InterfaceType
    $pnp = [string]$d.PnpDeviceId
    $type = Get-DiskType $model $iface $pnp
    $list.Add(@{
      name          = $model
      model         = $model
      type          = $type
      capacityGb    = $capGb
      mediaType     = $media
      interfaceType = $iface
      pnpDeviceId   = $pnp
    }) | Out-Null
  }
  Out-Part 'disks' @($list.ToArray())
} catch { Out-Error 'disks' $_.Exception.Message }
try {
  $gpus = Get-CimInstance Win32_VideoController
  $list = New-Object System.Collections.Generic.List[object]
  foreach ($g in $gpus) {
    if (-not $g) { continue }
    $list.Add(@{
      name          = [string]$g.Name
      driverVersion = [string]$g.DriverVersion
      vramMb        = if ($g.AdapterRAM -gt 0) { [int]([math]::Round([double]$g.AdapterRAM / 1048576.0)) } else { $null }
    }) | Out-Null
  }
  Out-Part 'gpu' @($list.ToArray())
} catch { Out-Error 'gpu' $_.Exception.Message }

# --- Mainboard ---
try {
  $mb = Get-CimInstance Win32_BaseBoard | Select-Object -First 1
  if ($mb) {
    Out-Part 'mainboard' @{
      manufacturer = [string]$mb.Manufacturer
      product      = [string]$mb.Product
      serial       = [string]$mb.SerialNumber
      version      = [string]$mb.Version
    }
  } else { Out-Error 'mainboard' 'No Win32_BaseBoard instance' }
} catch { Out-Error 'mainboard' $_.Exception.Message }

# --- BIOS ---
try {
  $b = Get-CimInstance Win32_BIOS | Select-Object -First 1
  if ($b) {
    $rd = $null
    try {
      if ($b.ReleaseDate) {
        $rd = ([Management.ManagementDateTimeConverter]::ToDateTime($b.ReleaseDate)).ToString('o')
      }
    } catch {}
    Out-Part 'bios' @{
      manufacturer   = [string]$b.Manufacturer
      version        = [string]$b.SMBIOSBIOSVersion
      releaseDate    = $rd
      smbiosVersion  = [string]$b.SMBIOSMajorVersion + '.' + [string]$b.SMBIOSMinorVersion
    }
  } else { Out-Error 'bios' 'No Win32_BIOS instance' }
} catch { Out-Error 'bios' $_.Exception.Message }

# --- Battery ---
try {
  $bat = Get-CimInstance Win32_Battery | Select-Object -First 1
  if ($bat) {
    $design = [int]$bat.DesignCapacity
    $full   = [int]$bat.FullChargeCapacity
    $health = $null
    if ($design -gt 0 -and $full -gt 0) { $health = [math]::Round(($full * 100.0) / $design, 1) }
    Out-Part 'battery' @{
      name                  = [string]$bat.Name
      status                = [string]$bat.Status
      chemistry             = [string]$bat.Chemistry
      designCapacityMwh     = if ($design -gt 0) { $design } else { $null }
      fullChargeCapacityMwh = if ($full   -gt 0) { $full   } else { $null }
      healthPct             = $health
      voltageMv             = $null
    }
  } else { Out-Error 'battery' 'No battery present' }
} catch { Out-Error 'battery' $_.Exception.Message }

# --- OS ---
try {
  $osRaw = Get-CimInstance Win32_OperatingSystem | Select-Object -First 1
  $cs = Get-CimInstance Win32_ComputerSystem | Select-Object -First 1
  $activated = $null
  try {
    $sla = Get-CimInstance SoftwareLicensingProduct -ErrorAction SilentlyContinue |
           Where-Object { $_.PartialProductKey -and $_.ApplicationId -match '55c92734' } |
           Select-Object -First 1
    if ($sla -and [int]$sla.LicenseStatus -eq 1) { $activated = $true } else { $activated = $false }
  } catch {}
  if ($osRaw) {
    Out-Part 'os' @{
      caption   = [string]$osRaw.Caption
      version   = [string]$osRaw.Version
      build     = [string]$osRaw.BuildNumber
      arch      = [string]$osRaw.OSArchitecture
      hostname  = if ($cs) { [string]$cs.Name } else { $null }
      serial    = if ($cs) { [string]$cs.IdentifyingNumber } else { $null }
      activated = $activated
    }
  } else { Out-Error 'os' 'No Win32_OperatingSystem instance' }
} catch { Out-Error 'os' $_.Exception.Message }

# --- Network ---
try {
  $adapters = Get-CimInstance Win32_NetworkAdapter -Filter 'PhysicalAdapter=True OR NetEnabled=True'
  $list = New-Object System.Collections.Generic.List[object]
  foreach ($a in $adapters) {
    if (-not $a -or -not $a.MACAddress) { continue }
    $ipv4 = New-Object System.Collections.Generic.List[string]
    $ipv6 = New-Object System.Collections.Generic.List[string]
    try {
      $cfg = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "Index=$($a.Index)" | Select-Object -First 1
      if ($cfg) {
        if ($cfg.IPAddress) {
          foreach ($ip in $cfg.IPAddress) {
            if ($ip -match '^\d{1,3}(\.\d{1,3}){3}$') { $ipv4.Add([string]$ip) | Out-Null }
            else { $ipv6.Add([string]$ip) | Out-Null }
          }
        }
      }
    } catch {}
    $list.Add(@{
      name      = [string]$a.NetConnectionID
      mac       = ([string]$a.MACAddress).ToLower()
      ipv4      = @($ipv4.ToArray())
      ipv6      = @($ipv6.ToArray())
      speedMbps = if ($a.Speed -and ([int64]$a.Speed -gt 0) -and ([int64]$a.Speed -lt 20000000000)) { [int]([math]::Round([double]$a.Speed / 1000000.0)) } else { $null }
    }) | Out-Null
  }
  Out-Part 'network' @($list.ToArray())
} catch { Out-Error 'network' $_.Exception.Message }

# Sentinel
[Console]::Out.WriteLine('{"key":"__done__","ok":true}')
[Console]::Out.Flush()
exit 0
`;

const TOTAL_TIMEOUT_MS = 120_000;

interface RawPartMessage {
  key: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Stream kết quả: spawn PowerShell, đọc stdout line-by-line, parse JSON,
 * gọi `onPart` cho mỗi phần xong (không đợi tất cả). Trả về khi:
 *   - nhận `__done__` (PowerShell kết thúc sạch)
 *   - timeout
 *   - process lỗi
 */
export function streamHardware(onPart: HardwarePartListener): {
  stop: () => void;
} {
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
    try {
      child.kill();
    } catch {}
    if (!doneSeen) {
      onPart({
        key: "__error__",
        ok: false,
        error: reason,
        ts: Date.now(),
      });
    }
  };

  const timer = setTimeout(
    () => finish(`timeout after ${TOTAL_TIMEOUT_MS}ms`),
    TOTAL_TIMEOUT_MS,
  );

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
        // Bỏ qua line không phải JSON (progress, debug).
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
        onPart({
          key: msg.key,
          ok: true,
          data: msg.data,
          ts: Date.now(),
        } as HardwarePart);
      } else {
        onPart({
          key: msg.key,
          ok: false,
          error: msg.error ?? "unknown error",
          ts: Date.now(),
        });
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

/** Backwards-compat: đợi tất cả rồi trả về 1 object (ít dùng). */
export async function collectHardware(): Promise<CollectedHardwareSnapshot> {
  const collectedAt = new Date().toISOString();
  const acc: CollectedHardwareSnapshot = {
    cpu: null,
    memory: null,
    disks: [],
    gpu: [],
    mainboard: null,
    bios: null,
    battery: null,
    os: null,
    network: [],
    collectedAt,
    source: "powershell",
  };
  return new Promise<CollectedHardwareSnapshot>((resolve) => {
    const handle = streamHardware((part) => {
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
    void handle;
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
  source: "powershell";
};
