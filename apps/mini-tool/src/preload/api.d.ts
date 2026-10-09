export interface IpcResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface CpuInfo {
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
}

export interface MemoryModule {
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
  /** Loại RAM (giữ legacy) — bằng memoryType */
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
}

/** Schema gọn cho từng thanh RAM (preferred cho Dashboard flip-card). */
export interface RamStickInfo {
  /** Slot label (DeviceLocator) — vd: "DIMM_A1", "BANK 0", "SODIMM1" */
  slot: string | null;
  /** BankLabel từ WMI */
  bankLabel: string | null;
  /** Manufacturer đã trim null bytes */
  manufacturer: string | null;
  /** PartNumber đã trim null bytes */
  partNumber: string | null;
  /** SerialNumber đã trim */
  serial: string | null;
  /** Dung lượng GB (làm tròn 0 chữ số) */
  capacityGB: number;
  /** Tốc độ công bố (MT/s) */
  speedMTs: number | null;
  /** Thế hệ RAM đã normalize (DDR3/DDR4/DDR5/Unknown) */
  memoryType: string | null;
  /** FormFactor (DIMM/SODIMM/MicroDIMM/RIMM/Other) */
  formFactor: string | null;
  /** Điện áp (V) — null nếu BIOS không trả */
  voltageV: number | null;
}

export interface MemoryInfo {
  // ── New (preferred) fields ──
  /** Tổng dung lượng (GB) tính từ tổng DIMM */
  totalGB: number | null;
  /** = totalGB * 1073741824 — legacy */
  totalBytes: number | null;
  /** Tổng từ Win32_ComputerSystem.TotalPhysicalMemory (GB) — cross-check */
  csTotalGB: number | null;
  /** = csTotalGB * 1073741824 */
  csTotalBytes: number | null;
  /** Used bytes (từ Win32_OperatingSystem) */
  usedBytes: number | null;
  /** Free bytes (từ Win32_OperatingSystem) */
  freeBytes: number | null;
  /** Used GB (derived) */
  usedGB: number | null;
  /** Free GB (derived) */
  freeGB: number | null;
  /** % used (0-100) */
  usedPercent: number | null;
  /** Số DIMM thực sự đang cắm */
  dimmCount: number;
  /** = dimmCount — legacy */
  slots: number | null;
  /** Tổng số slot vật lý trên mainboard */
  totalSlots: number | null;
  /** = totalSlots - dimmCount */
  freeSlots: number | null;
  /** Thế hệ RAM phổ biến nhất (vd: "DDR4", "DDR5") */
  memoryType: string | null;
  /** Tốc độ max (MT/s) trong tất cả DIMM */
  maxSpeedMhz: number | null;
  /** Tốc độ tối đa theo CPU/platform */
  platformMaxMhz: number | null;
  /** Tên CPU dùng để derive platformMaxMhz (debug) */
  platformCpuName: string | null;
  modules: MemoryModule[];
  /** Chi tiết từng thanh RAM (schema mới — preferred) */
  sticks: RamStickInfo[];
}

export interface DiskInfo {
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
   *  — kết hợp OperationalStatus + HealthStatus (ReliabilityCounter) */
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
}

export interface GpuInfo {
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
}

export interface MainboardInfo {
  manufacturer: string | null;
  product: string | null;
  serial: string | null;
  version: string | null;
  biosVersion: string | null;
}

export interface BiosInfo {
  manufacturer: string | null;
  version: string | null;
  releaseDate: string | null;
  smbiosVersion: string | null;
}

export interface BatteryInfo {
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
}

export interface OsInfo {
  caption: string | null;
  version: string | null;
  build: string | null;
  arch: string | null;
  hostname: string | null;
  serial: string | null;
  activated: boolean | null;
  installDate: string | null;
  lastBootTime: string | null;
}

export interface NetworkInfo {
  name: string | null;
  mac: string | null;
  ipv4: string[];
  ipv6: string[];
  speedMbps: number | null;
  driverVersion: string | null;
  type: string | null;
}

export interface CollectedHardware {
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
  source: string;
}

export type HardwarePartKey =
  | "cpu" | "memory" | "disks" | "gpu" | "mainboard"
  | "bios" | "battery" | "os" | "network"
  | "__done__" | "__error__";

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

export interface FurmarkDetectResult {
  found: boolean;
  path: string | null;
  source: "env" | "where" | "appdata" | "packaged" | "repo" | null;
  version: string | null;
  error?: string;
}

export interface FurmarkBenchmarkResult {
  ok: true;
  csvPath: string;
  pid: number;
  exited: boolean;
  exitCode: number | null;
  pending: boolean;
}

export interface FurmarkLatestResult {
  found: boolean;
  row: FurmarkScoreRow | null;
  csvPath: string | null;
  error?: string;
}

export interface FurmarkScoreRow {
  date: string;
  demo: string;
  platform: string;
  vendor: string;
  renderer: string;
  apiVersion: string;
  width: number;
  height: number;
  fullscreen: string;
  antialiasing: string;
  duration: number;
  maxGpuTemp: number;
  score: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
}

export interface PwshResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

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

export interface StoredSession {
  sid: string;
  uploadUrl: string;
  webUrl: string;
  expiresAt: string;
  importedAt: string;
}

export interface AudioFileInfo {
  id: string;
  title: string;
  fileName: string;
  path: string;
  url: string;
  mime: string;
  sizeBytes: number;
  durationSec: number | null;
  source: "builtin" | "user";
}

export interface UploadStatusData {
  hasSession: boolean;
  session: StoredSession | null;
  secretFingerprint: string;
  appVersion: string;
}

export interface PowerPlan {
  guid: string;
  name: string;
  isActive: boolean;
}

export interface CpuPowerState {
  ac: number;
  dc: number;
}

/* ─────────── Dashboard extra info blocks ─────────── */

export interface BatterySnapshot {
  hasBattery: boolean;
  name: string | null;
  /** 0-100 */
  percent: number | null;
  /** "Charging" | "Discharging" | "AC" | "PartiallyCharged" | "Unknown" | "Critical" */
  status: string | null;
  /** Phút còn lại nếu đang discharging, null nếu không xác định */
  minutesRemaining: number | null;
  /** W (milliwatt) — null nếu WMI không expose */
  currentDrawMw: number | null;
  voltageMv: number | null;
  chemistry: string | null;
  designCapacityMwh: number | null;
  fullChargeCapacityMwh: number | null;
  healthPct: number | null;
}

export interface DisplaySnapshot {
  monitors: DisplayMonitor[];
}

export interface DisplayMonitor {
  name: string | null;
  manufacturer: string | null;
  width: number | null;
  height: number | null;
  refreshHz: number | null;
  bitsPerPixel: number | null;
  primary: boolean;
}

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
  capturedAt: string;
}

export interface StorageDisk {
  index: number;
  mediaType: string | null;
  busType: string | null;
  model: string | null;
  serial: string | null;
  firmware: string | null;
  totalGB: number | null;
  health: string | null;
  tempC: number | null;
  wearPct: number | null;
  powerOnHours: number | null;
}

export interface WifiSnapshot {
  currentInterface: WifiInterfaceInfo | null;
  profiles: WifiProfile[];
}

export interface WifiInterfaceInfo {
  name: string | null;
  description: string | null;
  ssid: string | null;
  bssid: string | null;
  signalPct: number | null;
  signalDbm: number | null;
  radioType: string | null;
  channel: number | null;
  linkSpeedMbps: number | null;
  rxMbps: number | null;
  txMbps: number | null;
  state: string | null;
}

export interface WifiProfile {
  ssid: string;
  security: string | null;
}

export interface HdSentinelFindResult {
  found: boolean;
  path: string | null;
  version: string | null;
}

export interface StartupApp {
  name: string;
  command: string;
  location: "HKCU\\...\\Run" | "HKLM\\...\\Run" | "HKCU\\...\\RunOnce" | "HKLM\\...\\RunOnce";
  enabled: boolean;
  publisher: string | null;
  workload: "Cao" | "Vừa" | "Thấp";
  iconHint: "discord" | "steam" | "onedrive" | "nvidia" | "spotify" | "chrome" | "edge" | "app";
}

export interface LapApi {
  hardware: {
    collect: () => Promise<IpcResult<{ started: boolean }>>;
    fastCollect: () => Promise<IpcResult<{ started: boolean }>>;
    cancel: () => Promise<IpcResult<boolean>>;
    debugRam: () => Promise<IpcResult<DebugRamResult>>;
    debugDisks: () => Promise<IpcResult<DebugDisksResult>>;
    debugGpus: () => Promise<IpcResult<DebugGpusResult>>;
    onPart: (cb: (part: HardwarePart) => void) => () => void;
  };
  bench: {
    furmarkDetect: () => Promise<IpcResult<FurmarkDetectResult>>;
    furmarkLaunch: (exePath: string) => Promise<IpcResult<PwshResult>>;
    furmarkRun: (input: {
      exePath: string;
      width: number;
      height: number;
      durationSec: number;
      api?: "gl" | "vk";
    }) => Promise<IpcResult<FurmarkBenchmarkResult>>;
    furmarkReadScore: (
      csvPath: string,
    ) => Promise<IpcResult<FurmarkLatestResult>>;
    cpuBenchmark: (durationSec: number) => Promise<IpcResult<PwshResult>>;
  };
  optimize: {
    cleanTemp: () => Promise<IpcResult<PwshResult>>;
    disableBitlocker: () => Promise<IpcResult<PwshResult>>;
    renamePc: (newName: string) => Promise<IpcResult<PwshResult>>;
    setWallpaper: (filePath: string) => Promise<IpcResult<PwshResult>>;
    emptyRecycle: () => Promise<IpcResult<PwshResult>>;
    disableStartup: () => Promise<IpcResult<PwshResult>>;
    optimizeDrive: (driveLetter: string) => Promise<IpcResult<PwshResult>>;
    getDrives: () => Promise<IpcResult<PwshResult>>;
    scanWifi: () => Promise<IpcResult<PwshResult>>;
  };
  upload: {
    status: () => Promise<IpcResult<UploadStatusData>>;
    build: (input: {
      hardware?: unknown;
      benchmark?: unknown;
      tests?: unknown;
    }) => Promise<IpcResult<unknown>>;
    send: (payload: unknown) => Promise<IpcResult<unknown>>;
  };
  session: {
    get: () => Promise<IpcResult<StoredSession | null>>;
    import: (input: {
      sid: string;
      uploadUrl?: string;
      webUrl?: string;
      expiresAt?: string;
    }) => Promise<IpcResult<StoredSession | null>>;
    clear: () => Promise<IpcResult<boolean>>;
  };
  clipboard: {
    read: () => Promise<IpcResult<string>>;
  };
  audio: {
    list: () => Promise<IpcResult<{ dir: string; items: AudioFileInfo[] }>>;
    reveal: () => Promise<IpcResult<{ dir: string }>>;
    add: () => Promise<IpcResult<{ added: number; skipped: string[] }>>;
    read: (fileName: string) => Promise<IpcResult<{ mime: string; buffer: ArrayBuffer }>>;
  };
  power: {
    list: () => Promise<IpcResult<PowerPlan[]>>;
    getActive: () => Promise<IpcResult<PowerPlan>>;
    setActive: (guid: string) => Promise<IpcResult<{ ok: boolean; error?: string }>>;
    getCpuMax: () => Promise<IpcResult<CpuPowerState>>;
    setCpuMax: (
      payload: { ac: number; dc: number },
    ) => Promise<IpcResult<{ ok: boolean; error?: string }>>;
    openPanel: () => Promise<IpcResult<boolean>>;
  };
  startup: {
    list: () => Promise<IpcResult<StartupApp[]>>;
    toggle: (
      payload: { currentName: string; location: string; newEnabled: boolean },
    ) => Promise<IpcResult<{ newName: string; enabled: boolean }>>;
  };
  quickOptimize: {
    clearRam: () => Promise<
      IpcResult<{
        stdout: string;
        stderr: string;
        exitCode: number;
        beforeFreeMb: number;
        afterFreeMb: number | null;
        freedMb: number | null;
      }>
    >;
    dns: () => Promise<IpcResult<{ stdout: string; stderr: string; exitCode: number }>>;
    checkDriver: () => Promise<
      IpcResult<{
        stdout: string;
        stderr: string;
        exitCode: number;
        parsed: {
          source: "wua" | "pnp";
          count: number;
          updates: Array<{ title?: string; kb?: string; size?: number; version?: string; manufacturer?: string }>;
          ok: boolean;
        } | null;
      }>
    >;
    netSpeed: () => Promise<
      IpcResult<{
        adapters: Array<{ name: string; rxBytes: number; txBytes: number }>;
        pings: Array<{ host: string; ms: number }>;
      } | null>
    >;
  };
  shell: {
    openExternal: (url: string) => Promise<IpcResult<boolean>>;
  };
  dialog: {
    pickFile: (
      filters?: { name: string; extensions: string[] }[],
    ) => Promise<IpcResult<Electron.OpenDialogReturnValue>>;
  };
  dashboard: {
    battery: () => Promise<IpcResult<BatterySnapshot>>;
    display: () => Promise<IpcResult<DisplaySnapshot>>;
    system: () => Promise<IpcResult<SystemInfoSnapshot>>;
    storage: () => Promise<IpcResult<StorageDisk[]>>;
    wifiProfiles: () => Promise<IpcResult<WifiSnapshot>>;
    hdSentinel: {
      find: () => Promise<IpcResult<HdSentinelFindResult>>;
      launch: (exePath: string) => Promise<IpcResult<boolean>>;
    };
  };
  platform: NodeJS.Platform;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
}
