// dashboard.ts — Các PowerShell/WMI query phục vụ các card bổ sung trên Dashboard.
// Bao gồm:
//   • Battery (Pin)            — Win32_Battery + BatteryStatus
//   • Display (Màn hình)       — WMI Win32_DesktopMonitor + Win32_VideoController
//   • System Info (Thông tin máy) — Win32_BaseBoard + Win32_BIOS + Win32_ComputerSystem + Win32_OperatingSystem
//   • Storage detail (Ổ cứng) — Win32_DiskDrive + Get-StorageReliabilityCounter
//   • WiFi profiles            — `netsh wlan show profiles` + `netsh wlan show interfaces`
//   • HD Sentinel              — probe known install paths để mở app khi user click
//
// Tất cả script đều dùng `-NoProfile` (qua powershell.ts) + timeout hợp lý + handle
// null/empty gracefully. Lỗi trả về { ok: false, error } thay vì throw.

import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { runPwshCommand } from "./powershell";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractFirstJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // ConvertTo-Json in PowerShell có thể trả về array nếu 1 phần tử.
  if (trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fall through */
    }
  }
  const start = trimmed.indexOf("{");
  if (start < 0) return null;
  // Tìm closing brace cân bằng
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(trimmed.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Battery — phần trăm pin, trạng thái sạc, thời gian còn lại
// ─────────────────────────────────────────────────────────────────────────────

export interface BatterySnapshot {
  hasBattery: boolean;
  name: string | null;
  percent: number | null;
  /** "Charging" | "Discharging" | "AC" | "Unknown" */
  status: string | null;
  /** Phút còn lại nếu đang discharging (Win32_Battery.EstimatedRunTime, 71582788 = unknown) */
  minutesRemaining: number | null;
  /** Watt hiện tại (chỉ trả về nếu WMI expose) */
  currentDrawMw: number | null;
  voltageMv: number | null;
  chemistry: string | null;
  designCapacityMwh: number | null;
  fullChargeCapacityMwh: number | null;
  healthPct: number | null;
}

const BATTERY_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $b) {
  @{ hasBattery = $false } | ConvertTo-Json -Compress
  return
}

$statusMap = @{
  1 = 'Discharging'
  2 = 'AC'
  3 = 'Charging'
  4 = 'Critical'
  5 = 'Charging'
  6 = 'Charging'
  7 = 'Charging'
  8 = 'Charging'
  9 = 'Charging'
  10 = 'Unknown'
  11 = 'PartiallyCharged'
}
$statusText = if ($statusMap.ContainsKey([int]$b.BatteryStatus)) { $statusMap[[int]$b.BatteryStatus] } else { 'Unknown' }

# EstimatedRunTime = 71582788 means "unknown" in WMI spec.
$runMin = $null
if ($b.EstimatedRunTime -and [int]$b.EstimatedRunTime -gt 0 -and [int]$b.EstimatedRunTime -ne 71582788) {
  $runMin = [int]$b.EstimatedRunTime
}

$design = if ($b.DesignCapacity) { [int]$b.DesignCapacity } else { $null }
$full   = if ($b.FullChargeCapacity) { [int]$b.FullChargeCapacity } else { $null }
$health = $null
if ($design -and $full -and $design -gt 0) { $health = [int]([math]::Round(($full / $design) * 100, 0)) }

@{
  hasBattery            = $true
  name                  = [string]$b.Name
  percent               = if ($b.EstimatedChargeRemaining -ge 0) { [int]$b.EstimatedChargeRemaining } else { $null }
  status                = $statusText
  minutesRemaining      = $runMin
  currentDrawMw         = $null
  voltageMv             = $null
  chemistry             = [string]$b.Chemistry
  designCapacityMwh     = $design
  fullChargeCapacityMwh = $full
  healthPct             = $health
} | ConvertTo-Json -Compress
`;

export async function readBattery(timeoutMs = 8_000): Promise<BatterySnapshot> {
  const result = await runPwshCommand(BATTERY_SCRIPT, timeoutMs);
  const data = extractFirstJsonObject(result.stdout);
  if (!data || typeof data !== "object") {
    return { hasBattery: false, name: null, percent: null, status: null, minutesRemaining: null, currentDrawMw: null, voltageMv: null, chemistry: null, designCapacityMwh: null, fullChargeCapacityMwh: null, healthPct: null };
  }
  const o = data as Record<string, unknown>;
  return {
    hasBattery: Boolean(o.hasBattery),
    name: (o.name as string | null) ?? null,
    percent: typeof o.percent === "number" ? (o.percent as number) : null,
    status: (o.status as string | null) ?? null,
    minutesRemaining: typeof o.minutesRemaining === "number" ? (o.minutesRemaining as number) : null,
    currentDrawMw: typeof o.currentDrawMw === "number" ? (o.currentDrawMw as number) : null,
    voltageMv: typeof o.voltageMv === "number" ? (o.voltageMv as number) : null,
    chemistry: (o.chemistry as string | null) ?? null,
    designCapacityMwh: typeof o.designCapacityMwh === "number" ? (o.designCapacityMwh as number) : null,
    fullChargeCapacityMwh: typeof o.fullChargeCapacityMwh === "number" ? (o.fullChargeCapacityMwh as number) : null,
    healthPct: typeof o.healthPct === "number" ? (o.healthPct as number) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Display — monitor name, resolution, refresh rate (multi-monitor)
//
// CÁCH HOẠT ĐỘNG (3 lớp, từ chính xác nhất → fallback):
//  1. [System.Windows.Forms.Screen]::AllScreens  — cho bounds, primary, bpp
//     thật (Windows Forms luôn có sẵn trong PowerShell 5.1+).
//  2. EnumDisplaySettings + EnumDisplayDevices (P/Invoke) — refresh rate +
//     DeviceID thật (\\.\DISPLAY1 → MONITOR\<VENDOR>\...) cho mỗi màn
//     (Win32_VideoController chỉ trả về màn primary).
//  3. Registry HKLM\SYSTEM\CurrentControlSet\Enum\DISPLAY  — map
//     DeviceID → FriendlyName EDID thật. Tên thường có dạng
//     "Generic Monitor (Mi Monitor)" — ta lấy phần trong ngoặc.
//  Fallback cuối: Win32_DesktopMonitor (thường trả 0×0 trên máy hiện đại).
// ─────────────────────────────────────────────────────────────────────────────

export interface DisplaySnapshot {
  monitors: DisplayMonitor[];
}

export interface DisplayMonitor {
  name: string | null;
  manufacturer: string | null;
  /** Pixel width */
  width: number | null;
  /** Pixel height */
  height: number | null;
  /** Refresh rate hiện tại (Hz) */
  refreshHz: number | null;
  /** Bits per pixel */
  bitsPerPixel: number | null;
  /** True nếu là màn hình chính */
  primary: boolean;
}

const DISPLAY_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$monitors = @()

# P/Invoke: EnumDisplaySettings (refresh rate per monitor) +
#            EnumDisplayDevices (map \\.\DISPLAY{N} → MONITOR\<VENDOR>\... DeviceID)
$pinvoke = @"
using System;
using System.Runtime.InteropServices;

public class DConfig {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern bool EnumDisplaySettingsW(string deviceName, int modeNum, ref DEVMODE devMode);

  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern bool EnumDisplayDevicesW(string deviceName, uint deviceNum, ref DISPLAY_DEVICE lpDisplayDevice, uint flags);

  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DISPLAY_DEVICE {
    public int cb;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)]
    public string DeviceName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)]
    public string DeviceString;
    public int StateFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)]
    public string DeviceID;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=128)]
    public string DeviceKey;
  }

  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct DEVMODE {
    private const int CCHDEVICENAME = 32;
    private const int CCHFORMNAME = 32;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=CCHDEVICENAME)]
    public string dmDeviceName;
    public short dmSpecVersion;
    public short dmDriverVersion;
    public short dmSize;
    public short dmDriverExtra;
    public int dmFields;
    public int dmPositionX;
    public int dmPositionY;
    public int dmDisplayOrientation;
    public int dmDisplayFixedOutput;
    public short dmColor;
    public short dmDuplex;
    public short dmYResolution;
    public short dmTTOption;
    public short dmCollate;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=CCHFORMNAME)]
    public string dmFormName;
    public short dmLogPixels;
    public int dmBitsPerPel;
    public int dmPelsWidth;
    public int dmPelsHeight;
    public int dmDisplayFlags;
    public int dmDisplayFrequency;
    public int dmICMMethod;
    public int dmICMIntent;
    public int dmMediaType;
    public int dmDitherType;
    public int dmReserved1;
    public int dmReserved2;
    public int dmPanningWidth;
    public int dmPanningHeight;
  }
}
"@
try { Add-Type -TypeDefinition $pinvoke -Language CSharp -ErrorAction Stop | Out-Null } catch {}

# Helper: tách tên thật từ FriendlyName.
# Format Windows trả: "@drivers\dxgkrnl.sys,#303;Generic Monitor (Mi Monitor)"
# → lấy phần trong ngoặc ngoài cùng nếu khớp pattern "Generic Monitor (...)".
function Extract-ModelName([string]$raw) {
  if (-not $raw) { return $null }
  # Format thường gặp: "Generic Monitor (Mi Monitor)" hoặc
  # "...;Generic Monitor (%1);(Mi Monitor)" — lấy phần (...) ở cuối string
  if ($raw -match '\(([A-Za-z0-9][^()]*)\)\s*$') { return $matches[1] }
  if ($raw -match 'Generic Monitor') { return $null }
  if ($raw -match '@') {
    $parts = $raw -split ';' | Select-Object -Last 1
    if ($parts -ne $raw) { return $parts.Trim() }
  }
  return $raw
}

# Map vendor prefix (trong registry HKLM\...\Enum\DISPLAY\<VENDOR>\...) → tên hãng
$vendorMap = @{
  'VSC' = 'ViewSonic'
  'XMI' = 'Xiaomi'
  'DEL' = 'Dell'
  'LGD' = 'LG'
  'SAM' = 'Samsung'
  'ACR' = 'Acer'
  'HWP' = 'HP'
  'AUS' = 'ASUS'
  'BNQ' = 'BenQ'
  'PHL' = 'Philips'
  'AOC' = 'AOC'
  'LEN' = 'Lenovo'
  'GSM' = 'LG'
  'MEI' = 'Meizu'
  'SHP' = 'Sharp'
  'SEC' = 'Samsung'
  'IVM' = 'Iiyama'
  'HTC' = 'Hitachi'
  'NEC' = 'NEC'
  'TAT' = 'Tatung'
  'MAX' = 'Maxdata'
  'FUS' = 'Fujitsu'
  'SNY' = 'Sony'
  'TOS' = 'Toshiba'
  'EIZ' = 'EIZO'
  'VIZ' = 'Vizio'
  'MTC' = 'Mitsubishi'
  'WDE' = 'Westinghouse'
  'MED' = 'Medion'
  'DWE' = 'Daewoo'
  'GQY' = 'Sharp'
}
function Vendor-ToName([string]$vendorKey) {
  if (-not $vendorKey) { return $null }
  $prefix = $vendorKey.Substring(0, [Math]::Min(3, $vendorKey.Length))
  if ($vendorMap.ContainsKey($prefix)) { return $vendorMap[$prefix] }
  return $null
}

# 1) Lấy danh sách màn từ System.Windows.Forms (luôn có sẵn)
$formsMonitors = @()
try {
  Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop | Out-Null
  $formsMonitors = [System.Windows.Forms.Screen]::AllScreens
} catch {}

# 2) Với mỗi màn → EnumDisplaySettings + EnumDisplayDevices
for ($idx = 0; $idx -lt $formsMonitors.Count; $idx++) {
  $m = $formsMonitors[$idx]
  $bounds = $m.Bounds
  $w = [int]$bounds.Width
  $h = [int]$bounds.Height
  $bpp = [int]$m.BitsPerPixel
  $isPrimary = $m.Primary
  $deviceName = $m.DeviceName  # vd: \\.\DISPLAY1

  # EnumDisplaySettings → refresh rate hiện tại
  $hz = $null
  $devMode = New-Object 'DConfig+DEVMODE'
  $devMode.dmSize = [System.Runtime.InteropServices.Marshal]::SizeOf($devMode)
  try {
    $ok = [DConfig]::EnumDisplaySettingsW($deviceName, -1, [ref]$devMode)
    if ($ok -and $devMode.dmDisplayFrequency -gt 0) {
      $hz = [int]$devMode.dmDisplayFrequency
    }
  } catch {}

  # EnumDisplayDevices → DeviceID (vd: MONITOR\VSC2F3F\4&4adc2ae&0&UID4146)
  # QUAN TRỌNG: dùng flags=0, KHÔNG dùng EDD_GET_DEVICE_INTERFACE_NAME (0x1)
  # vì flag 0x1 trả format \\?\DISPLAY#... không match registry.
  $deviceId = $null
  $dispDev = New-Object 'DConfig+DISPLAY_DEVICE'
  $dispDev.cb = [System.Runtime.InteropServices.Marshal]::SizeOf($dispDev)
  try {
    $ok = [DConfig]::EnumDisplayDevicesW($deviceName, 0, [ref]$dispDev, 0)
    if ($ok) {
      $deviceId = $dispDev.DeviceID  # MONITOR\<VENDOR>\{...}\... hoặc null
    }
  } catch {}

  # Lookup registry theo DeviceID
  $name = $null
  $manufacturer = $null
  if ($deviceId) {
    try {
      # DeviceID từ EnumDisplayDevices có format: MONITOR\<VENDOR>\{CLASS-GUID}\<NUM>
      # Còn registry thật ở: HKLM:\SYSTEM\CurrentControlSet\Enum\DISPLAY\<VENDOR>\<INSTANCE_ID>
      # Trick: cắt phần sau MONITOR\<VENDOR>\ → {GUID}\<NUM>, rồi so khớp với
      # property "Driver" của từng instance trong registry để tìm đúng instance.
      $deviceId = $deviceId.Trim()
      $vendorKey = $deviceId.Split('\')[1]
      $vendorPath = 'HKLM:\SYSTEM\CurrentControlSet\Enum\DISPLAY\' + $vendorKey
      $instances = Get-Item -Path (Join-Path $vendorPath '*') -ErrorAction SilentlyContinue
      foreach ($inst in $instances) {
        $drv = (Get-ItemProperty -Path $inst.PSPath -Name 'Driver' -ErrorAction SilentlyContinue).Driver
        if ($drv -and $deviceId.EndsWith($drv)) {
          $fn = (Get-ItemProperty -Path $inst.PSPath -Name 'FriendlyName' -ErrorAction SilentlyContinue).FriendlyName
          $name = Extract-ModelName $fn
          $manufacturer = Vendor-ToName $vendorKey
          if (-not $name) { $name = $vendorKey }
          break
        }
      }
    } catch {}
  }

  $monitors += @{
    name         = $name
    manufacturer = $manufacturer
    width        = $w
    height       = $h
    refreshHz    = $hz
    bitsPerPixel = $bpp
    primary      = $isPrimary
    deviceName   = $deviceName
  }
}

# 3) Fallback: nếu Screen.AllScreens rỗng (rất hiếm) → Win32_DesktopMonitor
if (-not $monitors -or $monitors.Count -eq 0) {
  try {
    $mons = Get-CimInstance Win32_DesktopMonitor -ErrorAction SilentlyContinue
    $i = 0
    foreach ($mm in $mons) {
      if (-not $mm.Name) { continue }
      $monitors += @{
        name         = Extract-ModelName ([string]$mm.Name)
        manufacturer = [string]$mm.MonitorManufacturer
        width        = if ($mm.ScreenWidth -gt 0) { [int]$mm.ScreenWidth } else { $null }
        height       = if ($mm.ScreenHeight -gt 0) { [int]$mm.ScreenHeight } else { $null }
        refreshHz    = $null
        bitsPerPixel = $null
        primary      = ($i -eq 0)
        deviceName   = $null
      }
      $i++
    }
  } catch {}
}

@{
  monitors = @($monitors)
} | ConvertTo-Json -Depth 6 -Compress
`;

export async function readDisplay(timeoutMs = 10_000): Promise<DisplaySnapshot> {
  const result = await runPwshCommand(DISPLAY_SCRIPT, timeoutMs);
  const data = extractFirstJsonObject(result.stdout);
  if (!data || typeof data !== "object") {
    return { monitors: [] };
  }
  const o = data as { monitors?: unknown };
  const arr = Array.isArray(o.monitors) ? o.monitors : [];
  const monitors: DisplayMonitor[] = arr.map((m) => {
    const x = (m ?? {}) as Record<string, unknown>;
    const asStr = (v: unknown): string | null =>
      typeof v === "string" && v.trim() ? (v as string).trim() : null;
    const asNum = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? (v as number) : null;
    return {
      name: asStr(x.name),
      manufacturer: asStr(x.manufacturer),
      width: asNum(x.width),
      height: asNum(x.height),
      refreshHz: asNum(x.refreshHz),
      bitsPerPixel: asNum(x.bitsPerPixel),
      primary: Boolean(x.primary),
    };
  });
  return { monitors };
}

// ─────────────────────────────────────────────────────────────────────────────
// System info — mainboard + BIOS + OS + machine model
// ─────────────────────────────────────────────────────────────────────────────

export interface SystemInfoSnapshot {
  mainboard: {
    manufacturer: string | null;
    product: string | null;
    serial: string | null;
    version: string | null;
  };
  bios: {
    manufacturer: string | null;
    version: string | null;
    releaseDate: string | null;
    smbiosVersion: string | null;
  };
  machine: {
    manufacturer: string | null;
    model: string | null;
    systemType: string | null;
    totalPhysicalMemoryGB: number | null;
    /** "OK" | "Degraded" | "Unknown" | … */
    status: string | null;
  };
  os: {
    caption: string | null;
    version: string | null;
    build: string | null;
    arch: string | null;
    hostname: string | null;
    installDate: string | null;
    lastBootTime: string | null;
  };
  /** Thời điểm snapshot ISO */
  capturedAt: string;
}

const SYSTEM_INFO_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'

# Get-CimInstance trả về InstallDate/LastBootUpTime/ReleaseDate đã là DateTime
# (khác với Get-WmiObject trả về CIM_DATETIME string). Helper này xử lý cả 2.
function Convert-WmiDate([object]$val, [string]$fmt = 'yyyy-MM-dd') {
  if (-not $val) { return $null }
  try {
    if ($val -is [DateTime]) { return $val.ToString($fmt) }
    return ([Management.ManagementDateTimeConverter]::ToDateTime([string]$val)).ToString($fmt)
  } catch { return $null }
}

$mb = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue | Select-Object -First 1
$bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue | Select-Object -First 1
$cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue | Select-Object -First 1
$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue | Select-Object -First 1

$memoryGB = $null
if ($cs -and $cs.TotalPhysicalMemory -and $cs.TotalPhysicalMemory -gt 0) {
  $memoryGB = [math]::Round([double]$cs.TotalPhysicalMemory / 1073741824, 1)
}

@{
  mainboard = @{
    manufacturer = if ($mb) { [string]$mb.Manufacturer } else { $null }
    product      = if ($mb) { [string]$mb.Product } else { $null }
    serial       = if ($mb) { [string]$mb.SerialNumber } else { $null }
    version      = if ($mb) { [string]$mb.Version } else { $null }
  }
  bios = @{
    manufacturer  = if ($bios) { [string]$bios.Manufacturer } else { $null }
    version       = if ($bios) { [string]$bios.SMBIOSBIOSVersion } else { $null }
    releaseDate   = Convert-WmiDate $bios.ReleaseDate 'yyyy-MM-dd'
    smbiosVersion = if ($bios) { [string]$bios.SMBIOSMajorVersion + '.' + [string]$bios.SMBIOSMinorVersion } else { $null }
  }
  machine = @{
    manufacturer         = if ($cs) { [string]$cs.Manufacturer } else { $null }
    model                = if ($cs) { [string]$cs.Model } else { $null }
    systemType           = if ($cs) { [string]$cs.SystemType } else { $null }
    totalPhysicalMemoryGB = $memoryGB
    status               = if ($cs) { [string]$cs.Status } else { $null }
  }
  os = @{
    caption      = if ($os) { [string]$os.Caption } else { $null }
    version      = if ($os) { [string]$os.Version } else { $null }
    build        = if ($os) { [string]$os.BuildNumber } else { $null }
    arch         = if ($os) { [string]$os.OSArchitecture } else { $null }
    hostname     = if ($cs) { [string]$cs.Name } else { $null }
    installDate  = Convert-WmiDate $os.InstallDate 'yyyy-MM-dd'
    lastBootTime = Convert-WmiDate $os.LastBootUpTime 'yyyy-MM-ddTHH:mm:ss'
  }
} | ConvertTo-Json -Depth 5 -Compress
`;

export async function readSystemInfo(timeoutMs = 12_000): Promise<SystemInfoSnapshot> {
  const empty = {
    mainboard: { manufacturer: null, product: null, serial: null, version: null },
    bios: { manufacturer: null, version: null, releaseDate: null, smbiosVersion: null },
    machine: { manufacturer: null, model: null, systemType: null, totalPhysicalMemoryGB: null, status: null },
    os: { caption: null, version: null, build: null, arch: null, hostname: null, installDate: null, lastBootTime: null },
    capturedAt: new Date().toISOString(),
  } satisfies SystemInfoSnapshot;
  try {
    const result = await runPwshCommand(SYSTEM_INFO_SCRIPT, timeoutMs);
    const data = extractFirstJsonObject(result.stdout);
    if (!data || typeof data !== "object") return empty;
    const o = data as Record<string, Record<string, unknown>>;
    const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? (v as string).trim() : null);
    const asNum = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? (v as number) : null);
    const mb = o.mainboard ?? {};
    const bios = o.bios ?? {};
    const machine = o.machine ?? {};
    const os = o.os ?? {};
    return {
      mainboard: {
        manufacturer: asStr(mb.manufacturer),
        product: asStr(mb.product),
        serial: asStr(mb.serial),
        version: asStr(mb.version),
      },
      bios: {
        manufacturer: asStr(bios.manufacturer),
        version: asStr(bios.version),
        releaseDate: asStr(bios.releaseDate),
        smbiosVersion: asStr(bios.smbiosVersion),
      },
      machine: {
        manufacturer: asStr(machine.manufacturer),
        model: asStr(machine.model),
        systemType: asStr(machine.systemType),
        totalPhysicalMemoryGB: asNum(machine.totalPhysicalMemoryGB),
        status: asStr(machine.status),
      },
      os: {
        caption: asStr(os.caption),
        version: asStr(os.version),
        build: asStr(os.build),
        arch: asStr(os.arch),
        hostname: asStr(os.hostname),
        installDate: asStr(os.installDate),
        lastBootTime: asStr(os.lastBootTime),
      },
      capturedAt: new Date().toISOString(),
    };
  } catch {
    return empty;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage detail — physical disks + health + temperature (nếu có)
// ─────────────────────────────────────────────────────────────────────────────

export interface StorageDisk {
  index: number;
  /** "Internal" | "External" | "Unknown" */
  mediaType: string | null;
  /** NVMe / SATA / USB / SAS / RAID / Unknown */
  busType: string | null;
  model: string | null;
  serial: string | null;
  firmware: string | null;
  totalGB: number | null;
  /** Healthy / Warning / Unhealthy / Unknown */
  health: string | null;
  /** °C nếu Storage Reliability Counter expose; null nếu không */
  tempC: number | null;
  /** Wear % (SSD); null nếu HDD hoặc không expose */
  wearPct: number | null;
  powerOnHours: number | null;
}

const STORAGE_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$disks = @()

try {
  $pd = Get-PhysicalDisk -ErrorAction SilentlyContinue
  foreach ($d in $pd) {
    $health = if ($d.HealthStatus) { [string]$d.HealthStatus } else { 'Unknown' }
    $oper = if ($d.OperationalStatus) { [string]$d.OperationalStatus } else { '' }
    $mergedHealth = $health
    if ($oper -and $oper -ne 'OK' -and $oper -ne 'Healthy') { $mergedHealth = 'Warning' }

    $tempC = $null
    $wear = $null
    $powerHours = $null
    try {
      $uniqueId = [string]$d.UniqueId
      if ($uniqueId) {
        $reliability = Get-StorageReliabilityCounter -PhysicalDisk $d -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($reliability) {
          if ($null -ne $reliability.Temperature) { $tempC = [int]$reliability.Temperature }
          if ($null -ne $reliability.Wear) { $wear = [int]$reliability.Wear }
          if ($null -ne $reliability.PowerOnHours) { $powerHours = [int]$reliability.PowerOnHours }
        }
      }
    } catch {}

    $totalGB = $null
    if ($d.Size -and $d.Size -gt 0) { $totalGB = [math]::Round([double]$d.Size / 1073741824, 1) }

    $disks += @{
      index         = [int]$d.DeviceId
      mediaType     = if ($d.MediaType) { [string]$d.MediaType } else { 'Unknown' }
      busType       = if ($d.BusType) { [string]$d.BusType } else { 'Unknown' }
      model         = if ($d.Model) { ([string]$d.Model).Trim() } else { $null }
      serial        = if ($d.SerialNumber) { ([string]$d.SerialNumber).Trim() } else { $null }
      firmware      = $null
      totalGB       = $totalGB
      health        = $mergedHealth
      tempC         = $tempC
      wearPct       = $wear
      powerOnHours  = $powerHours
    }
  }
} catch {}

@{
  disks = @($disks)
} | ConvertTo-Json -Depth 5 -Compress
`;

export async function readStorageDetail(timeoutMs = 15_000): Promise<StorageDisk[]> {
  try {
    const result = await runPwshCommand(STORAGE_SCRIPT, timeoutMs);
    const data = extractFirstJsonObject(result.stdout);
    if (!data || typeof data !== "object") return [];
    const o = data as { disks?: unknown };
    const arr = Array.isArray(o.disks) ? o.disks : [];
    const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? (v as string).trim() : null);
    const asNum = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? (v as number) : null);
    return arr.map((d) => {
      const x = (d ?? {}) as Record<string, unknown>;
      return {
        index: typeof x.index === "number" ? (x.index as number) : 0,
        mediaType: asStr(x.mediaType),
        busType: asStr(x.busType),
        model: asStr(x.model),
        serial: asStr(x.serial),
        firmware: asStr(x.firmware),
        totalGB: asNum(x.totalGB),
        health: asStr(x.health),
        tempC: asNum(x.tempC),
        wearPct: asNum(x.wearPct),
        powerOnHours: asNum(x.powerOnHours),
      };
    });
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WiFi profiles — saved profiles + current interface + signal
// ─────────────────────────────────────────────────────────────────────────────

export interface WifiSnapshot {
  /** Adapter WiFi đang kết nối (interface hiện tại), null nếu không có */
  currentInterface: WifiInterfaceInfo | null;
  /** Danh sách SSID đã lưu profile */
  profiles: WifiProfile[];
}

export interface WifiInterfaceInfo {
  name: string | null;
  description: string | null;
  ssid: string | null;
  bssid: string | null;
  signalPct: number | null;
  /** Signal tính theo dBm (suy ra từ %) */
  signalDbm: number | null;
  radioType: string | null;
  channel: number | null;
  /** Tốc độ link (Mbps) */
  linkSpeedMbps: number | null;
  /** Receive rate hiện tại (Mbps) */
  rxMbps: number | null;
  /** Transmit rate hiện tại (Mbps) */
  txMbps: number | null;
  state: string | null;
}

export interface WifiProfile {
  ssid: string;
  /** "Open" | "WPA2-Personal" | … */
  security: string | null;
}

const WIFI_PROFILES_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'

$profiles = @()
try {
  $raw = & netsh.exe wlan show profiles 2>&1 | Out-String
  foreach ($line in ($raw -split "\\r?\\n")) {
    if ($line -match '^\s*(?:All User Profile|Profile)\s*:\s*(.+?)\s*$') {
      $ssid = $matches[1].Trim()
      if ($ssid -and $ssid -ne '') {
        # Lấy Security (WPA2/WPA3/…) qua sub-call; bỏ nếu fail.
        $sec = $null
        try {
          $secRaw = & netsh.exe wlan show profile name="$ssid" 2>&1 | Out-String
          foreach ($sline in ($secRaw -split "\\r?\\n")) {
            if ($sline -match 'Authentication\s*:\s*(.+)') { $sec = $matches[1].Trim() }
          }
        } catch {}
        $profiles += @{
          ssid     = $ssid
          security = $sec
        }
      }
    }
  }
} catch {}

# Lấy interface hiện tại + signal
$iface = $null
try {
  $raw = & netsh.exe wlan show interfaces 2>&1 | Out-String
  $name = $null
  $desc = $null
  $ssid = $null
  $bssid = $null
  $pct = $null
  $radio = $null
  $channel = $null
  $rx = $null
  $tx = $null
  $state = $null
  foreach ($line in ($raw -split "\\r?\\n")) {
    if ($line -match '^\s*Name\s*:\s*(.+)') { $name = $matches[1].Trim() }
    elseif ($line -match '^\s*Description\s*:\s*(.+)') { $desc = $matches[1].Trim() }
    elseif ($line -match '^\s*State\s*:\s*(.+)') { $state = $matches[1].Trim() }
    elseif ($line -match '^\s*SSID\s*:\s*(.+)') { $ssid = $matches[1].Trim() }
    elseif ($line -match '^\s*BSSID\s*:\s*([0-9a-f:]+)') { $bssid = $matches[1].Trim() }
    elseif ($line -match '^\s*Signal\s*:\s*(\d+)%') { $pct = [int]$matches[1] }
    elseif ($line -match '^\s*Radio type\s*:\s*(.+)') { $radio = $matches[1].Trim() }
    elseif ($line -match '^\s*Channel\s*:\s*(\d+)') { $channel = [int]$matches[1] }
    elseif ($line -match '^\s*Receive rate.*?(\d+(?:\.\d+)?)\s*(Mbps|Gbps)') {
      $v = [double]$matches[1]
      if ($matches[2] -eq 'Gbps') { $v = $v * 1000 }
      $rx = [int][math]::Round($v)
    }
    elseif ($line -match '^\s*Transmit rate.*?(\d+(?:\.\d+)?)\s*(Mbps|Gbps)') {
      $v = [double]$matches[1]
      if ($matches[2] -eq 'Gbps') { $v = $v * 1000 }
      $tx = [int][math]::Round($v)
    }
  }
  $dbm = $null
  if ($null -ne $pct -and $pct -ge 0 -and $pct -le 100) {
    # Heuristic: -100 dBm @ 0%, -30 dBm @ 100% (đúng cho client Windows).
    $dbm = [int]([math]::Round(-100 + ($pct * 0.7)))
  }
  $iface = @{
    name          = $name
    description   = $desc
    ssid          = $ssid
    bssid         = $bssid
    signalPct     = $pct
    signalDbm     = $dbm
    radioType     = $radio
    channel       = $channel
    linkSpeedMbps = $null
    rxMbps        = $rx
    txMbps        = $tx
    state         = $state
  }
} catch {}

@{
  currentInterface = $iface
  profiles         = @($profiles)
} | ConvertTo-Json -Depth 6 -Compress
`;

export async function readWifiProfiles(timeoutMs = 15_000): Promise<WifiSnapshot> {
  try {
    const result = await runPwshCommand(WIFI_PROFILES_SCRIPT, timeoutMs);
    const data = extractFirstJsonObject(result.stdout);
    if (!data || typeof data !== "object") {
      return { currentInterface: null, profiles: [] };
    }
    const o = data as Record<string, unknown>;
    const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? (v as string).trim() : null);
    const asNum = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? (v as number) : null);

    let currentInterface: WifiInterfaceInfo | null = null;
    if (o.currentInterface && typeof o.currentInterface === "object") {
      const x = o.currentInterface as Record<string, unknown>;
      currentInterface = {
        name: asStr(x.name),
        description: asStr(x.description),
        ssid: asStr(x.ssid),
        bssid: asStr(x.bssid),
        signalPct: asNum(x.signalPct),
        signalDbm: asNum(x.signalDbm),
        radioType: asStr(x.radioType),
        channel: asNum(x.channel),
        linkSpeedMbps: asNum(x.linkSpeedMbps),
        rxMbps: asNum(x.rxMbps),
        txMbps: asNum(x.txMbps),
        state: asStr(x.state),
      };
    }

    const arr = Array.isArray(o.profiles) ? o.profiles : [];
    const profiles: WifiProfile[] = arr
      .map((p) => {
        const x = (p ?? {}) as Record<string, unknown>;
        return {
          ssid: asStr(x.ssid) ?? "",
          security: asStr(x.security),
        };
      })
      .filter((p) => p.ssid.length > 0);

    return { currentInterface, profiles };
  } catch {
    return { currentInterface: null, profiles: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HD Sentinel — probe install paths + open
// ─────────────────────────────────────────────────────────────────────────────

const HD_SENTINEL_CANDIDATES = [
  "C:\\Program Files\\Hard Disk Sentinel\\HD_Sentinel.exe",
  "C:\\Program Files (x86)\\Hard Disk Sentinel\\HD_Sentinel.exe",
  "C:\\Program Files\\Hard Disk Sentinel Pro\\HD_Sentinel.exe",
  "C:\\Program Files (x86)\\Hard Disk Sentinel Pro\\HD_Sentinel.exe",
];

export interface HdSentinelResult {
  found: boolean;
  path: string | null;
  /** Phiên bản (nếu lấy được từ FileVersionInfo) */
  version: string | null;
}

export async function findHdSentinel(): Promise<HdSentinelResult> {
  for (const candidate of HD_SENTINEL_CANDIDATES) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) {
        return { found: true, path: candidate, version: null };
      }
    } catch {
      /* try next */
    }
  }
  return { found: false, path: null, version: null };
}

/**
 * Khởi chạy HD Sentinel đã cài đặt. Trả về kết quả cho renderer show toast
 * tương ứng. KHÔNG truyền -RunAs vì một số bản sẽ không chạy nếu main process
 * chưa được elevate; thử đơn giản trước rồi fallback nếu cần.
 */
export async function launchHdSentinel(
  exePath: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!exePath || typeof exePath !== "string") {
    return { ok: false, error: "Đường dẫn không hợp lệ" };
  }
  try {
    await fs.access(exePath);
  } catch {
    return { ok: false, error: "File không tồn tại" };
  }
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    try {
      const child = spawn(exePath, [], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      let settled = false;
      const finish = (r: { ok: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        resolve(r);
      };
      child.once("error", (err) => finish({ ok: false, error: err.message }));
      child.once("spawn", () => {
        // Không giữ process con → trả về ok ngay.
        child.unref();
        finish({ ok: true });
      });
      // Fallback timeout: một số exe (đặc biệt HD Sentinel) không emit 'spawn'
      // khi detached. Nếu 2s không có error thì coi như đã launch thành công.
      setTimeout(() => finish({ ok: true }), 2_000);
    } catch (err) {
      resolve({ ok: false, error: (err as Error).message });
    }
  });
}
