// Type declarations for the Electron preload bridge.
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
}

export interface MemoryInfo {
  totalBytes: number | null;
  usedBytes: number | null;
  freeBytes: number | null;
  slots: number | null;
  platformMaxMhz: number | null;
  platformCpuName: string | null;
  modules: MemoryModule[];
}

export interface DiskInfo {
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
}

export interface GpuInfo {
  name: string | null;
  driverVersion: string | null;
  vramMb: number | null;
  vramSharedMb: number | null;
  vramType: string | null;
  busWidth: number | null;
  computeUnits: number | null;
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
  source: "env" | "where" | "registry" | null;
  version: string | null;
}

export interface PwshResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface StoredSession {
  sid: string;
  uploadUrl: string;
  webUrl: string;
  expiresAt: string;
  importedAt: string;
}

export interface UploadStatusData {
  hasSession: boolean;
  session: StoredSession | null;
  secretFingerprint: string;
  appVersion: string;
}

export interface LapApi {
  hardware: {
    collect: () => Promise<IpcResult<{ started: boolean }>>;
    cancel: () => Promise<IpcResult<boolean>>;
    onPart: (cb: (part: HardwarePart) => void) => () => void;
  };
  bench: {
    furmarkDetect: () => Promise<IpcResult<FurmarkDetectResult>>;
    furmarkLaunch: (exePath: string) => Promise<IpcResult<PwshResult>>;
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
  shell: {
    openExternal: (url: string) => Promise<IpcResult<boolean>>;
  };
  dialog: {
    pickFile: (
      filters?: { name: string; extensions: string[] }[],
    ) => Promise<IpcResult<Electron.OpenDialogReturnValue>>;
  };
  platform: NodeJS.Platform;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
}

declare global {
  interface Window {
    lap: LapApi;
  }
}

export {};
