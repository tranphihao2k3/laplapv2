// Type declarations for the Electron preload bridge.
// This file mirrors the runtime surface exposed by `apps/mini-tool/src/preload/index.ts`
// so the renderer can use `window.lap.*` with full type-safety.

export interface IpcResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface CollectedHardware {
  cpu: {
    name: string | null;
    manufacturer: string | null;
    cores: number | null;
    threads: number | null;
    baseGhz: number | null;
    socket: string | null;
  } | null;
  memory: {
    totalBytes: number | null;
    usedBytes: number | null;
    freeBytes: number | null;
    slots: number | null;
    platformMaxMhz: number | null;
    platformCpuName: string | null;
    modules: Array<{
      sizeBytes: number | null;
      speedMhz: number | null;
      configuredMhz: number | null;
      smbiosSpeedMhz: number | null;
      platformMaxMhz: number | null;
      type: string | null;
      generation: string | null;
      manufacturer: string | null;
      slot: string | null;
    }>;
  } | null;
  disks: Array<{
    name: string | null;
    model: string | null;
    type: string | null;
    capacityGb: number | null;
    mediaType: string | null;
    interfaceType: string | null;
    pnpDeviceId: string | null;
  }>;
  gpu: Array<{
    name: string | null;
    driverVersion: string | null;
    vramMb: number | null;
  }>;
  mainboard: {
    manufacturer: string | null;
    product: string | null;
    serial: string | null;
    version: string | null;
  } | null;
  bios: {
    manufacturer: string | null;
    version: string | null;
    releaseDate: string | null;
    smbiosVersion: string | null;
  } | null;
  battery: {
    name: string | null;
    status: string | null;
    chemistry: string | null;
    designCapacityMwh: number | null;
    fullChargeCapacityMwh: number | null;
    healthPct: number | null;
    voltageMv: number | null;
  } | null;
  os: {
    caption: string | null;
    version: string | null;
    build: string | null;
    arch: string | null;
    hostname: string | null;
    serial: string | null;
    activated: boolean | null;
  } | null;
  network: Array<{
    name: string | null;
    mac: string | null;
    ipv4: string[];
    ipv6: string[];
    speedMbps: number | null;
  }>;
  collectedAt: string;
  source: "powershell";
}

export type HardwarePart =
  | { key: "cpu"; ok: true; data: CollectedHardware["cpu"]; ts: number }
  | { key: "memory"; ok: true; data: CollectedHardware["memory"]; ts: number }
  | { key: "disks"; ok: true; data: CollectedHardware["disks"]; ts: number }
  | { key: "gpu"; ok: true; data: CollectedHardware["gpu"]; ts: number }
  | { key: "mainboard"; ok: true; data: CollectedHardware["mainboard"]; ts: number }
  | { key: "bios"; ok: true; data: CollectedHardware["bios"]; ts: number }
  | { key: "battery"; ok: true; data: CollectedHardware["battery"]; ts: number }
  | { key: "os"; ok: true; data: CollectedHardware["os"]; ts: number }
  | { key: "network"; ok: true; data: CollectedHardware["network"]; ts: number }
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
  };
  optimize: {
    cleanTemp: () => Promise<IpcResult<PwshResult>>;
    disableBitlocker: () => Promise<IpcResult<PwshResult>>;
    renamePc: (newName: string) => Promise<IpcResult<PwshResult>>;
    setWallpaper: (filePath: string) => Promise<IpcResult<PwshResult>>;
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