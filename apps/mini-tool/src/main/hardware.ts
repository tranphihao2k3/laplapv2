// hardware.ts — Quét phần cứng chi tiết bằng PowerShell (WMI + Registry + DirectX)
// Kết hợp nhiều nguồn: CIM, SMBIOS, Registry, DirectX/CIM cho GPU VRAM,
// benchmark WMI provider, WQL queries để lấy thêm cache/turbo/memory timing.
// Stream từng phần về renderer qua IPC.

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

/**
 * PowerShell qua `powershell.exe -Command -` (stdin) bị mất stdout khi script
 * >~2KB. Luôn ghi ra temp file rồi dùng `-File` để tránh bug này.
 */
async function runPwshScriptInline(
  script: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const path = join(tmpdir(), `lap-hw-${randomBytes(6).toString("hex")}.ps1`);
  await fs.writeFile(path, script, "utf8");
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path],
      { windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    let settled = false;
    const cleanup = () => {
      fs.unlink(path).catch(() => {});
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch {}
      cleanup();
      reject(new Error(`PowerShell timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve({ stdout, stderr, exitCode: typeof code === "number" ? code : -1 });
    });
  });
}

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

export type MemoryModule = {
  /** Slot label từ WMI (vd: "DIMM_A1", "BANK 0") */
  slot: string | null;
  /** Số bytes của DIMM */
  sizeBytes: number | null;
  /** = sizeBytes / 1073741824 (làm tròn 1 chữ số) */
  capacityGB: number | null;
  /** Tốc độ công bố (Speed) — MT/s */
  speedMhz: number | null;
  /** Tốc độ hiện đang chạy (ConfiguredClockSpeed) — MT/s */
  configuredMhz: number | null;
  /** Tốc độ từ SMBIOS Type 17 (max theo JEDEC) */
  smbiosSpeedMhz: number | null;
  /** Tốc độ tối đa theo CPU/platform cho thế hệ RAM này */
  platformMaxMhz: number | null;
  /** FormFactor enum đã map sang tên (vd: "SODIMM", "DIMM") */
  formFactor: string | null;
  /** MemoryType enum đã map sang tên (vd: "DDR4", "DDR5") */
  memoryType: string | null;
  /** Loại RAM (giữ legacy cho renderer cũ) — bằng memoryType */
  type: string | null;
  /** Thế hệ RAM (giữ legacy) — bằng memoryType */
  generation: string | null;
  /** Manufacturer đã trim null bytes */
  manufacturer: string | null;
  /** PartNumber đã trim null bytes */
  partNumber: string | null;
  /** SerialNumber đã trim */
  serialNumber: string | null;
  /** BankLabel (vd: "BANK 0") */
  bankLabel: string | null;
  /** DeviceLocator (vd: "DIMM_A1") */
  deviceLocator: string | null;
  /** Điện áp (V) — chia ConfiguredVoltage (mV) cho 1000 */
  voltageV: number | null;
  /** = voltageV * 1000 — legacy */
  voltageMv: number | null;
  /** Số rank (1 = single rank, 2 = dual rank) */
  rank: number | null;
  /** CAS latency (nếu đọc được từ SPD) */
  clTiming: string | null;
};

/**
 * Thông tin gọn cho từng thanh RAM — schema mới (preferred) cho Dashboard
 * flip-card và các consumer mới. Trường "sticks" trong `MemoryInfo` dùng
 * type này. Schema cũ `MemoryModule[]` (modules) vẫn được giữ để không vỡ
 * HardwareTab / các chỗ đã build sẵn.
 */
export type RamStickInfo = {
  /** Slot label (DeviceLocator) — vd: "DIMM_A1", "BANK 0", "SODIMM1" */
  slot: string | null;
  /** BankLabel từ WMI — vd: "BANK 0" */
  bankLabel: string | null;
  /** Manufacturer đã trim null bytes (Samsung, SK hynix, Kingston…) */
  manufacturer: string | null;
  /** PartNumber đã trim null bytes (model của thanh RAM) */
  partNumber: string | null;
  /** SerialNumber đã trim */
  serial: string | null;
  /** Dung lượng GB (làm tròn 0 chữ số) */
  capacityGB: number;
  /** Tốc độ công bố (MT/s) */
  speedMTs: number | null;
  /** Thế hệ RAM (DDR3/DDR4/DDR5/Unknown) — đã normalize */
  memoryType: string | null;
  /** FormFactor (DIMM/SODIMM/MicroDIMM/RIMM/Other) */
  formFactor: string | null;
  /** Điện áp (V) — null nếu BIOS không trả */
  voltageV: number | null;
};

export type MemoryInfo = {
  // ── New (preferred) fields ──
  /** Tổng dung lượng (GB) tính từ tổng DIMM (làm tròn 1 chữ số) */
  totalGB: number | null;
  /** = totalGB * 1073741824 — legacy alias */
  totalBytes: number | null;
  /** Tổng từ Win32_ComputerSystem.TotalPhysicalMemory (GB) — dùng để cross-check */
  csTotalGB: number | null;
  /** = csTotalGB * 1073741824 */
  csTotalBytes: number | null;
  /** Used bytes (từ Win32_OperatingSystem.TotalVisible - Free) — có thể null nếu không đọc được */
  usedBytes: number | null;
  /** Free bytes (từ Win32_OperatingSystem.FreePhysicalMemory * 1024) */
  freeBytes: number | null;
  /** Used GB (derived, làm tròn 1 chữ số) */
  usedGB: number | null;
  /** Free GB (derived) */
  freeGB: number | null;
  /** % used (0-100, 1 chữ số) */
  usedPercent: number | null;
  /** Số DIMM thực sự đang cắm */
  dimmCount: number;
  /** = dimmCount — legacy */
  slots: number | null;
  /** Tổng số slot vật lý trên mainboard (từ Win32_PhysicalMemoryArray.MemoryDevices) */
  totalSlots: number | null;
  /** = totalSlots - dimmCount */
  freeSlots: number | null;
  /** Thế hệ RAM phổ biến nhất (vd: "DDR4", "DDR5") */
  memoryType: string | null;
  /** Tốc độ max (MT/s) trong tất cả DIMM */
  maxSpeedMhz: number | null;
  /** Tốc độ tối đa theo CPU/platform cho thế hệ RAM đang dùng */
  platformMaxMhz: number | null;
  /** Tên CPU dùng để derive platformMaxMhz (debug) */
  platformCpuName: string | null;
  /** Chi tiết từng DIMM (schema cũ — MemoryModule[]) */
  modules: MemoryModule[];
  /** Chi tiết từng thanh RAM (schema mới — preferred) cho Dashboard flip-card */
  sticks: RamStickInfo[];
};

export type DiskInfo = {
  // ── New (preferred) fields — luôn được set từ Get-PhysicalDisk/Get-Disk/Get-Volume ──
  /** Model ổ đĩa (ví dụ: "Samsung SSD 970 EVO Plus 500GB") */
  model: string | null;
  /** MediaType: "SSD" | "HDD" | "Unspecified" (đã map enum int → string) */
  mediaType: string | null;
  /** BusType: "NVMe" | "SATA" | "SAS" | "USB" | "RAID" (đã map enum int → string) */
  busType: string | null;
  /** Serial number từ Get-Disk (đã trim null bytes) */
  serial: string | null;
  /** Firmware revision từ Get-Disk (đã trim null bytes) */
  firmware: string | null;
  /** Tình trạng sức khỏe: "Healthy" | "Warning" | "Unhealthy" | "Unknown"
   *  — kết hợp OperationalStatus (Get-PhysicalDisk) + HealthStatus (ReliabilityCounter) */
  health: "Healthy" | "Warning" | "Unhealthy" | "Unknown" | string | null;
  /** Raw health string để debug: "Healthy/healthy" hoặc "Warning/warning" */
  healthRaw: string | null;
  /** Nhiệt độ ổ đĩa (°C) — từ Get-StorageReliabilityCounter */
  tempC: number | null;
  /** Wear level (%) — từ Get-StorageReliabilityCounter */
  wearPct: number | null;
  /** Tổng số giờ đã bật (hours) — từ Get-StorageReliabilityCounter */
  powerOnHours: number | null;
  /** Tổng dung lượng (GB, chia cho 1073741824, làm tròn 1 chữ số) */
  totalGB: number;
  /** Dung lượng trống (GB) */
  freeGB: number;
  /** Phần trăm sử dụng (0–100) — dùng để tô màu progress bar */
  usedPercent: number;
  /** Ký tự ổ đĩa, không bao gồm dấu ":" (ví dụ: "C", "D") */
  driveLetter: string | null;
  /** Nhãn volume (ví dụ: "Windows", "Data") */
  label: string | null;
  /** Interface từ Win32_DiskDrive (fallback cho disk không có qua Get-PhysicalDisk) */
  interfaceType: string | null;

  // ── Legacy aliases (giữ để tương thích HardwareTab cũ) ──
  /** = model */
  name?: string | null;
  /** Chuỗi kết hợp mediaType + busType (ví dụ: "NVMe SSD") */
  type?: string | null;
  /** = totalGB, làm tròn xuống (legacy) */
  capacityGb?: number | null;
  /** = freeGB, làm tròn xuống (legacy) */
  freeGb?: number | null;
  /** Legacy alias cho tempC — luôn = tempC */
  tempC_legacy?: number | null;
  /** = health */
  healthStatus?: string | null;
  /** = mediaType (raw) */
  mediaTypeRaw?: string | null;
  /** = busType (raw) */
  interfaceTypeRaw?: string | null;
  /** = serial */
  serialNumber?: string | null;
  /** = firmware */
  firmwareRevision?: string | null;
};

export type GpuInfo = {
  // ── Preferred fields ──
  /** Tên adapter — đã trim null bytes / khoảng trắng */
  name: string | null;
  /** Manufacturer (WMI AdapterCompatibility) */
  manufacturer: string | null;
  /** VRAM (GB), làm tròn 1 chữ số (bytes → GB hoặc MB → GB theo ngưỡng 4GB) */
  adapterRAMGB: number | null;
  /** Driver version (WMI DriverVersion, fallback registry) */
  driverVersion: string | null;
  /** Ngày driver (raw WMI DriverDate) */
  driverDate: string | null;
  /** WMI VideoModeDescription (ví dụ: "1920 x 1080 x 4294967296 màu") */
  videoModeDesc: string | null;
  /** Refresh rate hiện tại (Hz) — đã ép int */
  refreshRateHz: number | null;
  /** Tần số quét TỐI ĐA màn hình chính (Hz) — từ EnumDisplaySettings */
  maxRefreshRateHz: number | null;
  /** Độ phân giải TỐI ĐA màn hình chính (WxH) — từ EnumDisplaySettings */
  maxResolution: string | null;
  /** Công suất TDP tối đa (W) — từ bảng lookup theo tên model */
  tdpW: number | null;
  /** true nếu là card rời (NVIDIA/AMD/Arc rời) */
  isDiscrete: boolean;
  /** true nếu là card onboard (Intel UHD/Iris/AMD APU Vega) */
  isIntegrated: boolean;
  /** Phân loại rõ ràng: Discrete | Integrated | Unknown */
  type: "Discrete" | "Integrated" | "Unknown";
  /** WMI Status (OK/Degraded/...) */
  status: string | null;
  /** PNPDeviceID (debug) */
  pnpDeviceId: string | null;

  // ── Legacy aliases (giữ cho code cũ) ──
  /** = name (legacy) */
  model?: string;
  /** VRAM (GB) — giữ alias */
  vramGb?: number;
  /** VRAM (MB) — giữ alias cho renderer cũ */
  vramMb?: number | null;
  /** VRAM chia sẻ từ system RAM (MB) — iGPU */
  vramSharedMb?: number | null;
  /** Loại VRAM (DDR5/GDDR6) — heuristic theo tên */
  vramType?: string | null;
  /** Bus width (bit) */
  busWidth?: number | null;
  /** Số compute unit / CUDA core */
  computeUnits?: number | null;
  /** Vendor phát hiện: "NVIDIA" | "AMD" | "Intel" | "Unknown" */
  vendor?: string | null;
  /** Raw VideoProcessor từ WMI */
  videoProcessor?: string | null;
  /** Resolution màn hình chính, ví dụ "1920x1080" */
  resolution?: string | null;
  /** Công suất tối đa thực tế (W) — NVIDIA lấy từ nvidia-smi */
  maxPowerW?: number | null;
  /** Alias của tdpW (legacy) */
  powerW?: number | null;
  /** true nếu đang drive màn hình chính */
  primary?: boolean;
  /** Raw AdapterRAM từ WMI */
  adapterRAM?: number | null;
  /** Alias cho driverVersion (legacy) */
  pnPDeviceId?: string | null;
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

# Get-CimInstance trả về các trường CIM_DATETIME (InstallDate, LastBootUpTime, ReleaseDate, DriverDate...)
# đã là [DateTime] chứ không phải string. Helper này xử lý cả 2 để tránh crash.
function Convert-WmiDate([object]$val, [string]$fmt = 'yyyy-MM-dd') {
  if (-not $val) { return $null }
  try {
    if ($val -is [DateTime]) { return $val.ToString($fmt) }
    return ([Management.ManagementDateTimeConverter]::ToDateTime([string]$val)).ToString($fmt)
  } catch { return $null }
}

function Out-Part([string]$key, $value) {
  # PowerShell ConvertTo-Json wrap array thành {value:[...]}, serialize riêng.
  if ($null -eq $value) {
    [Console]::Out.WriteLine('{"key":"' + $key + '","ok":true,"data":null}')
  } else {
    $dataJson = $value | ConvertTo-Json -Depth 10 -Compress
    [Console]::Out.WriteLine('{"key":"' + $key + '","ok":true,"data":' + $dataJson + '}')
  }
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
    # processNm (lithography): WMI không expose trực tiếp. Tính heuristic theo CPU generation.
    # Intel: 14nm cho gen 4-10 (Skylake trở về trước Comet Lake), 10nm cho gen 10 (Ice Lake),
    #        "Intel 7" (10nm) cho gen 12+ (Alder Lake trở đi).
    # AMD: 7nm cho Zen 2/3 (Ryzen 3000/5000), 5nm cho Zen 4 (Ryzen 7000), 12nm cho Zen+ (Ryzen 2000).
    $processNm = $null
    if ($result['name']) {
      $nm = ([string]$result['name']).ToLower()
      if ($nm -match 'ryzen') {
        if ($nm -match 'ryzen.*[3579]\s*7[0-9]{3}') { $processNm = 5 }   # Zen 4
        elseif ($nm -match 'ryzen.*[357]\s*[5-9][0-9]{2}') { $processNm = 7 }  # Zen 2/3
        elseif ($nm -match 'ryzen.*[357]\s*[2-4][0-9]{2}') { $processNm = 12 } # Zen/Zen+
        else { $processNm = 7 }
      } elseif ($nm -match 'intel') {
        if ($nm -match 'i[3579].*1[2-9]') { $processNm = 10 }      # Alder Lake+ (Intel 7)
        elseif ($nm -match 'i[3579].*1[0-1]') { $processNm = 10 }  # Tiger/Ice Lake
        elseif ($nm -match 'i[3579].*10') { $processNm = 14 }       # Comet Lake
        elseif ($nm -match 'i[3579].*[89]') { $processNm = 14 }     # Coffee/Whiskey Lake
        elseif ($nm -match 'i[3579].*[67]') { $processNm = 14 }     # Skylake/Kaby
        elseif ($nm -match 'i[3579].*[45]') { $processNm = 14 }     # Haswell/Broadwell
        elseif ($nm -match 'i[3579].*[23]') { $processNm = 22 }     # Ivy/Sandy
        else { $processNm = 14 }
      }
    }
    $result['processNm'] = $processNm
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
  if (-not $raw) { return $null }
  $r = $raw.Trim()
  if ($r -eq '') { return $null }
  $low = $r.ToLower()
  # WMI thường trả "Unknown", "Default String" hoặc OEM placeholder
  if ($low -eq 'unknown' -or $low -eq 'no enclosure' -or $low -eq 'default string' -or $low -eq 'to be filled by o.e.m.' -or $low -match '^0x[0-9a-f]+$') {
    return $null
  }
  # Vendor ID hex dạng 0xXXXX (rất hiếm từ WMI nhưng SPD đôi khi trả)
  if ($low -match '^0x[0-9a-f]{4,8}$') {
    $hex = $low.Substring(2)
    switch ($hex.ToLower()) {
      '802c' { return 'Micron' }
      '80ad' { return 'SK hynix' }
      '80ce' { return 'Samsung' }
      '859b' { return 'Crucial' }
      '04cd' { return 'Transcend' }
      '014f' { return 'Transcend' }
      '029e' { return 'Corsair' }
      '04cb' { return 'ADATA' }
      '0215' { return 'Corsair' }
      '0198' { return 'HyperX' }
      '0420' { return 'Nanya' }
      '1315' { return 'PNY' }
      '867f' { return 'Kingston' }
      default { return $r }
    }
  }
  # Text matching
  if ($low -match 'micron') { return 'Micron' }
  if ($low -match 'crucial') { return 'Crucial' }
  if ($low -match 'sk.*hynix|hynix') { return 'SK hynix' }
  if ($low -match 'samsung') { return 'Samsung' }
  if ($low -match 'kingston') { return 'Kingston' }
  if ($low -match 'corsair') { return 'Corsair' }
  if ($low -match 'g\.?skill|gskill') { return 'G.Skill' }
  if ($low -match 'hyperx') { return 'HyperX (Kingston)' }
  if ($low -match 'adata|a-data') { return 'ADATA' }
  if ($low -match 'team.*group|teamgroup') { return 'Team Group' }
  if ($low -match 'patriot') { return 'Patriot' }
  if ($low -match 'mushkin') { return 'Mushkin' }
  if ($low -match 'pny') { return 'PNY' }
  if ($low -match 'transcend') { return 'Transcend' }
  if ($low -match 'kingmax') { return 'Kingmax' }
  if ($low -match 'apacer') { return 'Apacer' }
  if ($low -match 'geil') { return 'GeIL' }
  if ($low -match 'nanya') { return 'Nanya' }
  if ($low -match 'elpida') { return 'Elpida' }
  if ($low -match 'ramaxel') { return 'Ramaxel' }
  if ($low -match 'goodram') { return 'GoodRAM' }
  if ($low -match 'lexar') { return 'Lexar' }
  return $r
}

function Get-SmbiosType17Max {
  $result = New-Object System.Collections.Generic.List[object]
  try {
    $smbios = Get-CimInstance -Namespace 'root\wmi' -ClassName MSSmBios_RawSMBiosTables -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $smbios -or -not $smbios.SMBiosData) { return ,$result.ToArray() }
    $b = [byte[]]$smbios.SMBiosData
    $end = $b.Length

    # QUAN TRỌNG: Windows trả SMBIOS dùng format string-set NULL-TERMINATED
    # (không phải length-prefixed như spec gốc). Format thực tế:
    #   [body_length_bytes]\0[str1_chars]\0[str2_chars]\0...\0\0
    # Mỗi string kết thúc bằng 1 byte \0, string-set kết thúc bằng \0\0.
    # Spec DSP0134 của SMBIOS chính thức dùng length-prefixed; nếu từng parse
    # sai dẫn đến deviceLocator/partNumber/manufacturer đều rỗng → speedMhz
    # WMI fallback về 0 cho DDR5 mới → renderer hiển thị "—" cho bus.
    $script:GetSmbiosString = {
      param([int]$strStart, [int]$idx)
      if ($idx -le 0) { return '' }
      $si = $strStart
      $currentStr = ''
      $strNum = 0
      while ($si -lt $end) {
        $c = $b[$si]
        if ($c -eq 0) {
          # Single \0 = kết thúc 1 string; \0\0 = kết thúc string-set.
          if (($si + 1) -lt $end -and $b[$si+1] -eq 0) { break }
          $strNum++
          if ($strNum -eq $idx) { return $currentStr.Trim() }
          $currentStr = ''
          $si++
          continue
        }
        $currentStr += [char]$c
        $si++
      }
      return ''
    }

    $i = 0
    while ($i -lt $end - 1) {
      $t = $b[$i]
      $len = $b[$i+1]
      if ($len -lt 4 -or $len -gt 256 -or $t -eq 127) { break }
      if ($t -eq 17) {
        $rec = @{}
        # SMBIOS Type 17 layout (theo SMBIOS 2.8+):
        #   Offset 12-13: Size (bit 15 → dùng Extended Size ở 29-32)
        #   Offset 18: Memory Type enum
        #   Offset 21-22: Speed (MT/s, JEDEC tối đa)
        #   Offset 33-34: Configured Clock Speed (SMBIOS 2.8+, length >= 35)
        if ($i+13 -lt $end) {
          $sizeRaw = [int]([uint16]($b[$i+12] + ($b[$i+13]*256)))
          if (($sizeRaw -band 0x8000) -ne 0) {
            if ($i+32 -lt $end - 3 -and $len -ge 28) {
              $ext = [int64]([uint32]($b[$i+29] + ($b[$i+30]*256) + ($b[$i+31]*65536) + ($b[$i+32]*16777216)))
              $rec['sizeMb'] = $ext
            } else {
              $rec['sizeMb'] = ($sizeRaw -band 0x7FFF) * 1024
            }
          } else {
            $rec['sizeMb'] = $sizeRaw
          }
        }
        if ($i+22 -lt $end) { $rec['speed'] = [int]([uint16]($b[$i+21] + ($b[$i+22]*256))) }
        if ($len -ge 35 -and ($i+34) -lt $end) { $rec['configuredClock'] = [int]([uint16]($b[$i+33] + ($b[$i+34]*256))) }
        $rec['memoryTypeEnum'] = if ($i+18 -lt $end) { [int]$b[$i+18] } else { 0 }
        if ($i+11 -lt $end) {
          $rec['totalWidth'] = [int]([uint16]($b[$i+8] + ($b[$i+9]*256)))
          $rec['dataWidth']  = [int]([uint16]($b[$i+10] + ($b[$i+11]*256)))
        }

        # String-set bắt đầu ở $i + $len. Đọc theo index tương ứng:
        #   16 = Device Locator, 17 = Bank Locator, 23 = Manufacturer,
        #   24 = Serial Number, 26 = Part Number.
        $strStart = $i + $len
        if ($strStart -lt $end) {
          $rec['deviceLocator'] = (& $script:GetSmbiosString $strStart ([int]$b[$i+16]))
          $rec['bankLabel']     = (& $script:GetSmbiosString $strStart ([int]$b[$i+17]))
          $rec['manufacturer']  = (& $script:GetSmbiosString $strStart ([int]$b[$i+23]))
          $rec['serialNumber']  = (& $script:GetSmbiosString $strStart ([int]$b[$i+24]))
          $rec['assetTag']      = (& $script:GetSmbiosString $strStart ([int]$b[$i+25]))
          $rec['partNumber']    = (& $script:GetSmbiosString $strStart ([int]$b[$i+26]))
        } else {
          $rec['deviceLocator'] = ''; $rec['bankLabel'] = ''
          $rec['manufacturer'] = ''; $rec['serialNumber'] = ''
          $rec['assetTag'] = ''; $rec['partNumber'] = ''
        }

        $result.Add($rec) | Out-Null
      }
      # Advance: skip body ($len bytes), rồi skip string-set cho tới gặp \0\0.
      $i += $len
      while ($i -lt $end - 1) {
        if ($b[$i] -eq 0 -and $b[$i+1] -eq 0) { $i += 2; break }
        $i++
      }
    }
  } catch {}
  return ,$result.ToArray()
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
# Memory helpers — top-level scope để dùng được từ mọi section
# ══════════════════════════════════════════════════════════════
function Trim-WmiString {
  param([string]$raw)
  if (-not $raw) { return $null }
  $s = $raw.Trim().Trim([char]0).Trim()
  if ($s -eq '') { return $null }
  return $s
}

# Map FormFactor enum → tên
$script:MemFFMap = @{
  0='Unknown'; 1='Other'; 2='SIP'; 3='DIP'; 4='ZIP'; 5='SOJ'; 6='Proprietary';
  7='SIMM'; 8='DIMM'; 9='TSOP'; 10='RIMM'; 11='SODIMM'; 12='SRIMM'; 13='FB-DIMM'
}

# Map MemoryType enum → tên thế hệ RAM
# (giá trị DDR5 27/28 do BIOS/WMI chưa chuẩn hoá — tuỳ hãng trả 0 hoặc 26)
$script:MemTypeMap = @{
  0='Unknown'; 1='Other'; 2='DRAM'; 3='SDRAM';
  17='DDR'; 18='DDR';
  20='DDR'; 21='DDR2'; 22='DDR2-FB-DIMM';
  24='DDR3'; 25='FBD2'; 26='DDR4';
  27='DDR5'; 28='DDR5'; 29='DDR5';
  30='DDR4'; 31='DDR5'; 32='DDR5'; 33='DDR5'; 34='DDR5'; 35='DDR5'; 36='DDR5'
}

function Get-MemGeneration {
  param([int]$memType, [int]$speedMhz)
  $name = if ($script:MemTypeMap.ContainsKey($memType)) { $script:MemTypeMap[$memType] } else { 'Unknown' }
  if ($name -ne 'Unknown' -and $name -ne 'Other') { return $name }
  # Fallback theo tốc độ (DDR5 thường >= 4000, DDR4 1600-3200, DDR3 800-2133)
  if ($speedMhz -ge 4000) { return 'DDR5' }
  if ($speedMhz -ge 1600) { return 'DDR4' }
  if ($speedMhz -ge 800)  { return 'DDR3' }
  if ($speedMhz -ge 400)  { return 'DDR2' }
  if ($speedMhz -gt 0)    { return 'DDR' }
  return 'Unknown'
}

function Get-MemFormFactor {
  param([int]$ff)
  if ($script:MemFFMap.ContainsKey($ff)) { return $script:MemFFMap[$ff] }
  return 'Unknown'
}

function Get-MemRank {
  param([int]$r)
  # 0 = Unknown, 1 = Single, 2 = Dual, 4 = Quad, 8 = Octal
  switch ($r) {
    1 { return 1 } 2 { return 2 } 4 { return 4 } 8 { return 8 }
    default { return $null }
  }
}

# ══════════════════════════════════════════════════════════════
# GPU — Win32_VideoController + nvidia-smi + Registry + Resolution
#
# Sửa các bug hay gặp:
#   1. AdapterRAM đôi khi bytes, đôi khi MB → detect theo ngưỡng 4GB.
#   2. Name có thể chứa null bytes ("NVIDIA\\0\\0...") → trim.
#   3. DriverVersion từ WMI rỗng → fallback registry.
#   4. Chỉ lấy 1 GPU đầu → lấy TẤT CẢ, đánh dấu primary/secondary.
#   5. Vendor detection từ Name + VideoProcessor (NVIDIA/AMD/Intel).
#   6. Công suất tối đa (W):
#        - NVIDIA: parse từ \`nvidia-smi --query-gpu=power.max_limit\` (cần driver NVIDIA).
#        - AMD: thử WMI \`root\\WMI\` \`ATIPMD_Status\` (thường fail trên consumer) → null.
#        - Intel: không có cách public → null (frontend hiển thị "Không hỗ trợ").
#   7. Resolution màn hình chính: System.Windows.Forms.Screen (cần STA).
#      Bọc try/catch + skip trên non-STA hoặc ExecutionPolicy chặn Add-Type.
# ══════════════════════════════════════════════════════════════

# Helper: trim null bytes + whitespace từ chuỗi WMI
function Clean-GpuString([string]$raw) {
  if (-not $raw) { return $null }
  $s = [string]$raw
  # Replace null char (\0) and other control chars; trim whitespace.
  $s = $s -replace "\`0", ''
  $s = $s -replace '[\x01-\x08\x0B-\x1F]', ''
  $s = $s.Trim()
  if ($s -eq '') { return $null }
  return $s
}

# Helper: tính VRAM (GB) từ AdapterRAM. AdapterRAM trong WMI đôi khi là bytes,
# đôi khi trả về dưới dạng MB không có đơn vị. Heuristic:
#   - Nếu > 4GB ≈ 4294967296 → đã là bytes.
#   - Ngược lại: chia cho 1MB (1048576) → MB → chia 1024 → GB.
#   - Nếu kết quả < 1GB thì thử lại: chia bytes → bytes.
#   - Safety cap 64GB (vì thực tế không có GPU consumer > 32GB vào 2025).
function Convert-AdapterRamToGB([int64]$ram) {
  if ($ram -le 0) { return $null }
  $fourGB = [int64]4294967296
  $oneMB  = [int64]1048576
  if ($ram -gt $fourGB) {
    # Bytes
    $gb = [double]$ram / 1073741824.0
  } else {
    # MB không đơn vị
    $gb = ([double]$ram / $oneMB) / 1024.0
    # Nếu < 1GB → có thể là bytes rất nhỏ, thử lại
    if ($gb -lt 1.0) {
      $gb = [double]$ram / 1073741824.0
    }
  }
  if ($gb -gt 64) {
    # Safety: fallback về bytes nếu quá lớn
    $gb = [double]$ram / 1073741824.0
  }
  return [math]::Round($gb, 1)
}

function Convert-AdapterRamToMB([int64]$ram) {
  if ($ram -le 0) { return $null }
  # Ngưỡng = Int32.MaxValue = 2147483647 (~2GB). Nếu lớn hơn → chắc chắn là bytes.
  # Vì WMI có thể trả 4GB (4293918720 bytes) mà vẫn < 4GB ngưỡng cũ (4294967296),
  # dẫn đến cast [int] gây overflow.
  $int32Max = [int64]2147483647
  if ($ram -gt $int32Max) {
    return [int][math]::Round([double]$ram / 1048576.0)
  } else {
    return [int]$ram
  }
}

# ============================================================================
# VRAM detection -- fix bug WMI AdapterRAM overflow tren card >= 8GB.
#
# Microsoft Win32_VideoController.AdapterRAM la UInt32. Voi card 8GB+ thuc te,
# WMI thuong tra gia tri "gan Int32.MaxValue" (vd RTX 2070 SUPER 8GB = 4293918720
# ~ 4GB-1MB) do 32-bit overflow. Heuristic cu Convert-AdapterRamToGB hieu
# day la MB khong don vi -> tra 4.0 GB (sai).
#
# Cach fix: uu tien doc tu nguon 64-bit.
#   1. Registry HardwareInformation.qwMemorySize (bytes, 64-bit) -
#      chinh xac nhat, co tren moi GPU driver chuan.
#   2. nvidia-smi --query-gpu=memory.total (MiB) - fallback cho NVIDIA.
#   3. WMI AdapterRAM voi detection overflow - fallback cuoi.
# ============================================================================
function Get-GpuVramBytesFromRegistry([string]$pnpDevId) {
  if (-not $pnpDevId) { return $null }
  try {
    # Normalize PNP ID: remove ALL backslashes so "PCI\\VEN_10DE..." matches "PCI\VEN_10DE...".
    $normPnp = $pnpDevId.Replace('\', '')
    $hwPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\"
    $subkeys = @(Get-ChildItem -Path $hwPath -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^[0-9]{4}$' })
    foreach ($sk in $subkeys) {
      $reg = Get-ItemProperty -Path $sk.PSPath -ErrorAction SilentlyContinue
      if (-not $reg -or -not $reg.MatchingDeviceId) { continue }
      $matchId = [string]$reg.MatchingDeviceId
      # Match theo prefix (PNP ID thuong co sub-vendor ID phia sau registry MatchingDeviceId).
      # Vi du PNP = PCI\VEN_10DE_and_DEV_1E04_and_SUBSYS_119D1043
      # registry MatchingDeviceId = PCI\VEN_10DE_and_DEV_1E04
      $normMatch = $matchId.Replace('\', '')
      if ($normPnp.StartsWith($normMatch, [StringComparison]::OrdinalIgnoreCase)) {
        # Uu tien qwMemorySize (64-bit, bytes - dung cho moi dung luong).
        if ($null -ne $reg.'HardwareInformation.qwMemorySize') {
          $v = [int64]$reg.'HardwareInformation.qwMemorySize'
          # Sanity: VRAM consumer GPU tu 256MB den 64GB.
          if ($v -ge 268435456 -and $v -le 68719476736) { return $v }
        }
        # Fallback: MemorySize (32-bit, co the overflow tren card >= 4GB).
        if ($null -ne $reg.MemorySize -and $reg.MemorySize -gt 0) {
          $v = [int64]$reg.MemorySize
          if ($v -ge 268435456 -and $v -le 68719476736) { return $v }
        }
      }
    }
  } catch {}
  return $null
}

function Get-NvidiaSmiVramBytes([string]$targetName) {
  $exe = $null
  try {
    $exe = (Get-Command 'nvidia-smi.exe' -ErrorAction Stop).Source
  } catch {
    try { $exe = (Get-Command 'nvidia-smi' -ErrorAction Stop).Source }
    catch { return $null }
  }
  if (-not $exe) { return $null }
  try {
    # memory.total mặc định trả MiB (mebibytes, = 1048576 bytes).
    $out = & $exe --query-gpu=index,name,memory.total --format=csv,noheader,nounits 2>$null
    if (-not $out) { return $null }
    foreach ($line in $out) {
      $parts = $line -split ','
      if ($parts.Count -lt 3) { continue }
      $gpuName = ($parts[1]).Trim()
      $mbStr   = ($parts[2]).Trim()
      # Match theo tên nếu có
      if ($targetName -and $gpuName -and $targetName.Trim() -eq $gpuName) {
        $mb = 0.0
        if ([double]::TryParse($mbStr, [ref]$mb) -and $mb -gt 0) { return [int64]([math]::Round($mb * 1048576)) }
      }
    }
    # Fallback: lấy GPU đầu
    if ($out.Count -gt 0) {
      $first = ($out[0]) -split ','
      if ($first.Count -ge 3) {
        $mb = 0.0
        if ([double]::TryParse(($first[2]).Trim(), [ref]$mb) -and $mb -gt 0) { return [int64]([math]::Round($mb * 1048576)) }
      }
    }
  } catch {}
  return $null
}

# Detect VRAM với fallback chain: registry → nvidia-smi → WMI heuristic
# Returns: bytes (int64), hoặc 0 nếu không xác định được.
function Get-GpuVramBytes([string]$pnpDevId, [string]$name, [string]$vendor, [int64]$wmiAdapterRam) {
  # 0. iGPU (Intel UHD/Iris/Xe onboard, AMD APU Graphics) không có VRAM riêng.
  #    WMI AdapterRAM trả về shared memory allocation (vd 2GB), không phải VRAM thật.
  #    Trả về -1 để caller biết không nên dùng WMI fallback.
  if ($name) {
    $nmIgpu = $name.ToLower()
    $isApu = ($nmIgpu -match 'radeon.*(graphics|vega|\d+m)') -and ($vendor -eq 'AMD' -or $nmIgpu -match 'amd')
    $isIntelIgpu = $nmIgpu -match 'intel.*(uhd|iris|hd graphics|arc graphics|xe graphics)' -and $nmIgpu -notmatch 'arc\s*a[3-7]'
    if ($isIntelIgpu -or $isApu) { return -1 }
  }

  # 1. Registry (chính xác nhất, 64-bit)
  $bytes = Get-GpuVramBytesFromRegistry $pnpDevId
  if ($bytes -gt 0) { return $bytes }

  # 2. nvidia-smi (NVIDIA only)
  if ($vendor -eq 'NVIDIA') {
    $bytes = Get-NvidiaSmiVramBytes $name
    if ($bytes -gt 0) { return $bytes }
  }

  # 3. WMI AdapterRAM với overflow detection.
  # WMI thường trả value "gần 4GB" cho card 8GB+ do UInt32 wrap-around.
  # Pattern: AdapterRAM ∈ (Int32.MaxValue - 64MB, UInt32.MaxValue] → suspect overflow.
  # Heuristic: nếu tên chứa số GB đặc trưng (8/12/16/24 GB series), ép theo đó.
  if ($wmiAdapterRam -gt 0) {
    $int32Max = [int64]2147483647
    $suspectRange = [int64]4293918720   # 4GB - 1MB (giá trị overflow thường gặp)
    $upperBound   = [int64]4294967295   # UInt32.MaxValue

    # Trường hợp 1: AdapterRAM > 4GB → chắc chắn bytes
    if ($wmiAdapterRam -gt 4294967296) {
      return $wmiAdapterRam
    }

    # Trường hợp 2: AdapterRAM ∈ [4GB-64MB, 4GB] (UInt32 overflow zone)
    # và tên GPU có pattern rõ ràng 8GB+
    if ($wmiAdapterRam -ge $suspectRange -and $wmiAdapterRam -le $upperBound -and $name) {
      $nm = $name.ToLower()
      # Heuristic tên: RTX 30/40/20 SUPER, RX 6000/7000 thường ≥ 8GB; A770/A750 có 16GB/8GB; Arc B580 12GB.
      if ($nm -match 'rtx\s*30[89]0|rtx\s*30[78]0\s*ti|rtx\s*40[89]0|rtx\s*40[78]0\s*ti|rtx\s*4070\s*ti|rtx\s*2080\s*ti|rtx\s*2070\s*super|rtx\s*2080\s*super|gtx\s*1080\s*ti|rx\s*6[0-9]{3}|rx\s*7[0-9]{3}|arc\s*a770|arc\s*b580') {
        # Lấy dung lượng từ lookup table
        $lut = @{
          'rtx 3090' = 24; 'rtx 3080 ti' = 12; 'rtx 3080' = 10; 'rtx 3070 ti' = 8
          'rtx 3070' = 8; 'rtx 4070 ti' = 12; 'rtx 4080 ti' = 16; 'rtx 4090' = 24
          'rtx 4080' = 16; 'rtx 4070 ti super' = 16; 'rtx 2080 ti' = 11; 'rtx 2080 super' = 8
          'rtx 2070 super' = 8; 'rtx 2080' = 8; 'gtx 1080 ti' = 11
          'rx 7900 xtx' = 24; 'rx 7900 xt' = 20; 'rx 7800 xt' = 16; 'rx 7700 xt' = 12
          'rx 7600' = 8; 'rx 6900 xt' = 16; 'rx 6800 xt' = 16; 'rx 6800' = 16
          'rx 6700 xt' = 12; 'rx 6700' = 10; 'rx 6600 xt' = 8; 'rx 6600' = 8
          'rx 7600 xt' = 16
          'arc a770' = 16; 'arc b580' = 12
        }
        foreach ($k in $lut.Keys) {
          if ($nm -match [regex]::Escape($k)) {
            return [int64]$lut[$k] * 1073741824
          }
        }
      }
    }

    # Trường hợp 3: WMI < 4GB và không match tên nào. Nếu rõ ràng < 1GB khi coi là MB
    # (chia 2 lần) thì giữ nguyên. Ngược lại, tránh multiply lên 2 PB do lỗi - return 0.
    if ($wmiAdapterRam -le 4294967296) {
      $asMb = $wmiAdapterRam
      $asGb = $asMb / 1048576.0 / 1024.0
      if ($asGb -lt 1.0) {
        return $wmiAdapterRam   # treat as bytes (rất nhỏ, vd 256MB card cũ)
      }
      # Có vẻ là MB (1-4GB) nhưng không có trong LUT — không đủ thông tin để chắc chắn.
      # Trả 0 thay vì multiply lên PB gây hiển thị sai.
      return 0
    }
  }
  return 0
}

# Detect vendor từ Name hoặc VideoProcessor. Vendor chuẩn để render badge.
function Get-GpuVendor([string]$name, [string]$vp) {
  $hay = ''
  if ($name) { $hay += $name.ToLower() + ' ' }
  if ($vp)   { $hay += $vp.ToLower() }
  if ($hay -match 'nvidia|gtx|rtx|quadro|tesla|geforce') { return 'NVIDIA' }
  if ($hay -match 'amd|radeon|rx\s?[0-9]|vega|navi|bonaire') { return 'AMD' }
  if ($hay -match 'intel|iris|uhd|hd graphics|arc\s') { return 'Intel' }
  return 'Unknown'
}

# Heuristic loại VRAM theo tên GPU + vendor. WMI không expose trực tiếp trên Windows
# trừ registry NVIDIA (chỉ từ driver mới). Fallback an toàn cho GDDR6 series.
function Guess-VramType([string]$name, [string]$vendor) {
  if (-not $name) { return $null }
  $n = $name.ToLower()
  # RTX 50/40/30 series, RX 7000/6000 — GDDR6/GDDR6X/GDDR7
  if ($vendor -eq 'NVIDIA') {
    if ($n -match 'rtx\s*50') { return 'GDDR7' }
    if ($n -match 'rtx\s*40[89]0|rtx\s*4090') { return 'GDDR6X' }
    if ($n -match 'rtx\s*40[2-7]0') { return 'GDDR6X' }
    if ($n -match 'rtx\s*30[89]0') { return 'GDDR6X' }
    if ($n -match 'rtx\s*30') { return 'GDDR6' }
    if ($n -match 'rtx\s*20[6789]0') { return 'GDDR6' }
    if ($n -match 'gtx\s*16[56]0') { return 'GDDR6' }
    if ($n -match 'gtx\s*10[6789]0|gtx\s*1080') { return 'GDDR5X' }
    return 'GDDR6'
  }
  if ($vendor -eq 'AMD') {
    if ($n -match 'rx\s*7[0-9]{3}') { return 'GDDR6' }
    if ($n -match 'rx\s*6[0-9]{3}') { return 'GDDR6' }
    if ($n -match 'rx\s*5[0-9]{3}|rx\s*vega') { return 'HBM2' }
    if ($n -match 'rx\s?5[0-9]{2}') { return 'GDDR6' }
    return 'GDDR6'
  }
  if ($vendor -eq 'Intel') {
    if ($n -match 'arc\s') { return 'GDDR6' }
    return 'Shared (system RAM)'
  }
  return $null
}

# Lấy wattage tối đa qua nvidia-smi nếu có.
# Returns: [double] hoặc $null.
function Get-NvidiaSmiMaxPower([string]$targetName) {
  $exe = $null
  try {
    $exe = (Get-Command 'nvidia-smi.exe' -ErrorAction Stop).Source
  } catch {
    try {
      $exe = (Get-Command 'nvidia-smi' -ErrorAction Stop).Source
    } catch { return $null }
  }
  if (-not $exe) { return $null }
  try {
    # --query-gpu=power.max_limit trả watt thập phân (vd "150.00 W" hoặc "150W")
    $out = & $exe --query-gpu=index,name,power.max_limit --format=csv,noheader,nounits 2>$null
    if (-not $out) { return $null }
    foreach ($line in $out) {
      $parts = $line -split ','
      if ($parts.Count -lt 3) { continue }
      $gpuName = ($parts[1]).Trim()
      $wStr    = ($parts[2]).Trim()
      # Filter theo tên nếu match
      if ($targetName -and $gpuName -and $targetName.Trim() -eq $gpuName) {
        $w = 0.0
        if ([double]::TryParse($wStr, [ref]$w) -and $w -gt 0) { return $w }
      }
    }
    # Fallback: lấy GPU đầu
    if ($out.Count -gt 0) {
      $first = ($out[0]) -split ','
      if ($first.Count -ge 3) {
        $w = 0.0
        if ([double]::TryParse(($first[2]).Trim(), [ref]$w) -and $w -gt 0) { return $w }
      }
    }
  } catch {}
  return $null
}

# Lấy resolution màn hình chính qua Windows Forms.
# Returns string "WxH" hoặc $null.
function Get-PrimaryScreenResolution {
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    $scr = [System.Windows.Forms.Screen]::PrimaryScreen
    if ($scr -and $scr.Bounds) {
      return "$($scr.Bounds.Width)x$($scr.Bounds.Height)"
    }
  } catch {}
  try {
    # Fallback: WMI Win32_VideoController + Win32_DesktopMonitor (ít chính xác)
    Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
    $primaryW = 0; $primaryH = 0
    $monitors = Get-CimInstance Win32_DesktopMonitor -ErrorAction SilentlyContinue
    foreach ($m in $monitors) {
      if ($m.ScreenWidth -and $m.ScreenHeight) {
        $primaryW = [int]$m.ScreenWidth; $primaryH = [int]$m.ScreenHeight
        break
      }
    }
    if ($primaryW -gt 0 -and $primaryH -gt 0) { return "$primaryW" + "x" + "$primaryH" }
  } catch {}
  return $null
}

# ============================================================================
# Lấy max resolution + max refresh rate qua EnumDisplaySettings (P/Invoke).
# Trả về hashtable: { maxResolution: "WxH", maxRefreshRateHz: int }
# ============================================================================
function Get-MaxDisplaySettings {
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    Add-Type -ReferencedAssemblies System.Windows.Forms @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class DisplayHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct DEVMODE {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string dmDeviceName;
        public ushort dmSpecVersion;
        public ushort dmDriverVersion;
        public ushort dmSize;
        public ushort dmDriverExtra;
        public uint dmFields;
        public int dmPositionX;
        public int dmPositionY;
        public int dmDisplayOrientation;
        public int dmDisplayFixedOutput;
        public short dmColor;
        public short dmDuplex;
        public short dmYResolution;
        public short dmTTOption;
        public short dmCollate;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string dmFormName;
        public ushort dmLogPixels;
        public uint dmBitsPerPel;
        public uint dmPelsWidth;
        public uint dmPelsHeight;
        public uint dmDisplayFlags;
        public uint dmDisplayFrequency;
        public uint dmICMMethod;
        public uint dmICMIntent;
        public uint dmMediaType;
        public uint dmDitherType;
        public uint dmReserved1;
        public uint dmReserved2;
        public uint dmPanningWidth;
        public uint dmPanningHeight;
    }
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern bool EnumDisplaySettings(string deviceName, int modeNum, ref DEVMODE devMode);
    public static string GetMaxResolution() {
        DEVMODE dm = new DEVMODE();
        dm.dmSize = (ushort)Marshal.SizeOf(typeof(DEVMODE));
        int mode = 0; int maxW = 0, maxH = 0;
        while (EnumDisplaySettings(null, mode, ref dm)) {
            int w = (int)dm.dmPelsWidth; int h = (int)dm.dmPelsHeight;
            if (w > maxW || (w == maxW && h > maxH)) { maxW = w; maxH = h; }
            mode++;
        }
        return maxW + "x" + maxH;
    }
    public static int GetMaxRefreshRateAtResolution(int w, int h) {
        DEVMODE dm = new DEVMODE();
        dm.dmSize = (ushort)Marshal.SizeOf(typeof(DEVMODE));
        int mode = 0; int maxHz = 0;
        while (EnumDisplaySettings(null, mode, ref dm)) {
            int cw = (int)dm.dmPelsWidth; int ch = (int)dm.dmPelsHeight; int hz = (int)dm.dmDisplayFrequency;
            if (cw == w && ch == h && hz > maxHz) maxHz = hz;
            mode++;
        }
        return maxHz;
    }
    public static int GetMaxRefreshRateAll() {
        DEVMODE dm = new DEVMODE();
        dm.dmSize = (ushort)Marshal.SizeOf(typeof(DEVMODE));
        int mode = 0; int maxHz = 0;
        while (EnumDisplaySettings(null, mode, ref dm)) {
            int hz = (int)dm.dmDisplayFrequency;
            if (hz > maxHz) maxHz = hz;
            mode++;
        }
        return maxHz;
    }
}
"@
    $curW = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width
    $curH = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height
    $maxRes = [DisplayHelper]::GetMaxResolution()
    $maxHzNative = [DisplayHelper]::GetMaxRefreshRateAtResolution($curW, $curH)
    $maxHzAll    = [DisplayHelper]::GetMaxRefreshRateAll()
    # Dùng maxHzAll vì nó chính xác hơn (bao gồm mọi mode)
    if ($maxHzNative -gt 0) { $maxHz = $maxHzNative } else { $maxHz = $maxHzAll }
    return @{ maxResolution = $maxRes; maxRefreshRateHz = $maxHz }
  } catch {
    return @{ maxResolution = $null; maxRefreshRateHz = $null }
  }
}

# Lấy driver version từ registry NVIDIA/AMD fallback khi WMI rỗng
function Get-GpuDriverFromRegistry([string]$pnpDevId) {
  if (-not $pnpDevId) { return $null }
  try {
    $hwPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\"
    $subkeys = @(Get-ChildItem -Path $hwPath -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^[0-9]{4}$' })
    foreach ($sk in $subkeys) {
      $reg = Get-ItemProperty -Path $sk.PSPath -ErrorAction SilentlyContinue
      if ($reg -and $reg.MatchingDeviceId) {
        $matchId = [string]$reg.MatchingDeviceId
        # So sánh: lấy 20 ký tự đầu của PNP ID (không kể phần "PCI\VEN_")
        $cmp1 = ($pnpDevId -replace '^PCI\\', '').Substring(0, [Math]::Min(20, $pnpDevId.Length - 4))
        $cmp2 = $matchId.Trim()
        if ($cmp2 -and $cmp1.StartsWith($cmp2.Substring(0, [Math]::Min(20, $cmp2.Length)), [StringComparison]::OrdinalIgnoreCase)) {
          if ($reg.DriverVersion) { return ([string]$reg.DriverVersion).Trim() }
        }
      }
    }
  } catch {}
  return $null
}

# Map GPU name → computeUnits + tdpW (giữ nguyên bảng hiện có cho fallback wattage khi không có nvidia-smi)
function Get-GpuSpecsFromName([string]$name) {
  $result = @{ computeUnits = $null; tdpW = $null }
  if (-not $name) { return $result }
  $n = $name.ToLower()

  if ($n -match 'rtx\s*50[89]0') { $result.computeUnits = 21504; $result.tdpW = 575 }
  elseif ($n -match 'rtx\s*50[67]0') { $result.computeUnits = 12800; $result.tdpW = 400 }
  elseif ($n -match 'rtx\s*50[56]0') { $result.computeUnits = 8192;  $result.tdpW = 250 }

  # NVIDIA Desktop RTX 40 series
  elseif ($n -match 'rtx\s*4090') { $result.computeUnits = 16384; $result.tdpW = 450 }
  elseif ($n -match 'rtx\s*4080') { $result.computeUnits = 9728;  $result.tdpW = 320 }
  elseif ($n -match 'rtx\s*4070\s*ti\s*super') { $result.computeUnits = 8448; $result.tdpW = 285 }
  elseif ($n -match 'rtx\s*4070\s*ti') { $result.computeUnits = 7680; $result.tdpW = 285 }
  elseif ($n -match 'rtx\s*4070\s*super') { $result.computeUnits = 7168; $result.tdpW = 220 }
  elseif ($n -match 'rtx\s*4070') { $result.computeUnits = 5888; $result.tdpW = 200 }
  elseif ($n -match 'rtx\s*4060\s*ti') { $result.computeUnits = 4352; $result.tdpW = 165 }
  elseif ($n -match 'rtx\s*4060') { $result.computeUnits = 3072; $result.tdpW = 115 }
  elseif ($n -match 'rtx\s*4050') { $result.computeUnits = 2560; $result.tdpW = 100 }

  # NVIDIA Laptop RTX 40 series
  elseif ($n -match 'rtx\s*4090.*laptop') { $result.computeUnits = 9728; $result.tdpW = 175 }
  elseif ($n -match 'rtx\s*4080.*laptop') { $result.computeUnits = 7424; $result.tdpW = 150 }
  elseif ($n -match 'rtx\s*4070.*laptop') { $result.computeUnits = 4608; $result.tdpW = 140 }
  elseif ($n -match 'rtx\s*4060.*laptop') { $result.computeUnits = 3072; $result.tdpW = 115 }
  elseif ($n -match 'rtx\s*4050.*laptop') { $result.computeUnits = 2560; $result.tdpW = 95 }

  # NVIDIA Desktop RTX 30 series
  elseif ($n -match 'rtx\s*3090\s*ti') { $result.computeUnits = 10752; $result.tdpW = 450 }
  elseif ($n -match 'rtx\s*3090') { $result.computeUnits = 10496; $result.tdpW = 350 }
  elseif ($n -match 'rtx\s*3080\s*ti') { $result.computeUnits = 10240; $result.tdpW = 350 }
  elseif ($n -match 'rtx\s*3080') { $result.computeUnits = 8704;  $result.tdpW = 320 }
  elseif ($n -match 'rtx\s*3070\s*ti') { $result.computeUnits = 6144; $result.tdpW = 290 }
  elseif ($n -match 'rtx\s*3070') { $result.computeUnits = 5888; $result.tdpW = 220 }
  elseif ($n -match 'rtx\s*3060\s*ti') { $result.computeUnits = 4864; $result.tdpW = 200 }
  elseif ($n -match 'rtx\s*3060') { $result.computeUnits = 3584;  $result.tdpW = 170 }
  elseif ($n -match 'rtx\s*3050') { $result.computeUnits = 2560;  $result.tdpW = 130 }

  # NVIDIA Laptop RTX 30 series
  elseif ($n -match 'rtx\s*3080.*laptop') { $result.computeUnits = 6144; $result.tdpW = 165 }
  elseif ($n -match 'rtx\s*3070.*laptop') { $result.computeUnits = 5120; $result.tdpW = 140 }
  elseif ($n -match 'rtx\s*3060.*laptop') { $result.computeUnits = 3840; $result.tdpW = 115 }
  elseif ($n -match 'rtx\s*3050.*laptop|rtx\s*3050\s*ti.*laptop') { $result.computeUnits = 2560; $result.tdpW = 95 }

  # NVIDIA RTX 20 series
  elseif ($n -match 'rtx\s*2080\s*ti') { $result.computeUnits = 4352; $result.tdpW = 260 }
  elseif ($n -match 'rtx\s*2080\s*super') { $result.computeUnits = 3072; $result.tdpW = 250 }
  elseif ($n -match 'rtx\s*2080') { $result.computeUnits = 2944; $result.tdpW = 215 }
  elseif ($n -match 'rtx\s*2070\s*super') { $result.computeUnits = 2560; $result.tdpW = 215 }
  elseif ($n -match 'rtx\s*2070') { $result.computeUnits = 2304; $result.tdpW = 175 }
  elseif ($n -match 'rtx\s*2060\s*super') { $result.computeUnits = 2176; $result.tdpW = 175 }
  elseif ($n -match 'rtx\s*2060') { $result.computeUnits = 1920; $result.tdpW = 160 }

  # NVIDIA GTX 16 series
  elseif ($n -match 'gtx\s*1660\s*ti') { $result.computeUnits = 1536; $result.tdpW = 120 }
  elseif ($n -match 'gtx\s*1660\s*super') { $result.computeUnits = 1408; $result.tdpW = 125 }
  elseif ($n -match 'gtx\s*1660') { $result.computeUnits = 1408; $result.tdpW = 120 }
  elseif ($n -match 'gtx\s*1650\s*super') { $result.computeUnits = 1280; $result.tdpW = 100 }
  elseif ($n -match 'gtx\s*1650') { $result.computeUnits = 896;  $result.tdpW = 75 }
  elseif ($n -match 'gtx\s*1630') { $result.computeUnits = 512;  $result.tdpW = 75 }

  # AMD Radeon RX 7000 series
  elseif ($n -match 'rx\s*7900\s*xtx') { $result.computeUnits = 6144; $result.tdpW = 355 }
  elseif ($n -match 'rx\s*7900\s*xt') { $result.computeUnits = 5376; $result.tdpW = 315 }
  elseif ($n -match 'rx\s*7800\s*xt') { $result.computeUnits = 3840; $result.tdpW = 263 }
  elseif ($n -match 'rx\s*7700\s*xt') { $result.computeUnits = 3456; $result.tdpW = 245 }
  elseif ($n -match 'rx\s*7600\s*xt') { $result.computeUnits = 2048; $result.tdpW = 190 }
  elseif ($n -match 'rx\s*7600') { $result.computeUnits = 2048; $result.tdpW = 165 }

  # AMD Radeon RX 6000 series
  elseif ($n -match 'rx\s*6950\s*xt') { $result.computeUnits = 5120; $result.tdpW = 335 }
  elseif ($n -match 'rx\s*6900\s*xt') { $result.computeUnits = 5120; $result.tdpW = 300 }
  elseif ($n -match 'rx\s*6800\s*xt') { $result.computeUnits = 4608; $result.tdpW = 300 }
  elseif ($n -match 'rx\s*6800') { $result.computeUnits = 3840; $result.tdpW = 250 }
  elseif ($n -match 'rx\s*6750\s*xt') { $result.computeUnits = 2560; $result.tdpW = 250 }
  elseif ($n -match 'rx\s*6700\s*xt') { $result.computeUnits = 2560; $result.tdpW = 230 }
  elseif ($n -match 'rx\s*6700') { $result.computeUnits = 2304; $result.tdpW = 175 }
  elseif ($n -match 'rx\s*6650\s*xt') { $result.computeUnits = 2048; $result.tdpW = 180 }
  elseif ($n -match 'rx\s*6600\s*xt') { $result.computeUnits = 2048; $result.tdpW = 160 }
  elseif ($n -match 'rx\s*6600') { $result.computeUnits = 1792; $result.tdpW = 132 }
  elseif ($n -match 'rx\s*6500\s*xt') { $result.computeUnits = 1024; $result.tdpW = 107 }
  elseif ($n -match 'rx\s*6400') { $result.computeUnits = 768;  $result.tdpW = 53 }

  # AMD Radeon RX 5000 series
  elseif ($n -match 'rx\s*5700\s*xt') { $result.computeUnits = 2560; $result.tdpW = 225 }
  elseif ($n -match 'rx\s*5700') { $result.computeUnits = 2304; $result.tdpW = 180 }
  elseif ($n -match 'rx\s*5600\s*xt') { $result.computeUnits = 2304; $result.tdpW = 150 }
  elseif ($n -match 'rx\s*5500\s*xt') { $result.computeUnits = 1408; $result.tdpW = 130 }

  # Intel Arc
  elseif ($n -match 'arc\s*a770') { $result.computeUnits = 4096; $result.tdpW = 225 }
  elseif ($n -match 'arc\s*a750') { $result.computeUnits = 3584; $result.tdpW = 225 }
  elseif ($n -match 'arc\s*a580') { $result.computeUnits = 3072; $result.tdpW = 185 }
  elseif ($n -match 'arc\s*a380') { $result.computeUnits = 1024; $result.tdpW = 75 }
  elseif ($n -match 'arc\s*a310') { $result.computeUnits = 768;  $result.tdpW = 75 }

  # Intel Integrated Graphics — extended coverage cho các gen Alder/Raptor/Meteor Lake + Arc iGPU
  elseif ($n -match 'intel.*arc\s*graphics') { $result.computeUnits = 128; $result.tdpW = 45 }
  elseif ($n -match 'intel.*uhd.*770|intel.*uhd\s*graphics\s*770') { $result.computeUnits = 256; $result.tdpW = 30 }
  elseif ($n -match 'intel.*uhd.*730') { $result.computeUnits = 192; $result.tdpW = 25 }
  elseif ($n -match 'intel.*uhd.*710') { $result.computeUnits = 128; $result.tdpW = 15 }
  elseif ($n -match 'intel.*uhd.*630|intel.*uhd.*graphics\s*630') { $result.computeUnits = 192; $result.tdpW = 25 }
  elseif ($n -match 'intel.*uhd.*620|intel.*uhd.*graphics\s*620') { $result.computeUnits = 192; $result.tdpW = 15 }
  elseif ($n -match 'intel.*uhd.*610') { $result.computeUnits = 96; $result.tdpW = 15 }
  elseif ($n -match 'intel.*uhd') { $result.computeUnits = 96; $result.tdpW = 15 }
  elseif ($n -match 'intel.*iris.*xe.*graphics|iris\s*xe') { $result.computeUnits = 768; $result.tdpW = 28 }
  elseif ($n -match 'intel.*iris\s*plus') { $result.computeUnits = 384; $result.tdpW = 28 }
  elseif ($n -match 'intel.*iris') { $result.computeUnits = 384; $result.tdpW = 28 }
  elseif ($n -match 'intel.*hd\s*graphics\s*6[0-9]{2}') { $result.computeUnits = 192; $result.tdpW = 25 }
  elseif ($n -match 'intel.*hd\s*graphics\s*5[0-9]{2}') { $result.computeUnits = 96; $result.tdpW = 25 }
  elseif ($n -match 'intel.*hd\s*graphics\s*4[0-9]{2}') { $result.computeUnits = 64; $result.tdpW = 20 }
  elseif ($n -match 'intel.*hd\s*graphics') { $result.computeUnits = 96; $result.tdpW = 25 }
  # AMD Radeon iGPU (Ryzen 7000/8000 APU)
  elseif ($n -match 'radeon\s*780m|radeon\s*760m') { $result.computeUnits = 768; $result.tdpW = 28 }
  elseif ($n -match 'radeon\s*680m|radeon\s*660m') { $result.computeUnits = 384; $result.tdpW = 25 }
  elseif ($n -match 'radeon\s*610m|radeon\s*660m|radeon\s*vega') { $result.computeUnits = 384; $result.tdpW = 25 }
  elseif ($n -match 'radeon.*graphics|vega\s*\d+') { $result.computeUnits = 192; $result.tdpW = 25 }
  # NVIDIA GTX 16 series desktop
  elseif ($n -match 'gtx\s*1660\s*ti') { $result.computeUnits = 1536; $result.tdpW = 120 }
  elseif ($n -match 'gtx\s*1660\s*super') { $result.computeUnits = 1408; $result.tdpW = 125 }
  elseif ($n -match 'gtx\s*1660') { $result.computeUnits = 1408; $result.tdpW = 120 }
  elseif ($n -match 'gtx\s*1650\s*super') { $result.computeUnits = 1280; $result.tdpW = 100 }
  elseif ($n -match 'gtx\s*1650') { $result.computeUnits = 896;  $result.tdpW = 75 }
  elseif ($n -match 'gtx\s*1630') { $result.computeUnits = 512;  $result.tdpW = 75 }
  # NVIDIA RTX 2050 / 3050 Ti (laptop + desktop)
  elseif ($n -match 'rtx\s*2050') { $result.computeUnits = 2048; $result.tdpW = 45 }
  elseif ($n -match 'rtx\s*3050\s*ti') { $result.computeUnits = 2560; $result.tdpW = 130 }
  # NVIDIA RTX 50 series laptop
  elseif ($n -match 'rtx\s*5090.*laptop') { $result.computeUnits = 21760; $result.tdpW = 175 }
  elseif ($n -match 'rtx\s*5080.*laptop') { $result.computeUnits = 13312; $result.tdpW = 150 }
  elseif ($n -match 'rtx\s*5070\s*ti.*laptop') { $result.computeUnits = 8960; $result.tdpW = 140 }
  elseif ($n -match 'rtx\s*5070.*laptop') { $result.computeUnits = 7168; $result.tdpW = 140 }
  elseif ($n -match 'rtx\s*5060.*laptop') { $result.computeUnits = 4608; $result.tdpW = 115 }
  # NVIDIA RTX 50 series desktop
  elseif ($n -match 'rtx\s*50[89]0') { $result.computeUnits = 21504; $result.tdpW = 575 }
  elseif ($n -match 'rtx\s*50[67]0') { $result.computeUnits = 12800; $result.tdpW = 400 }
  elseif ($n -match 'rtx\s*50[56]0') { $result.computeUnits = 8192;  $result.tdpW = 250 }
  # NVIDIA RTX 40 series desktop
  elseif ($n -match 'rtx\s*4090') { $result.computeUnits = 16384; $result.tdpW = 450 }
  elseif ($n -match 'rtx\s*4080\s*super') { $result.computeUnits = 10240; $result.tdpW = 320 }
  elseif ($n -match 'rtx\s*4080') { $result.computeUnits = 9728;  $result.tdpW = 320 }
  elseif ($n -match 'rtx\s*4070\s*ti\s*super') { $result.computeUnits = 8448; $result.tdpW = 285 }
  elseif ($n -match 'rtx\s*4070\s*ti') { $result.computeUnits = 7680; $result.tdpW = 285 }
  elseif ($n -match 'rtx\s*4070\s*super') { $result.computeUnits = 7168; $result.tdpW = 220 }
  elseif ($n -match 'rtx\s*4070') { $result.computeUnits = 5888; $result.tdpW = 200 }
  elseif ($n -match 'rtx\s*4060\s*ti') { $result.computeUnits = 4352; $result.tdpW = 165 }
  elseif ($n -match 'rtx\s*4060') { $result.computeUnits = 3072; $result.tdpW = 115 }
  elseif ($n -match 'rtx\s*4050') { $result.computeUnits = 2560; $result.tdpW = 100 }
  # NVIDIA RTX 40 series laptop
  elseif ($n -match 'rtx\s*4090.*laptop') { $result.computeUnits = 9728; $result.tdpW = 175 }
  elseif ($n -match 'rtx\s*4080.*laptop') { $result.computeUnits = 7424; $result.tdpW = 150 }
  elseif ($n -match 'rtx\s*4070.*laptop') { $result.computeUnits = 4608; $result.tdpW = 140 }
  elseif ($n -match 'rtx\s*4060.*laptop') { $result.computeUnits = 3072; $result.tdpW = 115 }
  elseif ($n -match 'rtx\s*4050.*laptop') { $result.computeUnits = 2560; $result.tdpW = 95 }
  # NVIDIA RTX 30 series desktop
  elseif ($n -match 'rtx\s*3090\s*ti') { $result.computeUnits = 10752; $result.tdpW = 450 }
  elseif ($n -match 'rtx\s*3090') { $result.computeUnits = 10496; $result.tdpW = 350 }
  elseif ($n -match 'rtx\s*3080\s*ti') { $result.computeUnits = 10240; $result.tdpW = 350 }
  elseif ($n -match 'rtx\s*3080') { $result.computeUnits = 8704;  $result.tdpW = 320 }
  elseif ($n -match 'rtx\s*3070\s*ti') { $result.computeUnits = 6144; $result.tdpW = 290 }
  elseif ($n -match 'rtx\s*3070') { $result.computeUnits = 5888; $result.tdpW = 220 }
  elseif ($n -match 'rtx\s*3060\s*ti') { $result.computeUnits = 4864; $result.tdpW = 200 }
  elseif ($n -match 'rtx\s*3060') { $result.computeUnits = 3584;  $result.tdpW = 170 }
  # NVIDIA RTX 30 series laptop
  elseif ($n -match 'rtx\s*3080.*laptop') { $result.computeUnits = 6144; $result.tdpW = 165 }
  elseif ($n -match 'rtx\s*3070.*laptop') { $result.computeUnits = 5120; $result.tdpW = 140 }
  elseif ($n -match 'rtx\s*3060.*laptop') { $result.computeUnits = 3840; $result.tdpW = 115 }
  elseif ($n -match 'rtx\s*3050.*laptop|rtx\s*3050\s*ti.*laptop') { $result.computeUnits = 2560; $result.tdpW = 95 }
  # NVIDIA RTX 20 series
  elseif ($n -match 'rtx\s*2080\s*ti') { $result.computeUnits = 4352; $result.tdpW = 260 }
  elseif ($n -match 'rtx\s*2080\s*super') { $result.computeUnits = 3072; $result.tdpW = 250 }
  elseif ($n -match 'rtx\s*2080') { $result.computeUnits = 2944; $result.tdpW = 215 }
  elseif ($n -match 'rtx\s*2070\s*super') { $result.computeUnits = 2560; $result.tdpW = 215 }
  elseif ($n -match 'rtx\s*2070') { $result.computeUnits = 2304; $result.tdpW = 175 }
  elseif ($n -match 'rtx\s*2060\s*super') { $result.computeUnits = 2176; $result.tdpW = 175 }
  elseif ($n -match 'rtx\s*2060') { $result.computeUnits = 1920; $result.tdpW = 160 }
  # NVIDIA GTX 10 series
  elseif ($n -match 'gtx\s*1080\s*ti') { $result.computeUnits = 3584; $result.tdpW = 250 }
  elseif ($n -match 'gtx\s*1080') { $result.computeUnits = 2560; $result.tdpW = 180 }
  elseif ($n -match 'gtx\s*1070\s*ti') { $result.computeUnits = 2432; $result.tdpW = 180 }
  elseif ($n -match 'gtx\s*1070') { $result.computeUnits = 1920; $result.tdpW = 150 }
  elseif ($n -match 'gtx\s*1060') { $result.computeUnits = 1280; $result.tdpW = 120 }
  elseif ($n -match 'gtx\s*1050\s*ti') { $result.computeUnits = 768; $result.tdpW = 75 }
  elseif ($n -match 'gtx\s*1050') { $result.computeUnits = 640; $result.tdpW = 75 }
  # AMD RX 7000 series
  elseif ($n -match 'rx\s*7900\s*xtx') { $result.computeUnits = 6144; $result.tdpW = 355 }
  elseif ($n -match 'rx\s*7900\s*xt') { $result.computeUnits = 5376; $result.tdpW = 315 }
  elseif ($n -match 'rx\s*7800\s*xt') { $result.computeUnits = 3840; $result.tdpW = 263 }
  elseif ($n -match 'rx\s*7700\s*xt') { $result.computeUnits = 3456; $result.tdpW = 245 }
  elseif ($n -match 'rx\s*7600\s*xt') { $result.computeUnits = 2048; $result.tdpW = 190 }
  elseif ($n -match 'rx\s*7600') { $result.computeUnits = 2048; $result.tdpW = 165 }
  # AMD RX 9000 series (RDNA 4)
  elseif ($n -match 'rx\s*9[0-9]{3}') { $result.computeUnits = 4096; $result.tdpW = 200 }
  # AMD RX 6000 series
  elseif ($n -match 'rx\s*6950\s*xt') { $result.computeUnits = 5120; $result.tdpW = 335 }
  elseif ($n -match 'rx\s*6900\s*xt') { $result.computeUnits = 5120; $result.tdpW = 300 }
  elseif ($n -match 'rx\s*6800\s*xt') { $result.computeUnits = 4608; $result.tdpW = 300 }
  elseif ($n -match 'rx\s*6800') { $result.computeUnits = 3840; $result.tdpW = 250 }
  elseif ($n -match 'rx\s*6750\s*xt') { $result.computeUnits = 2560; $result.tdpW = 250 }
  elseif ($n -match 'rx\s*6700\s*xt') { $result.computeUnits = 2560; $result.tdpW = 230 }
  elseif ($n -match 'rx\s*6700') { $result.computeUnits = 2304; $result.tdpW = 175 }
  elseif ($n -match 'rx\s*6650\s*xt') { $result.computeUnits = 2048; $result.tdpW = 180 }
  elseif ($n -match 'rx\s*6600\s*xt') { $result.computeUnits = 2048; $result.tdpW = 160 }
  elseif ($n -match 'rx\s*6600') { $result.computeUnits = 1792; $result.tdpW = 132 }
  elseif ($n -match 'rx\s*6500\s*xt') { $result.computeUnits = 1024; $result.tdpW = 107 }
  elseif ($n -match 'rx\s*6400') { $result.computeUnits = 768;  $result.tdpW = 53 }
  # AMD RX 5000 series
  elseif ($n -match 'rx\s*5700\s*xt') { $result.computeUnits = 2560; $result.tdpW = 225 }
  elseif ($n -match 'rx\s*5700') { $result.computeUnits = 2304; $result.tdpW = 180 }
  elseif ($n -match 'rx\s*5600\s*xt') { $result.computeUnits = 2304; $result.tdpW = 150 }
  elseif ($n -match 'rx\s*5500\s*xt') { $result.computeUnits = 1408; $result.tdpW = 130 }
  # Intel Arc rời (Alchemist + Battlemage)
  elseif ($n -match 'arc\s*b580') { $result.computeUnits = 2560; $result.tdpW = 190 }
  elseif ($n -match 'arc\s*b570') { $result.computeUnits = 2304; $result.tdpW = 150 }
  elseif ($n -match 'arc\s*b380') { $result.computeUnits = 1536; $result.tdpW = 100 }
  elseif ($n -match 'arc\s*a770') { $result.computeUnits = 4096; $result.tdpW = 225 }
  elseif ($n -match 'arc\s*a750') { $result.computeUnits = 3584; $result.tdpW = 225 }
  elseif ($n -match 'arc\s*a580') { $result.computeUnits = 3072; $result.tdpW = 185 }
  elseif ($n -match 'arc\s*a380') { $result.computeUnits = 1024; $result.tdpW = 75 }
  elseif ($n -match 'arc\s*a310') { $result.computeUnits = 768;  $result.tdpW = 75 }

  return $result
}

# Bảng lookup TDP (W) theo tên model — dùng khi Get-GpuSpecsFromName không match.
# Match theo regex (case-insensitive) — key phải xuất hiện trong tên GPU.
# Ưu tiên key dài hơn (RTX 4080 SUPER) trước key ngắn (RTX 4080).
function Get-GpuTdpFromTable([string]$name) {
  if (-not $name) { return $null }
  $table = [ordered]@{
    # RTX 50 series (Blackwell)
    'RTX 5090' = 575; 'RTX 5080' = 360; 'RTX 5070 Ti' = 300; 'RTX 5070' = 250; 'RTX 5060 Ti' = 180; 'RTX 5060' = 150
    # RTX 40 series
    'RTX 4090' = 450; 'RTX 4080 SUPER' = 320; 'RTX 4080' = 320; 'RTX 4070 Ti SUPER' = 285; 'RTX 4070 Ti' = 285; 'RTX 4070 SUPER' = 220; 'RTX 4070' = 200; 'RTX 4060 Ti' = 165; 'RTX 4060' = 115; 'RTX 4050' = 100
    # RTX 30 series
    'RTX 3090 Ti' = 450; 'RTX 3090' = 350; 'RTX 3080 Ti' = 350; 'RTX 3080' = 320; 'RTX 3070 Ti' = 290; 'RTX 3070' = 220; 'RTX 3060 Ti' = 200; 'RTX 3060' = 170; 'RTX 3050 Ti' = 130; 'RTX 3050' = 130; 'RTX 2050' = 45
    # RTX 20 series
    'RTX 2080 Ti' = 260; 'RTX 2080 SUPER' = 250; 'RTX 2080' = 225; 'RTX 2070 SUPER' = 215; 'RTX 2070' = 175; 'RTX 2060 SUPER' = 175; 'RTX 2060' = 160
    # GTX 16 series
    'GTX 1660 Ti' = 120; 'GTX 1660 SUPER' = 125; 'GTX 1660' = 120; 'GTX 1650 SUPER' = 100; 'GTX 1650' = 75; 'GTX 1630' = 75
    # GTX 10 series
    'GTX 1080 Ti' = 250; 'GTX 1080' = 180; 'GTX 1070 Ti' = 180; 'GTX 1070' = 150; 'GTX 1060' = 120; 'GTX 1050 Ti' = 75; 'GTX 1050' = 75
    # AMD RX 9000 (RDNA 4)
    'RX 9070 XT' = 304; 'RX 9070' = 220
    # AMD RX 7000 series
    'RX 7900 XTX' = 355; 'RX 7900 XT' = 315; 'RX 7800 XT' = 263; 'RX 7700 XT' = 245; 'RX 7600 XT' = 190; 'RX 7600' = 165
    # AMD RX 6000 series
    'RX 6950 XT' = 335; 'RX 6900 XT' = 300; 'RX 6800 XT' = 300; 'RX 6800' = 250; 'RX 6750 XT' = 250; 'RX 6700 XT' = 230; 'RX 6700' = 175; 'RX 6650 XT' = 180; 'RX 6600 XT' = 160; 'RX 6600' = 132; 'RX 6500 XT' = 107; 'RX 6400' = 53
    # AMD RX 5000 series
    'RX 5700 XT' = 225; 'RX 5700' = 180; 'RX 5600 XT' = 150; 'RX 5500 XT' = 130
    # Intel Arc rời (Battlemage + Alchemist)
    'Arc B580' = 190; 'Arc B570' = 150; 'Arc B380' = 100
    'Arc A770' = 225; 'Arc A750' = 225; 'Arc A580' = 185; 'Arc A380' = 75; 'Arc A310' = 75
    # Intel Integrated Graphics — common names
    'UHD Graphics 770' = 30; 'UHD Graphics 730' = 25; 'UHD Graphics 710' = 15
    'UHD Graphics 630' = 25; 'UHD Graphics 620' = 15; 'UHD Graphics 610' = 15
    'Iris Xe Graphics' = 28; 'Iris Plus' = 28; 'Iris Pro' = 28
  }
  foreach ($k in $table.Keys) {
    if ($name -match [regex]::Escape($k)) { return $table[$k] }
  }
  return $null
}

# Phân loại discrete vs integrated dựa vào tên + manufacturer (AdapterCompatibility).
# Trên laptop, cùng tên "Intel UHD 770" là iGPU, còn "NVIDIA GeForce RTX 3060" là dGPU.
function Get-GpuTypeInfo([string]$name, [string]$manufacturer) {
  $isIntegrated = $false
  $isDiscrete = $false
  $type = 'Unknown'
  if ($name) {
    $low = $name.ToLower()
    $mfg = if ($manufacturer) { $manufacturer.ToLower() } else { '' }

    # Intel UHD/Iris/HD Graphics → integrated (cần match 'Intel' manufacturer hoặc tên có Intel)
    if ($low -match 'intel.*(uhd|iris|hd graphics)') { $isIntegrated = $true }
    # AMD APU / Radeon Graphics (KHÔNG có RX/Pro/Arc) → integrated
    # Match cả "AMD Radeon(TM) Graphics" (không có khoảng trắng trước Graphics),
    # "Radeon Vega", "Radeon Graphics", "Radeon 780M", "Radeon 680M" (APU Ryzen 7000/6000).
    elseif ($low -match 'radeon\s*(graphics|\(tm\)\s*graphics|vega|\d+m)\b') { $isIntegrated = $true }
    # AMD manufacturer + tên chỉ "Radeon" thuần → thường là APU graphics
    elseif ($mfg -match 'amd|ati' -and $low -match '^amd\s*radeon(\s*graphics)?$|radeon\(tm\)\s*graphics') { $isIntegrated = $true }
    # Apple Silicon
    elseif ($low -match 'apple') { $isIntegrated = $true }

    # NVIDIA/AMD rời / Quadro / Arc rời
    if (-not $isIntegrated) {
      if ($low -match 'nvidia|geforce|rtx|gtx|quadro|tesla|titan') { $isDiscrete = $true }
      elseif ($low -match 'arc\s*b[5-7]|arc\s*a[3-7]') { $isDiscrete = $true }
      elseif ($low -match 'radeon\s*rx|radeon\s*pro|radeon\s*vii') { $isDiscrete = $true }
    }
  }
  if ($isDiscrete) { $type = 'Discrete' }
  elseif ($isIntegrated) { $type = 'Integrated' }
  return @{ isDiscrete = $isDiscrete; isIntegrated = $isIntegrated; type = $type }
}

function Get-GpuDetails {
  # Resolution + max refresh lấy 1 lần (dùng cho tất cả card)
  $maxDisplay = Get-MaxDisplaySettings
  $resolution = if ($maxDisplay.maxResolution) { $maxDisplay.maxResolution } else { Get-PrimaryScreenResolution }
  if (-not $resolution) { $resolution = '' }
  $maxRefreshRateHz = $maxDisplay.maxRefreshRateHz

  $list = New-Object System.Collections.Generic.List[object]
  $gpus = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)
  if ($gpus.Count -eq 0) { return ,$list.ToArray() }

  # Build map PNPDeviceID → driverVersion từ registry (fallback)
  # Cache lại cho mỗi lần scan.
  $driverFallback = @{}

  foreach ($g in $gpus) {
    if (-not $g) { continue }
    $name  = Clean-GpuString ([string]$g.Name)
    $vp    = Clean-GpuString ([string]$g.VideoProcessor)
    $vendor = Get-GpuVendor $name $vp

    $ram = [int64]$g.AdapterRAM
    # VRAM detection ưu tiên registry 64-bit / nvidia-smi để tránh WMI overflow bug
    # trên card 8GB+ (vd RTX 2070 SUPER 8GB hiển thị 4.0 GB sai).
    $vramBytes = Get-GpuVramBytes ([string]$g.PNPDeviceID) $name $vendor $ram
    if ($vramBytes -gt 0) {
      $vramGB = [math]::Round($vramBytes / 1073741824.0, 1)
      $vramMb = [int][math]::Round($vramBytes / 1048576.0)
    } elseif ($vramBytes -lt 0) {
      # iGPU — không dùng WMI AdapterRAM (nó là shared memory allocation, không phải VRAM).
      $vramGB = $null
      $vramMb = $null
    } else {
      $vramGB = Convert-AdapterRamToGB $ram
      $vramMb = Convert-AdapterRamToMB $ram
    }

    # Driver version — fallback registry nếu WMI trống
    $driverVer = Clean-GpuString ([string]$g.DriverVersion)
    if (-not $driverVer) {
      $pnp = [string]$g.PNPDeviceID
      if ($driverFallback.ContainsKey($pnp)) {
        $driverVer = $driverFallback[$pnp]
      } else {
        $driverVer = Get-GpuDriverFromRegistry $pnp
        if (-not $driverVer) { $driverVer = '' }
        $driverFallback[$pnp] = $driverVer
      }
    }

    # VRAMType — từ registry NVIDIA nếu có, fallback heuristic
    $vramType = $null
    try {
      $hwPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\"
      $subkeys = @(Get-ChildItem -Path $hwPath -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^[0-9]{4}$' })
      $pnp = [string]$g.PNPDeviceID
      foreach ($sk in $subkeys) {
        $reg = Get-ItemProperty -Path $sk.PSPath -ErrorAction SilentlyContinue
        if ($reg -and $reg.MatchingDeviceId -and $pnp -match [regex]::Escape([string]$reg.MatchingDeviceId).Replace('\\','')) {
          if ($reg.VRAMType) { $vramType = [string]$reg.VRAMType; break }
          if ($reg.'Memory Type') { $vramType = [string]$reg.'Memory Type'; break }
        }
      }
    } catch {}
    if (-not $vramType) { $vramType = Guess-VramType $name $vendor }

    # BusWidth nếu có
    $busWidth = $null
    if ($null -ne $g.CurrentBitsPerPixel -and [int]$g.CurrentBitsPerPixel -gt 0) { $busWidth = [int]$g.CurrentBitsPerPixel }

    # Compute units + tdpW từ bảng heuristic; nếu chưa có thì fallback bảng lookup wattage.
    $specs = Get-GpuSpecsFromName $name
    $computeUnits = $specs.computeUnits
    $tdpW = $specs.tdpW
    if (-not $tdpW) {
      $tdpW = Get-GpuTdpFromTable $name
    }

    # Phân loại discrete vs integrated
    $adapterCompat = if ($g.AdapterCompatibility) { ([string]$g.AdapterCompatibility).Trim() } else { '' }
    $typeInfo = Get-GpuTypeInfo $name $adapterCompat

    # driverDate parse (CIM đã trả [DateTime] — dùng Convert-WmiDate để an toàn)
    $driverDateStr = Convert-WmiDate $g.DriverDate 'yyyy-MM-dd'

    # refreshRateHz ép int
    $refreshHz = $null
    if ($g.CurrentRefreshRate -and [int]$g.CurrentRefreshRate -gt 0) { $refreshHz = [int]$g.CurrentRefreshRate }

    # maxPowerW: NVIDIA qua nvidia-smi, AMD/Intel = null
    $maxPowerW = $null
    if ($vendor -eq 'NVIDIA') {
      $w = Get-NvidiaSmiMaxPower $name
      if ($w -and $w -gt 0) { $maxPowerW = [math]::Round([double]$w, 1) }
    }

    # VRAM shared (iGPU) — từ registry nếu có (DriverSize từ WDM)
    $vramSharedMb = $null
    try {
      $hwPath2 = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\"
      $sk2 = @(Get-ChildItem -Path $hwPath2 -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^[0-9]{4}$' })
      $pnp2 = [string]$g.PNPDeviceID
      foreach ($s in $sk2) {
        $reg2 = Get-ItemProperty -Path $s.PSPath -ErrorAction SilentlyContinue
        if ($reg2 -and $reg2.MatchingDeviceId -and $pnp2 -match [regex]::Escape([string]$reg2.MatchingDeviceId).Replace('\\','')) {
          if ($null -ne $reg2.'HardwareInformation.qwMemorySize') {
            $v = [int64]$reg2.'HardwareInformation.qwMemorySize'
            if ($v -gt 0) {
              if ($v -gt 4294967296) { $vramSharedMb = [int]([math]::Round($v / 1048576.0)) }
              else { $vramSharedMb = [int]$v }
            }
          }
          if ($reg2.VRAMSharedSize -and -not $vramSharedMb) {
            $sz = [int64]$reg2.VRAMSharedSize
            if ($sz -gt 4294967296) { $sz = [int]([math]::Round($sz / 1048576.0)) }
            if ($sz -gt 0) { $vramSharedMb = [int]$sz }
          }
          break
        }
      }
    } catch {}

    # Đánh dấu primary — adapter đầu trong WMI thường là primary, nhưng check thêm
    # dựa vào VideoMode / CurrentHorizontalResolution (Resolution đang drive).
    $isPrimary = $false
    if ($g.CurrentHorizontalResolution -and [int]$g.CurrentHorizontalResolution -gt 0) { $isPrimary = $true }
    # Nếu nhiều GPU mà không cái nào có resolution → cái đầu là primary
    if (-not $isPrimary) {
      $hasPrimary = ($list | Where-Object { $_.primary -eq $true } | Select-Object -First 1)
      if (-not $hasPrimary -and $list.Count -eq 0) { $isPrimary = $true }
    }

    $list.Add(@{
      # ── Preferred fields ──
      name           = $name
      manufacturer   = $adapterCompat
      adapterRAMGB   = $vramGB
      driverVersion  = $driverVer
      driverDate     = $driverDateStr
      videoModeDesc  = if ($g.VideoModeDescription) { ([string]$g.VideoModeDescription).Trim() } else { $null }
      refreshRateHz      = $refreshHz
      maxRefreshRateHz   = $maxRefreshRateHz
      maxResolution      = $resolution
      tdpW               = $tdpW
      isDiscrete     = $typeInfo.isDiscrete
      isIntegrated   = $typeInfo.isIntegrated
      type           = $typeInfo.type
      status         = if ($g.Status) { ([string]$g.Status).Trim() } else { $null }
      pnpDeviceId    = [string]$g.PNPDeviceID

      # ── Legacy aliases ──
      model          = $name
      vramGb         = $vramGB
      vramMb         = $vramMb
      vramSharedMb   = $vramSharedMb
      vramType       = $vramType
      busWidth       = $busWidth
      computeUnits   = $computeUnits
      powerW         = $tdpW
      vendor         = $vendor
      videoProcessor = $vp
      resolution     = $resolution
      maxPowerW      = $maxPowerW
      primary        = $isPrimary
      adapterRAM     = [int64]$ram
    }) | Out-Null
  }

  return ,$list.ToArray()
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
# WMI Win32_PhysicalMemory liệt kê từng DIMM đang cắm.
# Win32_PhysicalMemoryArray.MemoryDevices cho tổng số slot vật lý trên mainboard.
# Win32_ComputerSystem.TotalPhysicalMemory cho tổng RAM "theo BIOS" (có thể khác tổng DIMM do reserved memory).
# Định dạng output mới: { totalGB, csTotalGB, dimmCount, totalSlots, freeSlots,
#                          memoryType, maxSpeedMhz, modules: [...] }
try {
  $ErrorActionPreference = 'SilentlyContinue'

  # 1. Lấy DIMMs
  $modList = Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue
  $cpuName = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1).Name
  $platMax = Get-PlatformMemoryMax $cpuName
  $smbiosModules = Get-SmbiosType17Max
  $slotToSmbios = @{}
  foreach ($s in $smbiosModules) { if ($s.deviceLocator) { $slotToSmbios[$s.deviceLocator] = $s } }
  # Match theo cả BankLabel vì một số BIOS chỉ populate BankLabel, không có DeviceLocator.
  $bankToSmbios = @{}
  foreach ($s in $smbiosModules) { if ($s.bankLabel -and -not $slotToSmbios.ContainsKey($s.bankLabel)) { $bankToSmbios[$s.bankLabel] = $s } }

  $modules = New-Object System.Collections.Generic.List[object]
  $sticks = New-Object System.Collections.Generic.List[object]
  $totalBytes = [int64]0
  foreach ($m in $modList) {
    if (-not $m -or -not $m.Capacity) { continue }
    $cap = [int64]$m.Capacity; $totalBytes += $cap
    $slot = Trim-WmiString ([string]$m.DeviceLocator)
    $manufacturer = Trim-WmiString ([string]$m.Manufacturer)
    $partNumber = Trim-WmiString ([string]$m.PartNumber)
    $serialNumber = Trim-WmiString ([string]$m.SerialNumber)
    $bankLabel = Trim-WmiString ([string]$m.BankLabel)

    $ff = Get-MemFormFactor ([int]$m.FormFactor)
    # WMI Speed field: trên DDR5 thường trả 0 do BIOS chưa populate, fallback SMBIOS Speed.
    $speedMhz = if ($m.Speed -gt 0) { [int]$m.Speed } else { 0 }
    $configuredMhz = if ($m.ConfiguredClockSpeed -gt 0) { [int]$m.ConfiguredClockSpeed } else { $speedMhz }
    # Fallback MemoryType theo speed khi WMI MemoryType=0 (BIOS không populate).
    $gen = Get-MemGeneration ([int]$m.MemoryType) $speedMhz

    # Tra SMBIOS theo slot hoặc bankLabel.
    $smbios = $null
    if ($slot -and $slotToSmbios.ContainsKey($slot)) { $smbios = $slotToSmbios[$slot] }
    elseif ($bankLabel -and $bankToSmbios.ContainsKey($bankLabel)) { $smbios = $bankToSmbios[$bankLabel] }

    $smbiosSpeed = if ($smbios -and $smbios.speed -gt 0) { $smbios.speed } else { $null }
    # Nếu WMI không có speed, lấy SMBIOS JEDEC max (đây là bus thật của thanh RAM).
    if ($speedMhz -le 0 -and $smbiosSpeed -gt 0) {
      $speedMhz = $smbiosSpeed
    }
    # Nếu WMI không có configured clock, lấy SMBIOS Configured Clock.
    if ($configuredMhz -le 0 -and $smbios -and $smbios.configuredClock -gt 0) {
      $configuredMhz = $smbios.configuredClock
    }
    # Refine generation từ SMBIOS memoryType enum nếu WMI Unknown.
    if ($smbios -and $smbios.memoryTypeEnum -gt 0 -and ($gen -eq 'Unknown' -or $gen -eq 'Other')) {
      $gen = Get-MemGeneration ([int]$smbios.memoryTypeEnum) $speedMhz
    }

    $platMaxForGen = $null
    if ($platMax) {
      if ($gen -eq 'DDR5') { $platMaxForGen = $platMax.ddr5Max }
      elseif ($gen -in 'DDR','DDR2','DDR3','DDR4') { $platMaxForGen = $platMax.ddr4Max }
    }

    # ConfiguredVoltage trong WMI trả về mV; chia 1000 để ra Volt
    $voltageV = if ($m.ConfiguredVoltage -gt 0) { [math]::Round([double]$m.ConfiguredVoltage / 1000.0, 3) } else { $null }
    $voltageMv = if ($voltageV -ne $null) { [int]([math]::Round($voltageV * 1000)) } else { $null }

    $rank = Get-MemRank ([int]$m.DataWidth) # dùng DataWidth làm proxy nếu TotalWidth / Rank không có
    # TotalWidth vs DataWidth: nếu TotalWidth > DataWidth → ECC
    $isEcc = ($m.TotalWidth -and $m.DataWidth -and [int]$m.TotalWidth -gt [int]$m.DataWidth)

    $normalizedMfr = Normalize-RamManufacturer $manufacturer
    $capGB = [math]::Round($cap / 1073741824.0, 1)
    $modules.Add(@{
      slot           = $slot
      sizeBytes      = $cap
      capacityGB     = $capGB
      speedMhz       = $speedMhz
      configuredMhz  = $configuredMhz
      smbiosSpeedMhz = $smbiosSpeed
      platformMaxMhz = $platMaxForGen
      formFactor     = $ff
      memoryType     = $gen
      type           = $gen                 # legacy
      generation     = $gen                 # legacy
      manufacturer   = $normalizedMfr
      partNumber     = $partNumber
      serialNumber   = $serialNumber
      bankLabel      = $bankLabel
      deviceLocator  = $slot
      voltageV       = $voltageV
      voltageMv      = $voltageMv
      rank           = $rank
      clTiming       = $null
    }) | Out-Null
    # Schema mới (RamStickInfo) — preferred cho Dashboard flip-card.
    # $modules là List[object] có Add qua pipeline → index bằng count-1.
    $sticks.Add(@{
      slot         = $slot
      bankLabel    = $bankLabel
      manufacturer = $normalizedMfr
      partNumber   = $partNumber
      serial       = $serialNumber
      capacityGB   = [int][math]::Round($cap / 1073741824.0, 0)
      speedMTs     = $speedMhz
      memoryType   = $gen
      formFactor   = $ff
      voltageV     = $voltageV
    }) | Out-Null
  }

  # 2. Tổng từ DIMMs (GB)
  $totalGB = if ($totalBytes -gt 0) { [math]::Round($totalBytes / 1073741824.0, 1) } else { $null }

  # 3. Total system RAM từ WMI ComputerSystem (cross-check)
  $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue | Select-Object -First 1
  $csTotalBytes = if ($cs -and $cs.TotalPhysicalMemory) { [int64]$cs.TotalPhysicalMemory } else { $totalBytes }
  $csTotalGB = if ($csTotalBytes -gt 0) { [math]::Round($csTotalBytes / 1073741824.0, 1) } else { $null }

  # 3b. Real-time usage từ Win32_OperatingSystem (KB → bytes).
  # TotalVisibleMemorySize + FreePhysicalMemory luôn được populate (khác với
  # Win32_PhysicalMemory có thể trống nếu thiếu quyền Admin).
  $usedBytes = $null; $freeBytes = $null
  $usedGB = $null; $freeGB = $null; $usedPercent = $null
  try {
    $osMem = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($osMem -and $osMem.TotalVisibleMemorySize -and $osMem.FreePhysicalMemory) {
      $totalOSKB = [int64]$osMem.TotalVisibleMemorySize
      $freeKB = [int64]$osMem.FreePhysicalMemory
      $freeBytes = $freeKB * 1024
      $usedBytes = ($totalOSKB - $freeKB) * 1024
      if ($totalOSKB -gt 0) {
        $usedPercent = [math]::Round((($totalOSKB - $freeKB) / $totalOSKB) * 100, 1)
        $freeGB = [math]::Round($freeBytes / 1073741824.0, 1)
        $usedGB = [math]::Round($usedBytes / 1073741824.0, 1)
      }
      # Fallback nếu Win32_PhysicalMemory trả rỗng (khi thiếu Admin) → vẫn có total
      if ($totalBytes -eq 0) { $totalBytes = $totalOSKB * 1024 }
    }
  } catch {}

  # 4. Tổng số slot vật lý từ Win32_PhysicalMemoryArray.MemoryDevices
  $totalSlots = $null
  try {
    $memArrays = @(Get-CimInstance Win32_PhysicalMemoryArray -ErrorAction SilentlyContinue)
    if ($memArrays.Count -gt 0) {
      $totalSlots = ($memArrays | Measure-Object -Property MemoryDevices -Sum).Sum
    }
  } catch {}
  $usedSlots = $modules.Count
  if (-not $totalSlots -or $totalSlots -lt $usedSlots) { $totalSlots = $usedSlots }
  $freeSlots = [math]::Max(0, [int]$totalSlots - $usedSlots)

  # 5. Thế hệ RAM phổ biến nhất (theo số DIMM)
  $memoryType = $null
  if ($modules.Count -gt 0) {
    $memoryType = ($modules |
      Group-Object { $_.memoryType } |
      Sort-Object Count -Descending |
      Select-Object -First 1).Name
  }

  # 6. Tốc độ max
  $maxSpeedMhz = $null
  if ($modules.Count -gt 0) {
    $maxSpeedMhz = ($modules | Measure-Object -Property speedMhz -Maximum).Maximum
    if (-not $maxSpeedMhz) {
      $maxSpeedMhz = ($modules | Measure-Object -Property configuredMhz -Maximum).Maximum
    }
  }

  # 7. PlatformMaxMhz cho thế hệ RAM đang dùng
  $platMaxOverall = $null
  if ($platMax -and $memoryType) {
    if ($memoryType -eq 'DDR5') { $platMaxOverall = $platMax.ddr5Max }
    elseif ($memoryType -in 'DDR','DDR2','DDR3','DDR4') { $platMaxOverall = $platMax.ddr4Max }
  }

  Out-Part 'memory' @{
    totalGB         = $totalGB
    totalBytes      = $totalBytes
    csTotalGB       = $csTotalGB
    csTotalBytes    = $csTotalBytes
    usedBytes       = $usedBytes
    freeBytes       = $freeBytes
    usedGB          = $usedGB
    freeGB          = $freeGB
    usedPercent     = $usedPercent
    dimmCount       = $usedSlots
    slots           = if ($usedSlots -gt 0) { $usedSlots } else { $null }
    totalSlots      = $totalSlots
    freeSlots       = $freeSlots
    memoryType      = $memoryType
    maxSpeedMhz     = $maxSpeedMhz
    platformMaxMhz  = $platMaxOverall
    platformCpuName = $cpuName
    modules         = @($modules.ToArray())
    sticks          = @($sticks.ToArray())
  }
} catch { Out-Error 'memory' $_.Exception.Message }

# --- Disks ---
# Get-PhysicalDisk (NVMe/SSD/HDD + busType) + Get-Disk (serial/firmware) +
# Get-Volume (driveLetter, label, free) + Get-StorageReliabilityCounter (health/temp/wear).
# KHÔNG filter theo MediaType — chỉ filter disk ảo (no size, no model, missing).
# Fallback Win32_DiskDrive cho disk không hiện qua Get-PhysicalDisk (USB, eSATA…).
try {
  $list = New-Object System.Collections.Generic.List[object]

  # Map enum int → string cho MediaType (Get-PhysicalDisk có thể trả enum int trên Win10/Server)
  $mediaTypeMap = @{
    1='Unspecified'; 2='HDD'; 3='SSD'; 4='SCM'; 5='SSD'
    'Unspecified'='Unspecified'; 'HDD'='HDD'; 'SSD'='SSD'; 'SCM'='SCM'
  }
  # BusType: hỗ trợ cả string ('NVMe' — Windows 11+) và int enum (legacy).
  $busMap = @{
    'NVMe'='NVMe'; 'SATA'='SATA'; 'SAS'='SAS'; 'USB'='USB'; 'RAID'='RAID'
    'SCSI'='SCSI'; 'ATA'='ATA'; 'ATAPI'='ATAPI'; 'iSCSI'='iSCSI'
    'SD'='SD'; 'MMC'='MMC'; 'Virtual'='Virtual'
    'File-Backed Virtual'='File-Backed Virtual'; 'Storage Spaces'='Storage Spaces'
    1='SCSI'; 2='ATAPI'; 3='ATA'; 7='USB'; 8='RAID'; 9='iSCSI'
    11='SATA'; 17='SAS'; 18='SD'; 19='MMC'; 20='Virtual'
    21='File-Backed Virtual'; 22='Storage Spaces'; 23='NVMe'
  }

  function Clean-DiskString([string]$raw) {
    if (-not $raw) { return $null }
    $s = [string]$raw
    $s = $s -replace "\`0", ''
    $s = $s -replace '[\x01-\x08\x0B-\x1F]', ''
    $s = $s.Trim()
    if ($s -eq '') { return $null }
    return $s
  }

  function Get-BusName($raw) {
    if ($null -eq $raw) { return 'Unknown' }
    if ($busMap.ContainsKey($raw)) { return $busMap[$raw] }
    if ($busMap.ContainsKey([int]$raw)) { return $busMap[[int]$raw] }
    return [string]$raw
  }

  function Get-MediaTypeName($raw) {
    if ($null -eq $raw) { return 'Unspecified' }
    if ($mediaTypeMap.ContainsKey($raw)) { return $mediaTypeMap[$raw] }
    if ($mediaTypeMap.ContainsKey([int]$raw)) { return $mediaTypeMap[[int]$raw] }
    return [string]$raw
  }

  function Get-CombinedType($media, $bus) {
    if ($bus -eq 'NVMe') { return 'NVMe SSD' }
    if ($media -eq 'SSD' -and ($bus -match 'SATA' -or $bus -eq 'ATA')) { return 'SATA SSD' }
    if ($media -eq 'HDD') { return 'HDD' }
    if ($bus -eq 'USB') { return 'USB' }
    return $media
  }

  function Resolve-Health($opStatus, $rlHealth) {
    $op = if ($opStatus) { "$opStatus".ToLower() } else { '' }
    $rl = if ($rlHealth) { "$rlHealth".ToLower() } else { '' }
    if ($op -eq 'healthy' -and ($rl -eq 'healthy' -or $rl -eq '')) { return 'Healthy' }
    if ($op -eq 'warning' -or $rl -eq 'warning') { return 'Warning' }
    if ($op -in @('unhealthy','predictingfailure','degraded','error') -or $rl -eq 'unhealthy') { return 'Unhealthy' }
    return 'Unknown'
  }

  function New-DiskItem {
    param(
      $model, $mediaType, $busType, $totalBytes, $freeBytes,
      $driveLetter, $label, $health, $healthRaw,
      $serial, $firmware, $tempC, $wearPct, $powerOnHours, $iface
    )
    $totalGB = if ($totalBytes -gt 0) { [math]::Round($totalBytes / 1073741824.0, 1) } else { 0 }
    $freeGB  = if ($freeBytes  -gt 0) { [math]::Round($freeBytes  / 1073741824.0, 1) } else { 0 }
    $usedPct = if ($totalBytes -gt 0 -and $freeBytes -ge 0 -and $freeBytes -le $totalBytes) {
      [math]::Round((($totalBytes - $freeBytes) / $totalBytes) * 100, 1)
    } else { 0 }
    $capGb   = if ($totalBytes -gt 0) { [int][math]::Floor($totalBytes / 1073741824.0) } else { $null }
    $freeGb  = if ($freeBytes  -gt 0) { [int][math]::Floor($freeBytes  / 1073741824.0) } else { $null }
    $combinedType = Get-CombinedType $mediaType $busType
    $dItem = @{}
    $dItem['model']            = $model
    $dItem['mediaType']        = $mediaType
    $dItem['busType']          = $busType
    $dItem['totalGB']          = $totalGB
    $dItem['freeGB']           = $freeGB
    $dItem['usedPercent']      = $usedPct
    $dItem['driveLetter']      = $driveLetter
    $dItem['label']            = $label
    $dItem['health']           = $health
    $dItem['healthRaw']        = $healthRaw
    $dItem['tempC']            = $tempC
    $dItem['wearPct']          = $wearPct
    $dItem['powerOnHours']     = $powerOnHours
    $dItem['serial']           = $serial
    $dItem['firmware']         = $firmware
    $dItem['interfaceType']    = $iface
    # Legacy aliases
    $dItem['name']             = $model
    $dItem['type']             = $combinedType
    $dItem['capacityGb']       = $capGb
    $dItem['freeGb']           = $freeGb
    $dItem['tempC_legacy']     = $tempC
    $dItem['healthStatus']     = $health
    $dItem['mediaTypeRaw']     = $mediaType
    $dItem['interfaceTypeRaw'] = $busType
    $dItem['serialNumber']     = $serial
    $dItem['firmwareRevision'] = $firmware
    return $dItem
  }

  # Lấy TẤT CẢ physical disk (chỉ filter disk ảo).
  $physRaw = @(Get-PhysicalDisk -ErrorAction SilentlyContinue)
  $physDisks = @($physRaw | Where-Object {
    $_.Size -gt 0 -and
    $_.Model -ne $null -and $_.Model -ne '' -and
    "$($_.OperationalStatus)".ToLower() -notin @('missing','error','not present')
  })

  # Win32_DiskDrive fallback (USB / eSATA / SCSI không qua được Get-PhysicalDisk)
  $wmiDisks = @(Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | Where-Object {
    $_.Size -gt 0 -and $_.Model -ne $null -and $_.Model -ne ''
  })

  if (($physDisks.Count -eq 0) -and ($wmiDisks.Count -eq 0)) {
    Out-Part 'disks' @()
  } else {
    $diskList = @(Get-Disk -ErrorAction SilentlyContinue)
    $volumes  = @(Get-Volume -ErrorAction SilentlyContinue)

    # Map DiskNumber → list partition từ Get-Partition -Volume.
    $partVols = @{}
    foreach ($v in $volumes) {
      if ($null -eq $v -or -not $v.Size -or $v.Size -le 0) { continue }
      $p = Get-Partition -Volume $v -ErrorAction SilentlyContinue
      if ($null -eq $p) { continue }
      $dn = [string]$p.DiskNumber
      if (-not $partVols.ContainsKey($dn)) {
        $partVols[$dn] = New-Object System.Collections.Generic.List[object]
      }
      $partVols[$dn].Add([PSCustomObject]@{
        DiskNumber  = [int]$p.DiskNumber
        DriveLetter = if ($v.DriveLetter) { ([string]$v.DriveLetter).Trim() } else { '' }
        Label       = if ($v.FileSystemLabel) { ([string]$v.FileSystemLabel).Trim() } else { '' }
        Size        = [int64]$v.Size
        Free        = [int64]$v.SizeRemaining
      }) | Out-Null
    }

    # Cache StorageReliabilityCounter theo UniqueId.
    $counters = @{}
    foreach ($p in $physDisks) {
      $uid = [string]$p.UniqueId
      try {
        $c = $p | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue
        if ($c) { $counters[$uid] = $c }
      } catch {}
    }

    $seenSerial = @{}
    foreach ($pd in $physDisks) {
      $sizeBytes = [int64]$pd.Size
      $model = Clean-DiskString ([string]$pd.Model)
      if (-not $model) { continue }

      $deviceId = [string]$pd.DeviceId
      $md = $diskList | Where-Object { $_.Number -eq $deviceId } | Select-Object -First 1
      $serial   = Clean-DiskString ([string]$md.SerialNumber)
      $firmware = Clean-DiskString ([string]$md.FirmwareRevision)
      if ($serial) { $seenSerial[$serial] = $true }

      $diskPartitions = @(if ($partVols.ContainsKey($deviceId)) { $partVols[$deviceId] } else { @() })

      $totalSize = 0; $totalFree = 0
      $withLetter = @()
      foreach ($p in $diskPartitions) {
        if ($p.Size -gt 0) { $totalSize += $p.Size }
        if ($p.Free -gt 0) { $totalFree += $p.Free }
        if ($p.DriveLetter -ne '') { $withLetter += $p }
      }
      if ($totalSize -eq 0) { $totalSize = $sizeBytes }

      $primary = $null
      if ($withLetter.Count -gt 0) {
        $primary = $withLetter | Sort-Object Free -Descending | Select-Object -First 1
      }
      if (-not $primary -and $diskPartitions.Count -gt 0) {
        $primary = $diskPartitions | Sort-Object Size -Descending | Select-Object -First 1
      }
      $primaryLetter = if ($primary) { $primary.DriveLetter } else { '' }
      $primaryLabel  = if ($primary) { $primary.Label }      else { '' }

      $busName   = Get-BusName $pd.BusType
      $mediaName = Get-MediaTypeName $pd.MediaType

      $uid = [string]$pd.UniqueId
      $c   = if ($counters.ContainsKey($uid)) { $counters[$uid] } else { $null }
      $rlHealth = if ($c) { [string]$c.HealthStatus } else { '' }
      $opStatus = [string]$pd.OperationalStatus
      $health   = Resolve-Health $opStatus $rlHealth
      $healthRaw = "$opStatus" + $(if ($rlHealth) { "/$rlHealth" } else { '' })
      $tempC = if ($c -and $c.Temperature) { [int]$c.Temperature } else { $null }
      $wearPct = if ($c -and ($null -ne $c.Wear) -and ("$($c.Wear)" -ne '')) { [int]$c.Wear } else { $null }
      $powerOnHours = if ($c -and $c.PowerOnHours) { [int]$c.PowerOnHours } else { $null }

      $wmi = $wmiDisks | Where-Object { (Clean-DiskString ([string]$_.SerialNumber)) -eq $serial -and $_.Index -eq $deviceId } | Select-Object -First 1
      if (-not $wmi) { $wmi = $wmiDisks | Where-Object { (Clean-DiskString ([string]$_.SerialNumber)) -eq $serial } | Select-Object -First 1 }
      $iface = if ($wmi) { [string]$wmi.InterfaceType } else { $null }

      $list.Add(
        (New-DiskItem $model $mediaName $busName $totalSize $totalFree $primaryLetter $primaryLabel $health $healthRaw $serial $firmware $tempC $wearPct $powerOnHours $iface)
      ) | Out-Null
    }

    # Fallback: thêm Win32_DiskDrive mà Get-PhysicalDisk bỏ sót (USB / eSATA / SCSI).
    foreach ($w in $wmiDisks) {
      $wSerial = Clean-DiskString ([string]$w.SerialNumber)
      if (-not $wSerial -or $seenSerial[$wSerial]) { continue }
      $wModel = Clean-DiskString ([string]$w.Model)
      if (-not $wModel) { continue }
      $wSize = [int64]$w.Size
      $wIdx  = [int]$w.Index
      $wIface = [string]$w.InterfaceType

      $wPartVols = @(if ($partVols.ContainsKey("$wIdx")) { $partVols["$wIdx"] } else { @() })
      $totalSize = 0; $totalFree = 0; $withLetter = @()
      foreach ($p in $wPartVols) {
        if ($p.Size -gt 0) { $totalSize += $p.Size }
        if ($p.Free -gt 0) { $totalFree += $p.Free }
        if ($p.DriveLetter -ne '') { $withLetter += $p }
      }
      if ($totalSize -eq 0) { $totalSize = $wSize }

      $primary = $null
      if ($withLetter.Count -gt 0) {
        $primary = $withLetter | Sort-Object Free -Descending | Select-Object -First 1
      }
      if (-not $primary -and $wPartVols.Count -gt 0) {
        $primary = $wPartVols | Sort-Object Size -Descending | Select-Object -First 1
      }
      $primaryLetter = if ($primary) { $primary.DriveLetter } else { '' }
      $primaryLabel  = if ($primary) { $primary.Label }      else { '' }

      $busName = Get-BusName $wIface
      if ($wIface -match 'USB') { $mediaName = 'Unspecified' }
      elseif ($wModel -match 'SSD|NVMe') { $mediaName = 'SSD' }
      elseif ($wIface -match 'SATA|IDE|ATA') { $mediaName = 'HDD' }
      else { $mediaName = 'Unspecified' }

      $list.Add(
        (New-DiskItem $wModel $mediaName $busName $totalSize $totalFree $primaryLetter $primaryLabel 'Unknown' "$($w.Status)" $wSerial $null $null $null $null $wIface)
      ) | Out-Null
    }

    Out-Part 'disks' @($list.ToArray())
  }
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
      manufacturer = Trim-WmiString ([string]$mb.Manufacturer)
      product = Trim-WmiString ([string]$mb.Product)
      serial = Trim-WmiString ([string]$mb.SerialNumber)
      version = Trim-WmiString ([string]$mb.Version)
      biosVersion = if ($bios) { Trim-WmiString ([string]$bios.SMBIOSBIOSVersion) } else { $null }
    }
  } else { Out-Error 'mainboard' 'No Win32_BaseBoard instance' }
} catch { Out-Error 'mainboard' $_.Exception.Message }

# --- BIOS ---
try {
  $b = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($b) {
    $rd = Convert-WmiDate $b.ReleaseDate 'o'
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
    $installDate = Convert-WmiDate $osRaw.InstallDate 'o'
    $lastBoot = Convert-WmiDate $osRaw.LastBootUpTime 'o'
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
  const scriptPath = join(tmpdir(), `lap-hw-stream-${randomBytes(6).toString("hex")}.ps1`);
  // Write to disk first — PowerShell mất stdout khi pipe stdin >~2KB.
  let stopped = false;
  let doneSeen = false;
  let stdoutBuf = "";

  const finish = (reason: string) => {
    if (stopped) return;
    stopped = true;
    try { child?.kill(); } catch {}
    fs.unlink(scriptPath).catch(() => {});
    if (!doneSeen) {
      onPart({ key: "__error__", ok: false, error: reason, ts: Date.now() });
    }
  };

  const timer = setTimeout(() => finish(`timeout after ${TOTAL_TIMEOUT_MS}ms`), TOTAL_TIMEOUT_MS);

  let child: ReturnType<typeof spawn> | null = null;
  fs.writeFile(scriptPath, PS_HARDWARE_SCRIPT, "utf8").then(() => {
    if (stopped) return;
    child = spawn(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      { windowsHide: true },
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
  }).catch((err) => finish(`write script error: ${err.message}`));

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

// ─── FAST hardware scanner (parallel jobs, 2-3 seconds) ─────────────────────────
// Stream từng phần về renderer ngay khi job hoàn thành.
// Bỏ qua các truy vấn chậm (SMBIOS, registry scan), chỉ lấy thông tin cốt lõi
// để hiển thị Dashboard nhanh.

const PS_FAST_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
function Out-Part([string]$key, $value) {
  # PowerShell ConvertTo-Json wrap array thành {value:[...]}, serialize riêng.
  if ($null -eq $value) {
    [Console]::Out.WriteLine('{"key":"' + $key + '","ok":true,"data":null}')
  } else {
    $dataJson = $value | ConvertTo-Json -Depth 8 -Compress
    [Console]::Out.WriteLine('{"key":"' + $key + '","ok":true,"data":' + $dataJson + '}')
  }
  [Console]::Out.Flush()
}
function Out-Error([string]$key, [string]$msg) {
  $payload = @{ key = $key; ok = $false; error = $msg }
  [Console]::Out.WriteLine(($payload | ConvertTo-Json -Depth 4 -Compress))
  [Console]::Out.Flush()
}

# Khởi động các job song song ngay lập tức
$jobs = @()

# ── CPU ───────────────────────────────────────
$jobs += Start-Job -ScriptBlock {
  $c = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $c) { return @{ name = $null; cores = $null; threads = $null; baseGhz = $null; architecture = $null; turboGhz = $null } }
  # Đọc tên chính xác từ registry
  $regName = (Get-ItemProperty 'HKLM:\HARDWARE\DESCRIPTION\System\CentralProcessor\0' -ErrorAction SilentlyContinue).ProcessorNameString
  $name = if ($regName) { $regName.Trim() } else { [string]$c.Name }
  $archMap = @{ 0 = 'x86'; 5 = 'ARM'; 6 = 'IA64'; 9 = 'AMD64'; 12 = 'ARM64' }
  @{
    name = $name
    manufacturer = [string]$c.Manufacturer
    cores = [int]$c.NumberOfCores
    threads = [int]$c.NumberOfLogicalProcessors
    baseGhz = [math]::Round($c.MaxClockSpeed / 1000.0, 2)
    turboGhz = $null
    architecture = $archMap[[int]$c.Architecture]
    cacheL1Kb = $null; cacheL2Kb = $null; cacheL3Kb = $null
    socket = $null; processNm = $null; tdpW = $null
  }
}

# ── Memory ────────────────────────────────────
# Lấy từng DIMM (WMI Win32_PhysicalMemory) + tổng slot từ Win32_PhysicalMemoryArray
# + tổng từ ComputerSystem + real-time usage từ OperatingSystem.
# Map FormFactor / MemoryType enum + fallback DDR5 theo tốc độ.
$jobs += Start-Job -ScriptBlock {
  $ErrorActionPreference = 'SilentlyContinue'
  $ffMap = @{ 0='Unknown';1='Other';2='SIP';3='DIP';4='ZIP';5='SOJ';6='Proprietary';7='SIMM';8='DIMM';9='TSOP';10='RIMM';11='SODIMM';12='SRIMM';13='FB-DIMM' }
  $memTypeMap = @{ 0='Unknown';1='Other';2='DRAM';3='SDRAM';17='DDR';18='DDR';20='DDR';21='DDR2';22='DDR2-FB-DIMM';24='DDR3';25='FBD2';26='DDR4';27='DDR5';28='DDR5';29='DDR5';30='DDR4';31='DDR5';32='DDR5';33='DDR5';34='DDR5';35='DDR5';36='DDR5' }

  function Trim-String([string]$raw) {
    if (-not $raw) { return $null }
    # Replace null bytes (\0) + control chars (1-8, 11-31) + trim whitespace
    $s = [string]$raw
    $nullChar = [char]0
    $s = $s -replace [regex]::Escape($nullChar), ''
    $s = $s -replace '[\x01-\x08\x0B-\x1F]', ''
    $s = $s.Trim()
    if ($s -eq '') { return $null }
    return $s
  }
  function Get-Gen([int]$mt, [int]$spd) {
    if ($memTypeMap.ContainsKey($mt)) {
      $v = $memTypeMap[$mt]
      if ($v -notin @('Unknown','Other')) { return $v }
    }
    if ($spd -ge 4000) { return 'DDR5' }
    if ($spd -ge 1600) { return 'DDR4' }
    if ($spd -ge 800)  { return 'DDR3' }
    if ($spd -gt 0)    { return 'DDR' }
    return 'Unknown'
  }
  function Get-FF([int]$ff) { if ($ffMap.ContainsKey($ff)) { return $ffMap[$ff] } else { return 'Unknown' } }

  $mods = @(Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue)
  $totalBytes = [int64]0
  $count = 0
  $modules = New-Object System.Collections.Generic.List[object]
  $sticks  = New-Object System.Collections.Generic.List[object]
  $maxSpd = 0
  $genCount = @{}
  foreach ($m in $mods) {
    if (-not $m -or -not $m.Capacity) { continue }
    $cap = [int64]$m.Capacity; $totalBytes += $cap; $count++
    $speedMtz = if ($m.Speed -gt 0) { [int]$m.Speed } else { 0 }
    $configuredMtz = if ($m.ConfiguredClockSpeed -gt 0) { [int]$m.ConfiguredClockSpeed } else { $speedMtz }
    if ($speedMtz -gt $maxSpd) { $maxSpd = $speedMtz }
    if ($configuredMtz -gt $maxSpd) { $maxSpd = $configuredMtz }
    $gen = Get-Gen ([int]$m.MemoryType) $speedMtz
    if (-not $genCount.ContainsKey($gen)) { $genCount[$gen] = 0 }
    $genCount[$gen]++
    $ff = Get-FF ([int]$m.FormFactor)
    $slot = Trim-String ([string]$m.DeviceLocator)
    $manufacturer = Trim-String ([string]$m.Manufacturer)
    $partNumber = Trim-String ([string]$m.PartNumber)
    $serialNumber = Trim-String ([string]$m.SerialNumber)
    $bankLabel = Trim-String ([string]$m.BankLabel)
    $capGB = [math]::Round($cap / 1073741824.0, 1)
    $voltageV = if ($m.ConfiguredVoltage -gt 0) { [math]::Round($m.ConfiguredVoltage / 1000.0, 2) } else { $null }
    # Module cũ (MemoryModule[]) — giữ để HardwareTab cũ vẫn đọc được
    $modules.Add(@{
      slot           = $slot
      sizeBytes      = $cap
      capacityGB     = $capGB
      speedMhz       = $speedMtz
      configuredMhz  = $configuredMtz
      smbiosSpeedMhz = $null
      platformMaxMhz = $null
      formFactor     = $ff
      memoryType     = $gen
      type           = $gen
      generation     = $gen
      manufacturer   = $manufacturer
      partNumber     = $partNumber
      serialNumber   = $serialNumber
      bankLabel      = $bankLabel
      deviceLocator  = $slot
      voltageV       = $voltageV
      voltageMv      = if ($voltageV -ne $null) { [int]([math]::Round($voltageV * 1000)) } else { $null }
      rank           = $null
      clTiming       = $null
    }) | Out-Null
    # Stick mới (RamStickInfo) — schema cho Dashboard flip-card
    $sticks.Add(@{
      slot         = $slot
      bankLabel    = $bankLabel
      manufacturer = $manufacturer
      partNumber   = $partNumber
      serial       = $serialNumber
      capacityGB   = [int][math]::Round($cap / 1073741824.0, 0)
      speedMTs     = $speedMtz
      memoryType   = $gen
      formFactor   = $ff
      voltageV     = $voltageV
    }) | Out-Null
  }
  # Real-time usage từ Win32_OperatingSystem (KB → bytes)
  $usedBytes = $null; $freeBytes = $null
  $usedGB = $null; $freeGB = $null; $usedPercent = $null
  try {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($os -and $os.TotalVisibleMemorySize -and $os.FreePhysicalMemory) {
      $totalOSKB = [int64]$os.TotalVisibleMemorySize
      $freeKB = [int64]$os.FreePhysicalMemory
      $freeBytes = $freeKB * 1024
      $usedBytes = ($totalOSKB - $freeKB) * 1024
      if ($totalOSKB -gt 0) {
        $usedPercent = [math]::Round((($totalOSKB - $freeKB) / $totalOSKB) * 100, 1)
        $freeGB = [math]::Round($freeBytes / 1073741824.0, 1)
        $usedGB = [math]::Round($usedBytes / 1073741824.0, 1)
      }
      # Fallback nếu Win32_PhysicalMemory trả rỗng
      if ($totalBytes -eq 0) { $totalBytes = $totalOSKB * 1024 }
    }
  } catch {}
  if ($totalBytes -eq 0) {
    $os2 = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    if ($os2) { $totalBytes = [int64]$os2.TotalVisibleMemorySize * 1024 }
  }
  $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue | Select-Object -First 1
  $csTotalBytes = if ($cs -and $cs.TotalPhysicalMemory) { [int64]$cs.TotalPhysicalMemory } else { $totalBytes }

  $totalSlots = $null
  try {
    $arr = @(Get-CimInstance Win32_PhysicalMemoryArray -ErrorAction SilentlyContinue)
    if ($arr.Count -gt 0) { $totalSlots = ($arr | Measure-Object -Property MemoryDevices -Sum).Sum }
  } catch {}
  if (-not $totalSlots -or $totalSlots -lt $count) { $totalSlots = $count }

  $memTypeOverall = 'Unknown'
  if ($genCount.Count -gt 0) { $memTypeOverall = ($genCount.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1).Key }

  $totalGB = if ($totalBytes -gt 0) { [math]::Round($totalBytes / 1073741824.0, 1) } else { $null }
  $csTotalGB = if ($csTotalBytes -gt 0) { [math]::Round($csTotalBytes / 1073741824.0, 1) } else { $null }

  @{
    totalGB         = $totalGB
    totalBytes      = $totalBytes
    csTotalGB       = $csTotalGB
    csTotalBytes    = $csTotalBytes
    usedBytes       = $usedBytes
    freeBytes       = $freeBytes
    usedGB          = $usedGB
    freeGB          = $freeGB
    usedPercent     = $usedPercent
    dimmCount       = $count
    slots           = if ($count -gt 0) { $count } else { $null }
    totalSlots      = $totalSlots
    freeSlots       = [math]::Max(0, [int]$totalSlots - $count)
    memoryType      = $memTypeOverall
    maxSpeedMhz     = if ($maxSpd -gt 0) { $maxSpd } else { $null }
    platformMaxMhz  = $null
    platformCpuName = $null
    modules         = @($modules.ToArray())
    sticks          = @($sticks.ToArray())
  }
}

# ── Disk ──────────────────────────────────────
# Lấy TẤT CẢ ổ đĩa vật lý + fallback WMI cho disk không hiện qua Get-PhysicalDisk.
#   - KHÔNG filter theo MediaType — chỉ filter disk ảo (no size, no model, missing).
#   - HDD/SSD/USB đều được đưa vào kết quả.
#   - Health = kết hợp OperationalStatus (Get-PhysicalDisk) + HealthStatus (ReliabilityCounter).
#   - Map enum int → string cho MediaType/BusType.
#   - Get-StorageReliabilityCounter để lấy temperature/wear/powerOnHours.
# Tự thoát sau 15s nếu quá chậm.
$jobs += Start-Job -ScriptBlock {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $timeoutSec = 15
  $list = New-Object System.Collections.Generic.List[object]
  $usedFallback = $false

  # Map MediaType enum int → string (Get-PhysicalDisk trên Win10/Server trả enum int)
  $mediaTypeMap = @{
    1='Unspecified'; 2='HDD'; 3='SSD'; 4='SCM'; 5='SSD'
    'Unspecified'='Unspecified'; 'HDD'='HDD'; 'SSD'='SSD'; 'SCM'='SCM'
  }
  # BusType: hỗ trợ cả string ('NVMe' — Windows 11+) và int enum (legacy).
  $busMap = @{
    'NVMe'='NVMe'; 'SATA'='SATA'; 'SAS'='SAS'; 'USB'='USB'; 'RAID'='RAID'
    'SCSI'='SCSI'; 'ATA'='ATA'; 'ATAPI'='ATAPI'; 'iSCSI'='iSCSI'
    'SD'='SD'; 'MMC'='MMC'; 'Virtual'='Virtual'
    'File-Backed Virtual'='File-Backed Virtual'; 'Storage Spaces'='Storage Spaces'
    1='SCSI'; 2='ATAPI'; 3='ATA'; 7='USB'; 8='RAID'; 9='iSCSI'
    11='SATA'; 17='SAS'; 18='SD'; 19='MMC'; 20='Virtual'
    21='File-Backed Virtual'; 22='Storage Spaces'; 23='NVMe'
  }

  function Clean-DiskString([string]$raw) {
    if (-not $raw) { return $null }
    $s = [string]$raw
    $s = $s -replace "\`0", ''
    $s = $s -replace '[\x01-\x08\x0B-\x1F]', ''
    $s = $s.Trim()
    if ($s -eq '') { return $null }
    return $s
  }

  function Get-BusName($raw) {
    if ($null -eq $raw) { return 'Unknown' }
    if ($busMap.ContainsKey($raw)) { return $busMap[$raw] }
    if ($busMap.ContainsKey([int]$raw)) { return $busMap[[int]$raw] }
    return [string]$raw
  }

  function Get-MediaTypeName($raw) {
    if ($null -eq $raw) { return 'Unspecified' }
    if ($mediaTypeMap.ContainsKey($raw)) { return $mediaTypeMap[$raw] }
    if ($mediaTypeMap.ContainsKey([int]$raw)) { return $mediaTypeMap[[int]$raw] }
    return [string]$raw
  }

  function Get-CombinedType($media, $bus) {
    if ($bus -eq 'NVMe') { return 'NVMe SSD' }
    if ($media -eq 'SSD' -and ($bus -match 'SATA' -or $bus -eq 'ATA')) { return 'SATA SSD' }
    if ($media -eq 'HDD') { return 'HDD' }
    if ($bus -eq 'USB') { return 'USB' }
    return $media
  }

  function Resolve-Health($opStatus, $rlHealth) {
    $op = if ($opStatus) { "$opStatus".ToLower() } else { '' }
    $rl = if ($rlHealth) { "$rlHealth".ToLower() } else { '' }
    if ($op -eq 'healthy' -and ($rl -eq 'healthy' -or $rl -eq '')) { return 'Healthy' }
    if ($op -eq 'warning' -or $rl -eq 'warning') { return 'Warning' }
    if ($op -in @('unhealthy','predictingfailure','degraded','error') -or $rl -eq 'unhealthy') { return 'Unhealthy' }
    return 'Unknown'
  }

  function New-DiskItem {
    param(
      $model, $mediaType, $busType, $totalBytes, $freeBytes,
      $driveLetter, $label, $health, $healthRaw,
      $serial, $firmware, $tempC, $wearPct, $powerOnHours, $iface
    )
    $totalGB = if ($totalBytes -gt 0) { [math]::Round($totalBytes / 1073741824.0, 1) } else { 0 }
    $freeGB  = if ($freeBytes  -gt 0) { [math]::Round($freeBytes  / 1073741824.0, 1) } else { 0 }
    $usedPct = if ($totalBytes -gt 0 -and $freeBytes -ge 0 -and $freeBytes -le $totalBytes) {
      [math]::Round((($totalBytes - $freeBytes) / $totalBytes) * 100, 1)
    } else { 0 }
    $capGb   = if ($totalBytes -gt 0) { [int][math]::Floor($totalBytes / 1073741824.0) } else { $null }
    $freeGb  = if ($freeBytes  -gt 0) { [int][math]::Floor($freeBytes  / 1073741824.0) } else { $null }
    $combinedType = Get-CombinedType $mediaType $busType
    $di = @{}
    $di['model']            = $model
    $di['mediaType']        = $mediaType
    $di['busType']          = $busType
    $di['totalGB']          = $totalGB
    $di['freeGB']           = $freeGB
    $di['usedPercent']      = $usedPct
    $di['driveLetter']      = $driveLetter
    $di['label']            = $label
    $di['health']           = $health
    $di['healthRaw']        = $healthRaw
    $di['tempC']            = $tempC
    $di['wearPct']          = $wearPct
    $di['powerOnHours']     = $powerOnHours
    $di['serial']           = $serial
    $di['firmware']         = $firmware
    $di['interfaceType']    = $iface
    # Legacy aliases
    $di['name']             = $model
    $di['type']             = $combinedType
    $di['capacityGb']       = $capGb
    $di['freeGb']           = $freeGb
    $di['tempC_legacy']     = $tempC
    $di['healthStatus']     = $health
    $di['mediaTypeRaw']     = $mediaType
    $di['interfaceTypeRaw'] = $busType
    $di['serialNumber']     = $serial
    $di['firmwareRevision'] = $firmware
    return $di
  }

  try {
    # Đọc TẤT CẢ physical disk; CHỈ filter disk ảo (no size, no model, missing).
    $physRaw = @(Get-PhysicalDisk -ErrorAction SilentlyContinue)
    $physDisks = @($physRaw | Where-Object {
      $_.Size -gt 0 -and
      $_.Model -ne $null -and $_.Model -ne '' -and
      "$($_.OperationalStatus)".ToLower() -notin @('missing','error','not present')
    })

    # Win32_DiskDrive fallback — bắt các disk USB/eSATA không hiện qua Get-PhysicalDisk.
    $wmiDisks = @(Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | Where-Object {
      $_.Size -gt 0 -and $_.Model -ne $null -and $_.Model -ne ''
    })

    if (($physDisks.Count -eq 0) -and ($wmiDisks.Count -eq 0)) {
      # Không tìm được gì — vẫn emit rỗng.
    } else {
      # Lấy serial/firmware từ Get-Disk nếu có.
      $diskList = @(Get-Disk -ErrorAction SilentlyContinue)
      $volumes  = @(Get-Volume -ErrorAction SilentlyContinue)
      $counters = @{}
      foreach ($p in $physDisks) {
        $uid = [string]$p.UniqueId
        try {
          $c = $p | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue
          if ($c) { $counters[$uid] = $c }
        } catch {}
      }

      # Map DiskNumber → list partition (size/free/letter/label) từ Get-Partition -Volume.
      $partVols = @{}
      foreach ($v in $volumes) {
        if ($null -eq $v -or -not $v.Size -or $v.Size -le 0) { continue }
        $p = Get-Partition -Volume $v -ErrorAction SilentlyContinue
        if ($null -eq $p) { continue }
        $dn = [string]$p.DiskNumber
        if (-not $partVols.ContainsKey($dn)) {
          $partVols[$dn] = New-Object System.Collections.Generic.List[object]
        }
        $partVols[$dn].Add([PSCustomObject]@{
          DiskNumber  = [int]$p.DiskNumber
          DriveLetter = if ($v.DriveLetter) { ([string]$v.DriveLetter).Trim() } else { '' }
          Label       = if ($v.FileSystemLabel) { ([string]$v.FileSystemLabel).Trim() } else { '' }
          Size        = [int64]$v.Size
          Free        = [int64]$v.SizeRemaining
        }) | Out-Null
      }

      $seenSerial = @{}
      foreach ($pd in $physDisks) {
        if ($sw.Elapsed.TotalSeconds -gt $timeoutSec) { break }
        $sizeBytes = [int64]$pd.Size
        $model = Clean-DiskString ([string]$pd.Model)
        if (-not $model) { continue }

        $deviceId = [string]$pd.DeviceId
        $matchingDisk = $diskList | Where-Object { $_.Number -eq $deviceId } | Select-Object -First 1
        $serial   = Clean-DiskString ([string]$matchingDisk.SerialNumber)
        $firmware = Clean-DiskString ([string]$matchingDisk.FirmwareRevision)
        if ($serial) { $seenSerial[$serial] = $true }

        $diskPartitions = @(if ($partVols.ContainsKey($deviceId)) { $partVols[$deviceId] } else { @() })

        # Aggregate size/free trên TẤT CẢ partition (kể cả Recovery/EFI không có letter).
        $totalSize = 0; $totalFree = 0
        $withLetter = @()
        foreach ($p in $diskPartitions) {
          if ($p.Size -gt 0) { $totalSize += $p.Size }
          if ($p.Free -gt 0) { $totalFree += $p.Free }
          if ($p.DriveLetter -ne '') { $withLetter += $p }
        }
        if ($totalSize -eq 0) { $totalSize = $sizeBytes }

        $primary = $null
        if ($withLetter.Count -gt 0) {
          $primary = $withLetter | Sort-Object Free -Descending | Select-Object -First 1
        }
        if (-not $primary -and $diskPartitions.Count -gt 0) {
          $primary = $diskPartitions | Sort-Object Size -Descending | Select-Object -First 1
        }
        $primaryLetter = if ($primary) { $primary.DriveLetter } else { '' }
        $primaryLabel  = if ($primary) { $primary.Label }      else { '' }

        $busName   = Get-BusName $pd.BusType
        $mediaName = Get-MediaTypeName $pd.MediaType

        # Get-StorageReliabilityCounter → health/temp/wear/powerOnHours
        $uid = [string]$pd.UniqueId
        $c   = if ($counters.ContainsKey($uid)) { $counters[$uid] } else { $null }
        $rlHealth = if ($c) { [string]$c.HealthStatus } else { '' }
        $opStatus = [string]$pd.OperationalStatus
        $health   = Resolve-Health $opStatus $rlHealth
        $healthRaw = "$opStatus" + $(if ($rlHealth) { "/$rlHealth" } else { '' })
        $tempC = if ($c -and $c.Temperature) { [int]$c.Temperature } else { $null }
        $wearPct = if ($c -and ($null -ne $c.Wear) -and ("$($c.Wear)" -ne '')) { [int]$c.Wear } else { $null }
        $powerOnHours = if ($c -and $c.PowerOnHours) { [int]$c.PowerOnHours } else { $null }

        # WMI InterfaceType (fallback)
        $wmi = $wmiDisks | Where-Object { ($_.SerialNumber -replace "\`0",'').Trim() -eq $serial -and $_.Index -eq $deviceId } | Select-Object -First 1
        if (-not $wmi) { $wmi = $wmiDisks | Where-Object { ($_.SerialNumber -replace "\`0",'').Trim() -eq $serial } | Select-Object -First 1 }
        $iface = if ($wmi) { [string]$wmi.InterfaceType } else { $null }

        $list.Add(
          (New-DiskItem $model $mediaName $busName $totalSize $totalFree $primaryLetter $primaryLabel $health $healthRaw $serial $firmware $tempC $wearPct $powerOnHours $iface)
        ) | Out-Null
      }

      # Fallback: thêm Win32_DiskDrive mà Get-PhysicalDisk bỏ sót (USB, eSATA, SCSI).
      if ($wmiDisks.Count -gt 0) {
        foreach ($w in $wmiDisks) {
          if ($sw.Elapsed.TotalSeconds -gt $timeoutSec) { break }
          $wSerial = Clean-DiskString ([string]$w.SerialNumber)
          if (-not $wSerial -or $seenSerial[$wSerial]) { continue }
          $wModel = Clean-DiskString ([string]$w.Model)
          if (-not $wModel) { continue }
          $wSize = [int64]$w.Size
          $wIdx  = [int]$w.Index
          $wIface = [string]$w.InterfaceType

          # Aggregate partitions theo DiskNumber (= w.Index).
          $wPartVols = @(if ($partVols.ContainsKey("$wIdx")) { $partVols["$wIdx"] } else { @() })
          $totalSize = 0; $totalFree = 0; $withLetter = @()
          foreach ($p in $wPartVols) {
            if ($p.Size -gt 0) { $totalSize += $p.Size }
            if ($p.Free -gt 0) { $totalFree += $p.Free }
            if ($p.DriveLetter -ne '') { $withLetter += $p }
          }
          if ($totalSize -eq 0) { $totalSize = $wSize }

          $primary = $null
          if ($withLetter.Count -gt 0) {
            $primary = $withLetter | Sort-Object Free -Descending | Select-Object -First 1
          }
          if (-not $primary -and $wPartVols.Count -gt 0) {
            $primary = $wPartVols | Sort-Object Size -Descending | Select-Object -First 1
          }
          $primaryLetter = if ($primary) { $primary.DriveLetter } else { '' }
          $primaryLabel  = if ($primary) { $primary.Label }      else { '' }

          $busName = Get-BusName $wIface
          # Bus=USB thì media = SSD/HDD theo model
          if ($wIface -match 'USB') { $mediaName = 'Unspecified' }
          elseif ($wModel -match 'SSD|NVMe') { $mediaName = 'SSD' }
          elseif ($wIface -match 'SATA|IDE|ATA') { $mediaName = 'HDD' }
          else { $mediaName = 'Unspecified' }

          $list.Add(
            (New-DiskItem $wModel $mediaName $busName $totalSize $totalFree $primaryLetter $primaryLabel 'Unknown' "$($w.Status)" $wSerial $null $null $null $null $wIface)
          ) | Out-Null
        }
      }
    }
  } catch {}

  # Lọc bỏ disk ảo / null model. Disk có totalGB=0 (unpartitioned / reserved) vẫn giữ
  # — UI sẽ hiển thị "Không xác định" thay vì ẩn hẳn.
  $final = @($list | Where-Object { $_.model })
  ,@($final)
}

# ── GPU ───────────────────────────────────────
# Dùng Get-GpuDetails ở trên (detect bytes/MB, null bytes, vendor, nvidia-smi, resolution).
# Job này chạy parallel; resolution được cache lại trong Get-GpuDetails.
$jobs += Start-Job -ScriptBlock {
  # Khai báo các helper cần dùng trong scope job (Start-Job tạo session mới).
  $ErrorActionPreference = 'SilentlyContinue'

  function Clean-GpuString([string]$raw) {
    if (-not $raw) { return $null }
    $s = [string]$raw
    $s = $s -replace "\`0", ''
    $s = $s -replace '[\x01-\x08\x0B-\x1F]', ''
    $s = $s.Trim()
    if ($s -eq '') { return $null }
    return $s
  }
  function Convert-AdapterRamToGB([int64]$ram) {
    if ($ram -le 0) { return $null }
    $fourGB = [int64]4294967296
    if ($ram -gt $fourGB) { return [math]::Round([double]$ram / 1073741824.0, 1) }
    $gb = ([double]$ram / 1048576.0) / 1024.0
    if ($gb -lt 1.0) { $gb = [double]$ram / 1073741824.0 }
    if ($gb -gt 64) { $gb = [double]$ram / 1073741824.0 }
    return [math]::Round($gb, 1)
  }
  function Convert-AdapterRamToMB([int64]$ram) {
    if ($ram -le 0) { return $null }
    $fourGB = [int64]4294967296
    if ($ram -ge $fourGB) { return [int][math]::Round([double]$ram / 1048576.0) }
    return [int]$ram
  }
  function Get-GpuVendor([string]$name, [string]$vp) {
    $hay = ''
    if ($name) { $hay += $name.ToLower() + ' ' }
    if ($vp)   { $hay += $vp.ToLower() }
    if ($hay -match 'nvidia|gtx|rtx|quadro|tesla|geforce') { return 'NVIDIA' }
    if ($hay -match 'amd|radeon|rx\s?[0-9]|vega|navi|bonaire') { return 'AMD' }
    if ($hay -match 'intel|iris|uhd|hd graphics|arc\s') { return 'Intel' }
    return 'Unknown'
  }
  function Get-PrimaryScreenResolution {
    try {
      Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
      $scr = [System.Windows.Forms.Screen]::PrimaryScreen
      if ($scr -and $scr.Bounds) { return "$($scr.Bounds.Width)x$($scr.Bounds.Height)" }
    } catch {}
    return $null
  }

  # Convert-WmiDate: Get-CimInstance trả về các trường date đã là [DateTime]
  function Convert-WmiDate([object]$val, [string]$fmt = 'yyyy-MM-dd') {
    if (-not $val) { return $null }
    try {
      if ($val -is [DateTime]) { return $val.ToString($fmt) }
      return ([Management.ManagementDateTimeConverter]::ToDateTime([string]$val)).ToString($fmt)
    } catch { return $null }
  }
  function Get-NvidiaSmiMaxPower([string]$targetName) {
    $exe = $null
    try { $exe = (Get-Command 'nvidia-smi.exe' -ErrorAction Stop).Source } catch {
      try { $exe = (Get-Command 'nvidia-smi' -ErrorAction Stop).Source } catch { return $null }
    }
    if (-not $exe) { return $null }
    try {
      $out = & $exe --query-gpu=index,name,power.max_limit --format=csv,noheader,nounits 2>$null
      if (-not $out) { return $null }
      foreach ($line in $out) {
        $parts = $line -split ','
        if ($parts.Count -lt 3) { continue }
        $gpuName = ($parts[1]).Trim()
        $wStr    = ($parts[2]).Trim()
        if ($targetName -and $gpuName -and $targetName.Trim() -eq $gpuName) {
          $w = 0.0
          if ([double]::TryParse($wStr, [ref]$w) -and $w -gt 0) { return $w }
        }
      }
      if ($out.Count -gt 0) {
        $first = ($out[0]) -split ','
        if ($first.Count -ge 3) {
          $w = 0.0
          if ([double]::TryParse(($first[2]).Trim(), [ref]$w) -and $w -gt 0) { return $w }
        }
      }
    } catch {}
    return $null
  }

  # Get screen resolution + max refresh — đơn giản hóa cho fast path (không cần C# P/Invoke).
  $resolution = $null
  $maxRefreshRateHz = $null
  try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    $scr = [System.Windows.Forms.Screen]::PrimaryScreen
    if ($scr -and $scr.Bounds) { $resolution = "$($scr.Bounds.Width)x$($scr.Bounds.Height)" }
  } catch {}
  try {
    # Lấy refresh rate từ VideoController đầu tiên
    $vc0 = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($vc0) {
      $hzs = @()
      foreach ($v in (Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)) {
        if ($v.CurrentRefreshRate -and [int]$v.CurrentRefreshRate -gt 0) { $hzs += [int]$v.CurrentRefreshRate }
      }
      if ($hzs.Count -gt 0) { $maxRefreshRateHz = ($hzs | Measure-Object -Maximum).Maximum }
    }
  } catch {}
  if (-not $resolution) { $resolution = '' }

  # VRAM detection inline (avoid scope issue with Start-Job + outer-scope functions).
  function Get-GpuVramBytesJob([string]$pnpDevId, [string]$gName, [string]$gVendor, [int64]$wmiRam) {
    # 0. iGPU không có VRAM riêng — return -1 marker (renderer sẽ hiển thị "Shared" / 0).
    if ($gName) {
      $lname = $gName.ToLower()
      if ($lname -match 'intel.*(uhd|iris|hd graphics|xe|arc graphics)' -and $lname -notmatch 'arc\s*a[3-7]') { return -1 }
    }

    # 1. Registry HardwareInformation.qwMemorySize (64-bit bytes)
    if ($pnpDevId) {
      try {
        $normPnp = $pnpDevId.Replace('\', '')
        $hwPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\"
        $subkeys = @(Get-ChildItem -Path $hwPath -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^[0-9]{4}$' })
        foreach ($sk in $subkeys) {
          $reg = Get-ItemProperty -Path $sk.PSPath -ErrorAction SilentlyContinue
          if (-not $reg -or -not $reg.MatchingDeviceId) { continue }
          $matchId = [string]$reg.MatchingDeviceId
          $normMatch = $matchId.Replace('\', '')
          if ($normPnp.StartsWith($normMatch, [StringComparison]::OrdinalIgnoreCase)) {
            if ($null -ne $reg.'HardwareInformation.qwMemorySize') {
              $v = [int64]$reg.'HardwareInformation.qwMemorySize'
              if ($v -ge 268435456 -and $v -le 68719476736) { return $v }
            }
            if ($null -ne $reg.MemorySize -and $reg.MemorySize -gt 0) {
              $v = [int64]$reg.MemorySize
              if ($v -ge 268435456 -and $v -le 68719476736) { return $v }
            }
          }
        }
      } catch {}
    }
    # 2. nvidia-smi (NVIDIA only)
    if ($gVendor -eq 'NVIDIA') {
      $exe = $null
      try { $exe = (Get-Command 'nvidia-smi.exe' -ErrorAction Stop).Source } catch {
        try { $exe = (Get-Command 'nvidia-smi' -ErrorAction Stop).Source } catch { $exe = $null }
      }
      if ($exe) {
        try {
          $out = & $exe --query-gpu=index,name,memory.total --format=csv,noheader,nounits 2>$null
          if ($out) {
            foreach ($line in $out) {
              $parts = $line -split ','
              if ($parts.Count -lt 3) { continue }
              $mb = 0.0
              if ([double]::TryParse(($parts[2]).Trim(), [ref]$mb) -and $mb -gt 0) {
                return [int64]([math]::Round($mb * 1048576))
              }
            }
          }
        } catch {}
      }
    }
    # 3. WMI AdapterRAM với overflow detection (fallback cuối).
    #    Bug phổ biến: WMI trả 4GB-1MB cho card 8GB+ do UInt32 wraparound. Detect theo tên.
    if ($wmiRam -gt 0) {
      $fourGB = [int64]4294967296
      $suspectRange = [int64]4293918720
      $upperBound = [int64]4294967295
      if ($wmiRam -gt $fourGB) { return $wmiRam }
      # WMI trong vùng overflow 4GB-1MB..4GB → check tên model để ước lượng
      if ($wmiRam -ge $suspectRange -and $wmiRam -le $upperBound -and $gName) {
        $nm = $gName.ToLower()
        $lut = @{
          'rtx 3090' = 24; 'rtx 3080 ti' = 12; 'rtx 3080' = 10; 'rtx 3070 ti' = 8
          'rtx 3070' = 8; 'rtx 4070 ti' = 12; 'rtx 4080 ti' = 16; 'rtx 4090' = 24
          'rtx 4080' = 16; 'rtx 4070 ti super' = 16; 'rtx 2080 ti' = 11; 'rtx 2080 super' = 8
          'rtx 2070 super' = 8; 'rtx 2080' = 8; 'gtx 1080 ti' = 11
          'rx 7900 xtx' = 24; 'rx 7900 xt' = 20; 'rx 7800 xt' = 16; 'rx 7700 xt' = 12
          'rx 7600' = 8; 'rx 6900 xt' = 16; 'rx 6800 xt' = 16; 'rx 6800' = 16
          'rx 6700 xt' = 12; 'rx 6700' = 10; 'rx 6600 xt' = 8; 'rx 6600' = 8
          'arc a770' = 16; 'arc b580' = 12
        }
        foreach ($k in $lut.Keys) {
          if ($nm -match [regex]::Escape($k)) { return [int64]$lut[$k] * 1073741824 }
        }
      }
      # Không match tên nào. Trả 0 để tránh hiển thị sai số PB.
      return 0
    }
    return 0
  }

  $maxDisplay = Get-MaxDisplaySettingsJob
  $resolution = if ($maxDisplay.maxResolution) { $maxDisplay.maxResolution } else { Get-PrimaryScreenResolution }
  if (-not $resolution) { $resolution = '' }
  $maxRefreshRateHz = $maxDisplay.maxRefreshRateHz

  $gpus = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)
  if ($gpus.Count -eq 0) { return ,@() }
  $list = New-Object System.Collections.Generic.List[object]

  # Bảng lookup watt cho fast path (subset phổ biến nhất — fallback khi TDP heuristic trên không match).
  $tdpTable = [ordered]@{
    'RTX 4090' = 450; 'RTX 4080 SUPER' = 320; 'RTX 4080' = 320; 'RTX 4070 Ti' = 285; 'RTX 4070 SUPER' = 220; 'RTX 4070' = 200; 'RTX 4060 Ti' = 165; 'RTX 4060' = 115
    'RTX 3090 Ti' = 450; 'RTX 3090' = 350; 'RTX 3080 Ti' = 350; 'RTX 3080' = 320; 'RTX 3070 Ti' = 290; 'RTX 3070' = 220; 'RTX 3060 Ti' = 200; 'RTX 3060' = 170; 'RTX 3050' = 130
    'RTX 2080 Ti' = 260; 'RTX 2080 SUPER' = 250; 'RTX 2080' = 225; 'RTX 2070 SUPER' = 215; 'RTX 2070' = 175; 'RTX 2060 SUPER' = 175; 'RTX 2060' = 160
    'GTX 1660 Ti' = 120; 'GTX 1660 SUPER' = 125; 'GTX 1660' = 120; 'GTX 1650 SUPER' = 100; 'GTX 1650' = 75
    'GTX 1080 Ti' = 250; 'GTX 1080' = 180; 'GTX 1070' = 150; 'GTX 1060' = 120
    'RX 7900 XTX' = 355; 'RX 7900 XT' = 315; 'RX 7800 XT' = 263; 'RX 7700 XT' = 245; 'RX 7600' = 165
    'RX 6950 XT' = 335; 'RX 6900 XT' = 300; 'RX 6800 XT' = 300; 'RX 6800' = 250; 'RX 6700 XT' = 230; 'RX 6600 XT' = 160; 'RX 6600' = 132; 'RX 6500 XT' = 107
    'Arc A770' = 225; 'Arc A750' = 225; 'Arc A580' = 185; 'Arc A380' = 75
  }

  foreach ($g in $gpus) {
    if (-not $g) { continue }
    $name = Clean-GpuString ([string]$g.Name)
    $vp   = Clean-GpuString ([string]$g.VideoProcessor)
    $vendor = Get-GpuVendor $name $vp
    $ram = [int64]$g.AdapterRAM
    # VRAM detection ưu tiên registry 64-bit / nvidia-smi (fix bug card 8GB+ hiển thị 4.0 GB).
    # -1 = card onboard (không có VRAM riêng) → renderer sẽ hiển thị "Shared" / 0.
    $vramBytes = Get-GpuVramBytesJob ([string]$g.PNPDeviceID) $name $vendor $ram
    if ($vramBytes -gt 0) {
      $vramGB = [math]::Round($vramBytes / 1073741824.0, 1)
      $vramMb = [int][math]::Round($vramBytes / 1048576.0)
    } elseif ($vramBytes -lt 0) {
      # iGPU — không dùng WMI AdapterRAM (nó là shared memory allocation, không phải VRAM).
      $vramGB = $null
      $vramMb = $null
    } else {
      $vramGB = Convert-AdapterRamToGB $ram
      $vramMb = Convert-AdapterRamToMB $ram
    }
    $driverVer = Clean-GpuString ([string]$g.DriverVersion)
    if (-not $driverVer) { $driverVer = '' }
    $adapterCompat = if ($g.AdapterCompatibility) { ([string]$g.AdapterCompatibility).Trim() } else { '' }

    # Quick TDP heuristic for fast path (chỉ một vài model phổ biến — full script có bảng đầy đủ)
    $cu = $null; $tdp = $null
    $gn = if ($name) { $name.ToLower() } else { '' }
    if ($gn -match 'rtx\s*40[6-9]0') { $cu = 9728; $tdp = 175 }
    elseif ($gn -match 'rtx\s*4090') { $cu = 16384; $tdp = 450 }
    elseif ($gn -match 'rtx\s*30[6-9]0') { $cu = 5888; $tdp = 220 }
    elseif ($gn -match 'rtx\s*3050') { $cu = 2560; $tdp = 130 }
    elseif ($gn -match 'gtx\s*16[56]0') { $cu = 1408; $tdp = 120 }
    elseif ($gn -match 'rx\s*6[7][0-9]00') { $cu = 2560; $tdp = 230 }
    elseif ($gn -match 'arc\s*a7[57]0') { $cu = 4096; $tdp = 225 }
    elseif ($gn -match 'intel.*uhd.*770') { $cu = 256; $tdp = 30 }
    elseif ($gn -match 'intel.*iris.*xe') { $cu = 768; $tdp = 28 }

    # Fallback lookup watt (model không có trong heuristic trên)
    if (-not $tdp -and $name) {
      foreach ($k in $tdpTable.Keys) {
        if ($name -match [regex]::Escape($k)) { $tdp = $tdpTable[$k]; break }
      }
    }

    # Phân loại discrete vs integrated
    $isIntegrated = $false
    $isDiscrete = $false
    if ($name) {
      $low = $name.ToLower()
      if ($low -match 'intel.*(uhd|iris|hd graphics)') { $isIntegrated = $true }
      elseif ($adapterCompat -and $adapterCompat.ToLower() -match 'amd|ati' -and $low -match 'radeon.*graphics|vega') { $isIntegrated = $true }
      elseif ($low -match 'apple') { $isIntegrated = $true }
      if (-not $isIntegrated) {
        if ($low -match 'nvidia|geforce|rtx|gtx|quadro|tesla|titan') { $isDiscrete = $true }
        elseif ($low -match 'arc\s*a[3-7]') { $isDiscrete = $true }
        elseif ($low -match 'radeon\s*rx|radeon\s*pro') { $isDiscrete = $true }
      }
    }
    $gpuType = if ($isDiscrete) { 'Discrete' } elseif ($isIntegrated) { 'Integrated' } else { 'Unknown' }

    # driverDate CIM đã trả [DateTime] — Convert-WmiDate an toàn cả 2
    $driverDateStr = Convert-WmiDate $g.DriverDate 'yyyy-MM-dd'
    $refreshHz = if ($g.CurrentRefreshRate -and [int]$g.CurrentRefreshRate -gt 0) { [int]$g.CurrentRefreshRate } else { $null }

    # nvidia-smi wattage (chỉ NVIDIA)
    $maxPowerW = $null
    if ($vendor -eq 'NVIDIA') {
      $w = Get-NvidiaSmiMaxPower $name
      if ($w -and $w -gt 0) { $maxPowerW = [math]::Round([double]$w, 1) }
    }

    # Primary marker
    $isPrimary = $false
    if ($g.CurrentHorizontalResolution -and [int]$g.CurrentHorizontalResolution -gt 0) { $isPrimary = $true }
    if (-not $isPrimary -and $list.Count -eq 0) { $isPrimary = $true }

    $list.Add(@{
      # ── Preferred fields ──
      name           = $name
      manufacturer   = $adapterCompat
      adapterRAMGB   = $vramGB
      driverVersion  = $driverVer
      driverDate     = $driverDateStr
      videoModeDesc  = if ($g.VideoModeDescription) { ([string]$g.VideoModeDescription).Trim() } else { $null }
      refreshRateHz      = $refreshHz
      maxRefreshRateHz   = $maxRefreshRateHz
      maxResolution      = $resolution
      tdpW               = $tdp
      isDiscrete     = $isDiscrete
      isIntegrated   = $isIntegrated
      type           = $gpuType
      status         = if ($g.Status) { ([string]$g.Status).Trim() } else { $null }
      pnpDeviceId    = [string]$g.PNPDeviceID

      # ── Legacy aliases ──
      model          = $name
      vramGb         = $vramGB
      vramMb         = $vramMb
      vramSharedMb   = $null
      vramType       = $null
      busWidth       = $null
      computeUnits   = $cu
      powerW         = $tdp
      vendor         = $vendor
      videoProcessor = $vp
      resolution     = $resolution
      maxPowerW      = $maxPowerW
      primary        = $isPrimary
      adapterRAM     = [int64]$ram
    }) | Out-Null
  }
  return ,@($list.ToArray())
}

# ── Mainboard / BIOS (fast) ──────────────────
$jobs += Start-Job -ScriptBlock {
  $mb = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue | Select-Object -First 1
  $bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $mb) { return $null }
  @{
    manufacturer = [string]$mb.Manufacturer
    product = [string]$mb.Product
    serial = [string]$mb.SerialNumber
    version = [string]$mb.Version
    biosVersion = if ($bios) { [string]$bios.SMBIOSBIOSVersion } else { $null }
  }
}

# ── OS (fast) ─────────────────────────────────
$jobs += Start-Job -ScriptBlock {
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $os) { return $null }
  $activated = $null
  try {
    $sla = Get-CimInstance SoftwareLicensingProduct -ErrorAction SilentlyContinue |
           Where-Object { $_.PartialProductKey -and $_.ApplicationId -match '55c92734' } |
           Select-Object -First 1
    if ($sla -and [int]$sla.LicenseStatus -eq 1) { $activated = $true } else { $activated = $false }
  } catch {}
  $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue | Select-Object -First 1
  @{
    caption = [string]$os.Caption
    version = [string]$os.Version
    build = [string]$os.BuildNumber
    arch = [string]$os.OSArchitecture
    hostname = if ($cs) { [string]$cs.Name } else { $null }
    serial = if ($cs) { [string]$cs.IdentifyingNumber } else { $null }
    activated = $activated
    installDate = $null
    lastBootTime = $null
  }
}

# ── BIOS (riêng) ──────────────────────────────
$jobs += Start-Job -ScriptBlock {
  $b = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $b) { return $null }
  $rd = $null
  try {
    if ($b.ReleaseDate) {
      $rd = Convert-WmiDate $b.ReleaseDate 'o'
    }
  } catch {}
  @{
    manufacturer = [string]$b.Manufacturer
    version = [string]$b.SMBIOSBIOSVersion
    releaseDate = $rd
    smbiosVersion = [string]$b.SMBIOSMajorVersion + '.' + [string]$b.SMBIOSMinorVersion
  }
}

# ── Battery (fast) ────────────────────────────
$jobs += Start-Job -ScriptBlock {
  $bat = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
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
  return $result
}

# ── Network (fast) ────────────────────────────
$jobs += Start-Job -ScriptBlock {
  $list = New-Object System.Collections.Generic.List[object]
  try {
    $adapters = @(Get-CimInstance Win32_NetworkAdapter -ErrorAction SilentlyContinue | Where-Object { $_.PhysicalAdapter -or $_.NetEnabled })
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
      try {
        $cfg = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter ("Index=" + $a.Index) -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($cfg -and $cfg.IPAddress) {
          foreach ($ip in $cfg.IPAddress) {
            if ($ip -match '^\d{1,3}(\.\d{1,3}){3}$') { $item.ipv4 += $ip }
            elseif ($ip -match ':') { $item.ipv6 += $ip }
          }
        }
      } catch {}
      $list.Add($item) | Out-Null
    }
  } catch {}
  return ,@($list.ToArray())
}

# Đợi và stream kết quả - ưu tiên phát ra CPU/Memory/GPU/Disk trước
$keys = @('cpu', 'memory', 'disks', 'gpu', 'mainboard', 'os', 'bios', 'battery', 'network')
$maxWaitSec = 12
$startTime = Get-Date
$completed = @{}
$pending = $jobs

while ($pending.Count -gt 0) {
  $done = @()
  foreach ($j in $pending) {
    if ($j.State -in @('Completed', 'Failed', 'Stopped')) {
      $done += $j
    }
  }
  foreach ($j in $done) {
    $idx = $jobs.IndexOf($j)
    if ($idx -lt 0) { continue }
    $key = $keys[$idx]
    $completed[$key] = $true
    $pending = $pending | Where-Object { $_ -ne $j }
    try {
      $data = Receive-Job -Job $j -Keep -ErrorAction SilentlyContinue
      Remove-Job -Job $j -Force -ErrorAction SilentlyContinue
      if ($data) { Out-Part $key $data }
      else { Out-Error $key 'null result' }
    } catch {
      Out-Error $key $_.Exception.Message
      Remove-Job -Job $j -Force -ErrorAction SilentlyContinue
    }
  }
  if (((Get-Date) - $startTime).TotalSeconds -gt $maxWaitSec) { break }
  Start-Sleep -Milliseconds 100
}

# Cleanup bất kỳ job còn lại
foreach ($j in $pending) {
  try { Stop-Job -Job $j -ErrorAction SilentlyContinue } catch {}
  try { Remove-Job -Job $j -Force -ErrorAction SilentlyContinue } catch {}
}

[Console]::Out.WriteLine('{"key":"__done__","ok":true}')
[Console]::Out.Flush()
`;

const FAST_TIMEOUT_MS = 15_000;

// Script debug đơn giản: trả raw JSON của Win32_PhysicalMemory + array counts để
// dev kiểm tra khi thông tin RAM hiển thị sai. Trả về qua Promise<string> (stdout).
const PS_DEBUG_RAM_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'

# Raw DIMMs
$dimmRaw = @()
foreach ($m in (Get-CimInstance Win32_PhysicalMemory -ErrorAction SilentlyContinue)) {
  if (-not $m) { continue }
  $dimmRaw += @{
    Tag              = [string]$m.Tag
    DeviceLocator    = [string]$m.DeviceLocator
    BankLabel        = [string]$m.BankLabel
    Capacity         = if ($m.Capacity) { [int64]$m.Capacity } else { 0 }
    Speed            = if ($m.Speed) { [int]$m.Speed } else { 0 }
    ConfiguredClockSpeed = if ($m.ConfiguredClockSpeed) { [int]$m.ConfiguredClockSpeed } else { 0 }
    MemoryType       = if ($null -ne $m.MemoryType) { [int]$m.MemoryType } else { $null }
    TypeDetail       = if ($null -ne $m.TypeDetail) { [int]$m.TypeDetail } else { $null }
    FormFactor       = if ($null -ne $m.FormFactor) { [int]$m.FormFactor } else { $null }
    Manufacturer     = [string]$m.Manufacturer
    PartNumber       = [string]$m.PartNumber
    SerialNumber     = [string]$m.SerialNumber
    ConfiguredVoltage = if ($m.ConfiguredVoltage) { [int]$m.ConfiguredVoltage } else { 0 }
    MinVoltage       = if ($m.MinVoltage) { [int]$m.MinVoltage } else { 0 }
    MaxVoltage       = if ($m.MaxVoltage) { [int]$m.MaxVoltage } else { 0 }
    TotalWidth       = if ($m.TotalWidth) { [int]$m.TotalWidth } else { 0 }
    DataWidth        = if ($m.DataWidth) { [int]$m.DataWidth } else { 0 }
    Rank             = if ($null -ne $m.Attributes) { $m.Attributes } else { $null }
    SMBIOSMemoryType = $null
  }
}

# Slot info từ Win32_PhysicalMemoryArray
$memArrays = @(Get-CimInstance Win32_PhysicalMemoryArray -ErrorAction SilentlyContinue)
$arrays = @()
foreach ($a in $memArrays) {
  $arrays += @{
    Tag           = [string]$a.Tag
    MemoryDevices = if ($a.MemoryDevices) { [int]$a.MemoryDevices } else { 0 }
    MemoryErrorCorrection = [string]$a.MemoryErrorCorrection
    MaxCapacity   = if ($a.MaxCapacity) { [int64]$a.MaxCapacity } else { 0 }
  }
}

# Total từ ComputerSystem (cross-check)
$cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue | Select-Object -First 1
$csTotal = if ($cs -and $cs.TotalPhysicalMemory) { [int64]$cs.TotalPhysicalMemory } else { 0 }

# Total từ DIMM
$dimmTotal = 0
foreach ($d in $dimmRaw) { $dimmTotal += [int64]$d.Capacity }

$result = @{
  dimms        = $dimmRaw
  dimmCount    = $dimmRaw.Count
  dimmTotalGB  = if ($dimmTotal -gt 0) { [math]::Round($dimmTotal / 1073741824.0, 1) } else { 0 }
  memoryArrays = $arrays
  csTotalGB    = if ($csTotal -gt 0) { [math]::Round($csTotal / 1073741824.0, 1) } else { 0 }
  ts           = (Get-Date).ToString('o')
}
[Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 6 -Compress))
[Console]::Out.Flush()
`;

const DEBUG_RAM_TIMEOUT_MS = 10_000;

export interface DebugRamRow {
  Tag: string;
  DeviceLocator: string;
  BankLabel: string;
  Capacity: number;
  Speed: number;
  ConfiguredClockSpeed: number;
  MemoryType: number | null;
  TypeDetail: number | null;
  FormFactor: number | null;
  Manufacturer: string;
  PartNumber: string;
  SerialNumber: string;
  ConfiguredVoltage: number;
  MinVoltage: number;
  MaxVoltage: number;
  TotalWidth: number;
  DataWidth: number;
  Rank: number | null;
  SMBIOSMemoryType: number | null;
}

export interface DebugRamResult {
  dimms: DebugRamRow[];
  dimmCount: number;
  dimmTotalGB: number;
  memoryArrays: Array<{
    Tag: string;
    MemoryDevices: number;
    MemoryErrorCorrection: string;
    MaxCapacity: number;
  }>;
  csTotalGB: number;
  ts: string;
}

/** Chạy PowerShell một lần và trả về raw JSON của Win32_PhysicalMemory +
 * Win32_PhysicalMemoryArray + Win32_ComputerSystem.TotalPhysicalMemory.
 * Dùng để debug khi thông tin RAM hiển thị sai. */
export function debugRamRaw(): Promise<DebugRamResult> {
  return new Promise<DebugRamResult>((resolve, reject) => {
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      reject(new Error(`debugRam timeout after ${DEBUG_RAM_TIMEOUT_MS}ms`));
    }, DEBUG_RAM_TIMEOUT_MS);

    runPwshScriptInline(PS_DEBUG_RAM_SCRIPT, DEBUG_RAM_TIMEOUT_MS)
      .then((r) => {
        if (killed) return;
        clearTimeout(timer);
        const trimmed = r.stdout.trim();
        if (!trimmed) {
          reject(new Error(r.stderr.trim() || "no stdout from powershell"));
          return;
        }
        try {
          const parsed = JSON.parse(trimmed) as DebugRamResult;
          resolve(parsed);
        } catch (e) {
          reject(new Error(`JSON parse error: ${(e as Error).message}\nstdout=${trimmed.slice(0, 500)}`));
        }
      })
      .catch((err) => {
        if (killed) return;
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ─── Debug: PowerShell raw Get-PhysicalDisk + Get-Disk + Get-Volume + Get-Partition ──
// Dùng khi user báo "thiếu ổ" / "sai dung lượng" / "sai model" để copy/paste debug.
//
// Trả JSON gồm:
//   - physicalDisks: array từ Get-PhysicalDisk (đầy đủ field)
//   - disks:         array từ Get-Disk (serial/firmware)
//   - partitions:    array từ Get-Partition (DiskNumber + DriveLetter + Size)
//   - volumes:       array từ Get-Volume (DriveLetter + Size + SizeRemaining)
const PS_DEBUG_DISKS_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'

$physDisks = @()
foreach ($pd in (Get-PhysicalDisk -ErrorAction SilentlyContinue)) {
  if (-not $pd) { continue }
  $physDisks += @{
    DeviceId         = [string]$pd.DeviceId
    FriendlyName     = [string]$pd.FriendlyName
    Model            = [string]$pd.Model
    MediaType        = [string]$pd.MediaType
    BusType          = if ($null -ne $pd.BusType) { $pd.BusType.ToString() } else { $null }
    BusTypeRaw       = if ($null -ne $pd.BusType) { [int]$pd.BusType } else { $null }
    HealthStatus     = [string]$pd.HealthStatus
    OperationalStatus = [string]$pd.OperationalStatus
    Size             = if ($pd.Size) { [int64]$pd.Size } else { 0 }
    SizeGB           = if ($pd.Size) { [math]::Round($pd.Size / 1073741824.0, 2) } else { 0 }
    SerialNumber     = [string]$pd.SerialNumber
    CanPool          = [string]$pd.CanPool
    Usage            = [string]$pd.Usage
  }
}

$disks = @()
foreach ($d in (Get-Disk -ErrorAction SilentlyContinue)) {
  if (-not $d) { continue }
  $disks += @{
    Number              = [int]$d.Number
    Path                = [string]$d.Path
    FriendlyName        = [string]$d.FriendlyName
    SerialNumber        = [string]$d.SerialNumber
    FirmwareRevision    = [string]$d.FirmwareRevision
    Model               = [string]$d.Model
    Size                = if ($d.Size) { [int64]$d.Size } else { 0 }
    SizeGB              = if ($d.Size) { [math]::Round($d.Size / 1073741824.0, 2) } else { 0 }
    AllocatedSize       = if ($d.AllocatedSize) { [int64]$d.AllocatedSize } else { 0 }
    PartitionStyle      = [string]$d.PartitionStyle
    OperationalStatus   = [string]$d.OperationalStatus
    HealthStatus        = [string]$d.HealthStatus
    BusType             = if ($null -ne $d.BusType) { $d.BusType.ToString() } else { $null }
  }
}

$partitions = @()
foreach ($p in (Get-Partition -ErrorAction SilentlyContinue)) {
  if (-not $p) { continue }
  $partitions += @{
    DiskNumber      = [int]$p.DiskNumber
    PartitionNumber = [int]$p.PartitionNumber
    DriveLetter     = if ($p.DriveLetter) { ([string]$p.DriveLetter).Trim() } else { $null }
    Type            = [string]$p.Type
    Size            = if ($p.Size) { [int64]$p.Size } else { 0 }
    IsHidden        = [bool]$p.IsHidden
    IsActive        = [bool]$p.IsActive
  }
}

$volumes = @()
foreach ($v in (Get-Volume -ErrorAction SilentlyContinue)) {
  if (-not $v) { continue }
  $volumes += @{
    DriveLetter       = if ($v.DriveLetter) { ([string]$v.DriveLetter).Trim() } else { $null }
    FileSystemLabel   = [string]$v.FileSystemLabel
    FileSystem        = [string]$v.FileSystem
    DriveType         = [string]$v.DriveType
    Path              = [string]$v.Path
    Size              = if ($v.Size) { [int64]$v.Size } else { 0 }
    SizeRemaining     = if ($v.SizeRemaining) { [int64]$v.SizeRemaining } else { 0 }
    SizeGB            = if ($v.Size) { [math]::Round($v.Size / 1073741824.0, 2) } else { 0 }
    HealthStatus      = [string]$v.HealthStatus
    OperationalStatus = [string]$v.OperationalStatus
  }
}

# Group partitions by DiskNumber for easy cross-reference
$partitionsByDisk = @{}
foreach ($p in $partitions) {
  $k = [string]$p.DiskNumber
  if (-not $partitionsByDisk.ContainsKey($k)) { $partitionsByDisk[$k] = @() }
  $partitionsByDisk[$k] += $p
}

$result = @{
  physicalDisks    = $physDisks
  physicalDiskCount = $physDisks.Count
  disks            = $disks
  diskCount        = $disks.Count
  partitions       = $partitions
  partitionCount   = $partitions.Count
  partitionsByDisk = $partitionsByDisk
  volumes          = $volumes
  volumeCount      = $volumes.Count
  ts               = (Get-Date).ToString('o')
}
[Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 6 -Compress))
[Console]::Out.Flush()
`;

const DEBUG_DISKS_TIMEOUT_MS = 10_000;

export interface DebugDiskPhysical {
  DeviceId: string;
  FriendlyName: string;
  Model: string;
  MediaType: string;
  BusType: string | null;
  BusTypeRaw: number | null;
  HealthStatus: string;
  OperationalStatus: string;
  Size: number;
  SizeGB: number;
  SerialNumber: string;
  CanPool: string;
  Usage: string;
}
export interface DebugDiskDisk {
  Number: number;
  Path: string;
  FriendlyName: string;
  SerialNumber: string;
  FirmwareRevision: string;
  Model: string;
  Size: number;
  SizeGB: number;
  AllocatedSize: number;
  PartitionStyle: string;
  OperationalStatus: string;
  HealthStatus: string;
  BusType: string | null;
}
export interface DebugDiskPartition {
  DiskNumber: number;
  PartitionNumber: number;
  DriveLetter: string | null;
  Type: string;
  Size: number;
  IsHidden: boolean;
  IsActive: boolean;
}
export interface DebugDiskVolume {
  DriveLetter: string | null;
  FileSystemLabel: string;
  FileSystem: string;
  DriveType: string;
  Path: string;
  Size: number;
  SizeRemaining: number;
  SizeGB: number;
  HealthStatus: string;
  OperationalStatus: string;
}
export interface DebugDisksResult {
  physicalDisks: DebugDiskPhysical[];
  physicalDiskCount: number;
  disks: DebugDiskDisk[];
  diskCount: number;
  partitions: DebugDiskPartition[];
  partitionCount: number;
  partitionsByDisk: Record<string, DebugDiskPartition[]>;
  volumes: DebugDiskVolume[];
  volumeCount: number;
  ts: string;
}

/** Chạy PowerShell một lần và trả raw JSON của Get-PhysicalDisk + Get-Disk +
 * Get-Partition + Get-Volume. Dùng để debug khi thông tin disk hiển thị sai. */
export function debugDisksRaw(): Promise<DebugDisksResult> {
  return new Promise<DebugDisksResult>((resolve, reject) => {
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      reject(new Error(`debugDisks timeout after ${DEBUG_DISKS_TIMEOUT_MS}ms`));
    }, DEBUG_DISKS_TIMEOUT_MS);

    runPwshScriptInline(PS_DEBUG_DISKS_SCRIPT, DEBUG_DISKS_TIMEOUT_MS)
      .then((r) => {
        if (killed) return;
        clearTimeout(timer);
        const trimmed = r.stdout.trim();
        if (!trimmed) {
          reject(new Error(r.stderr.trim() || "no stdout from powershell"));
          return;
        }
        try {
          const parsed = JSON.parse(trimmed) as DebugDisksResult;
          resolve(parsed);
        } catch (e) {
          reject(new Error(`JSON parse error: ${(e as Error).message}\nstdout=${trimmed.slice(0, 500)}`));
        }
      })
      .catch((err) => {
        if (killed) return;
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ─── Debug: PowerShell raw Win32_VideoController + nvidia-smi ──────────────────
// Dùng khi user báo "sai tên GPU" / "sai VRAM" / "không lấy được watt".
// Trả JSON gồm:
//   - gpus: array raw từ Win32_VideoController (không xử lý)
//   - nvidiaSmi: array từ `nvidia-smi --query-gpu=...` (rỗng nếu không có driver)
//   - primaryResolution: "1920x1080" hoặc ""
const PS_DEBUG_GPUS_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'

# Raw Win32_VideoController
$rawGpus = @()
foreach ($g in (Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)) {
  if (-not $g) { continue }
  $rawGpus += @{
    Name                       = [string]$g.Name
    AdapterRAM                 = if ($null -ne $g.AdapterRAM) { [int64]$g.AdapterRAM } else { [int64]0 }
    AdapterRAMType             = if ($null -ne $g.AdapterRAMType) { [int]$g.AdapterRAMType } else { $null }
    DriverVersion              = [string]$g.DriverVersion
    VideoProcessor             = [string]$g.VideoProcessor
    VideoMemoryType            = if ($null -ne $g.VideoMemoryType) { [int]$g.VideoMemoryType } else { $null }
    CurrentHorizontalResolution = if ($null -ne $g.CurrentHorizontalResolution) { [int]$g.CurrentHorizontalResolution } else { $null }
    CurrentVerticalResolution   = if ($null -ne $g.CurrentVerticalResolution) { [int]$g.CurrentVerticalResolution } else { $null }
    CurrentRefreshRate         = if ($null -ne $g.CurrentRefreshRate) { [int]$g.CurrentRefreshRate } else { $null }
    CurrentBitsPerPixel        = if ($null -ne $g.CurrentBitsPerPixel) { [int]$g.CurrentBitsPerPixel } else { $null }
    PNPDeviceID                = [string]$g.PNPDeviceID
    DeviceID                   = [string]$g.DeviceID
    Status                     = [string]$g.Status
    VideoModeDescription       = [string]$g.VideoModeDescription
  }
}

# nvidia-smi (chỉ có khi cài NVIDIA driver)
$nvidiaSmi = @()
try {
  $exe = $null
  try { $exe = (Get-Command 'nvidia-smi.exe' -ErrorAction Stop).Source } catch {
    try { $exe = (Get-Command 'nvidia-smi' -ErrorAction Stop).Source } catch {}
  }
  if ($exe) {
    $csv = & $exe --query-gpu=index,name,driver_version,power.max_limit,power.default_limit,power.draw,memory.total,temperature.gpu,utilization.gpu --format=csv,noheader,nounits 2>$null
    foreach ($line in $csv) {
      $parts = $line -split ','
      if ($parts.Count -lt 9) { continue }
      $nvidiaSmi += @{
        index          = [int]($parts[0].Trim())
        name           = ($parts[1]).Trim()
        driverVersion  = ($parts[2]).Trim()
        powerMaxW      = if ([double]::TryParse(($parts[3]).Trim(), [ref]$null)) { [double]($parts[3].Trim()) } else { $null }
        powerDefaultW  = if ([double]::TryParse(($parts[4]).Trim(), [ref]$null)) { [double]($parts[4].Trim()) } else { $null }
        powerDrawW     = if ([double]::TryParse(($parts[5]).Trim(), [ref]$null)) { [double]($parts[5].Trim()) } else { $null }
        memoryTotalMB  = if ([int]::TryParse(($parts[6]).Trim(), [ref]$null)) { [int]($parts[6].Trim()) } else { $null }
        tempC          = if ([int]::TryParse(($parts[7]).Trim(), [ref]$null)) { [int]($parts[7].Trim()) } else { $null }
        utilizationPct = if ([int]::TryParse(($parts[8]).Trim(), [ref]$null)) { [int]($parts[8].Trim()) } else { $null }
      }
    }
  }
} catch {}

# Primary screen resolution
$primRes = ''
try {
  Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
  $scr = [System.Windows.Forms.Screen]::PrimaryScreen
  if ($scr -and $scr.Bounds) { $primRes = "$($scr.Bounds.Width)x$($scr.Bounds.Height)" }
} catch {}

# RDNA / AMD wattage thường không public qua WMI → check registry xem có key tham chiếu không
$amdHint = $null
try {
  $hwPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\"
  $subkeys = @(Get-ChildItem -Path $hwPath -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -match '^[0-9]{4}$' })
  foreach ($sk in $subkeys) {
    $reg = Get-ItemProperty -Path $sk.PSPath -ErrorAction SilentlyContinue
    if ($reg -and $reg.DriverDesc -and $reg.DriverDesc -match 'AMD|Radeon') {
      $amdHint = @{ DriverDesc = [string]$reg.DriverDesc; DriverVersion = [string]$reg.DriverVersion; ProviderName = [string]$reg.ProviderName }
      break
    }
  }
} catch {}

$result = @{
  gpus              = $rawGpus
  gpuCount          = $rawGpus.Count
  nvidiaSmi         = $nvidiaSmi
  nvidiaSmiCount    = $nvidiaSmi.Count
  nvidiaSmiPresent  = ($nvidiaSmi.Count -gt 0)
  amdHint           = $amdHint
  primaryResolution = $primRes
  ts                = (Get-Date).ToString('o')
}
[Console]::Out.WriteLine(($result | ConvertTo-Json -Depth 6 -Compress))
[Console]::Out.Flush()
`;

const DEBUG_GPUS_TIMEOUT_MS = 10_000;

export interface DebugGpusRawGpu {
  Name: string;
  AdapterRAM: number;
  AdapterRAMType: number | null;
  DriverVersion: string;
  VideoProcessor: string;
  VideoMemoryType: number | null;
  CurrentHorizontalResolution: number | null;
  CurrentVerticalResolution: number | null;
  CurrentRefreshRate: number | null;
  CurrentBitsPerPixel: number | null;
  PNPDeviceID: string;
  DeviceID: string;
  Status: string;
  VideoModeDescription: string;
}
export interface DebugGpusNvidiaSmi {
  index: number;
  name: string;
  driverVersion: string;
  powerMaxW: number | null;
  powerDefaultW: number | null;
  powerDrawW: number | null;
  memoryTotalMB: number | null;
  tempC: number | null;
  utilizationPct: number | null;
}
export interface DebugGpusResult {
  gpus: DebugGpusRawGpu[];
  gpuCount: number;
  nvidiaSmi: DebugGpusNvidiaSmi[];
  nvidiaSmiCount: number;
  nvidiaSmiPresent: boolean;
  amdHint: { DriverDesc: string; DriverVersion: string; ProviderName: string } | null;
  primaryResolution: string;
  ts: string;
}

/** Chạy PowerShell một lần và trả raw JSON của Win32_VideoController +
 * nvidia-smi + primary screen resolution. Dùng để debug khi thông tin GPU hiển thị sai. */
export function debugGpusRaw(): Promise<DebugGpusResult> {
  return new Promise<DebugGpusResult>((resolve, reject) => {
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      reject(new Error(`debugGpus timeout after ${DEBUG_GPUS_TIMEOUT_MS}ms`));
    }, DEBUG_GPUS_TIMEOUT_MS);

    runPwshScriptInline(PS_DEBUG_GPUS_SCRIPT, DEBUG_GPUS_TIMEOUT_MS)
      .then((r) => {
        if (killed) return;
        clearTimeout(timer);
        const trimmed = r.stdout.trim();
        if (!trimmed) {
          reject(new Error(r.stderr.trim() || "no stdout from powershell"));
          return;
        }
        try {
          const parsed = JSON.parse(trimmed) as DebugGpusResult;
          resolve(parsed);
        } catch (e) {
          reject(new Error(`JSON parse error: ${(e as Error).message}\nstdout=${trimmed.slice(0, 500)}`));
        }
      })
      .catch((err) => {
        if (killed) return;
        clearTimeout(timer);
        reject(err);
      });
  });
}

export function fastStreamHardware(onPart: HardwarePartListener): { stop: () => void } {
  const scriptPath = join(tmpdir(), `lap-hw-fast-${randomBytes(6).toString("hex")}.ps1`);
  let stdoutBuf = "";
  let stopped = false;
  let doneSeen = false;
  let child: ReturnType<typeof spawn> | null = null;

  const finish = (reason: string) => {
    if (stopped) return;
    stopped = true;
    try { child?.kill(); } catch {}
    fs.unlink(scriptPath).catch(() => {});
    if (!doneSeen) {
      onPart({ key: "__error__", ok: false, error: reason, ts: Date.now() });
    }
  };

  const timer = setTimeout(() => finish(`timeout after ${FAST_TIMEOUT_MS}ms`), FAST_TIMEOUT_MS);

  fs.writeFile(scriptPath, PS_FAST_SCRIPT, "utf8").then(() => {
    if (stopped) return;
    child = spawn(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
      { windowsHide: true },
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
      if (text) console.error("[hardware-fast/powershell]", text);
    });

    child.on("error", (err) => finish(`spawn error: ${err.message}`));
    child.on("close", (code) => {
      if (doneSeen) return;
      finish(`PowerShell closed with code ${code}`);
    });
  }).catch((err) => finish(`write script error: ${err.message}`));

  return {
    stop: () => {
      clearTimeout(timer);
      finish("manually stopped");
    },
  };
}
