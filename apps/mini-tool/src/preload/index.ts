import { contextBridge, ipcRenderer } from "electron";
import type {
  IpcResult,
  CollectedHardware,
  HardwarePart,
  FurmarkDetectResult,
  FurmarkBenchmarkResult,
  FurmarkLatestResult,
  FurmarkScoreRow,
  PwshResult,
  StoredSession,
  AudioFileInfo,
  PowerPlan,
  CpuPowerState,
  DebugRamResult,
  DebugDisksResult,
  DebugGpusResult,
  StartupApp,
  BatterySnapshot,
  DisplaySnapshot,
  SystemInfoSnapshot,
  StorageDisk,
  WifiSnapshot,
  HdSentinelFindResult,
} from "./api";

const invoke = <T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> =>
  ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<T>>;

const lap = {
  hardware: {
    collect: () =>
      invoke<{ started: boolean }>("lap:hardware:collect"),
    fastCollect: () =>
      invoke<{ started: boolean }>("lap:hardware:fast-collect"),
    cancel: () => invoke<boolean>("lap:hardware:cancel"),
    debugRam: () => invoke<DebugRamResult>("lap:hardware:debug-ram"),
    debugDisks: () => invoke<DebugDisksResult>("lap:hardware:debug-disks"),
    debugGpus: () => invoke<DebugGpusResult>("lap:hardware:debug-gpus"),
    onPart: (cb: (part: HardwarePart) => void) => {
      const handler = (_evt: unknown, part: HardwarePart) => cb(part);
      ipcRenderer.on("lap:hardware:part", handler);
      return () => ipcRenderer.off("lap:hardware:part", handler);
    },
    liveRead: () =>
      invoke<{
        cpu: number;
        memUsedMb: number;
        memTotalMb: number;
        memFreeMb: number;
        cpuTempC: number | null;
      }>("lap:live:read"),
  },
  bench: {
    furmarkDetect: () => invoke<FurmarkDetectResult>("lap:bench:furmark:detect"),
    furmarkLaunch: (exePath: string) =>
      invoke<PwshResult>("lap:bench:furmark:launch", exePath),
    furmarkRun: (args: {
      exePath: string;
      width: number;
      height: number;
      durationSec: number;
      api?: "gl" | "vk";
    }) => invoke<FurmarkBenchmarkResult>("lap:bench:furmark:run", args),
    furmarkReadScore: (csvPath: string) =>
      invoke<FurmarkLatestResult>("lap:bench:furmark:readScore", csvPath),
    cpuBenchmark: (durationSec: number) =>
      invoke<{ stdout: string; stderr: string; exitCode: number }>("lap:bench:cpu-benchmark", durationSec),
  },
  optimize: {
    cleanTemp: () => invoke<PwshResult>("lap:optimize:clean-temp"),
    disableBitlocker: () =>
      invoke<PwshResult>("lap:optimize:disable-bitlocker"),
    renamePc: (newName: string) =>
      invoke<PwshResult>("lap:optimize:rename-pc", newName),
    setWallpaper: (filePath: string) =>
      invoke<PwshResult>("lap:optimize:set-wallpaper", filePath),
    emptyRecycle: () => invoke<PwshResult>("lap:optimize:empty-recycle"),
    disableStartup: () => invoke<PwshResult>("lap:optimize:disable-startup"),
    optimizeDrive: (driveLetter: string) =>
      invoke<PwshResult>("lap:optimize:optimize-drive", driveLetter),
    getDrives: () =>
      invoke<{ stdout: string; stderr: string; exitCode: number }>("lap:optimize:get-drives"),
    scanWifi: () =>
      invoke<{ stdout: string; stderr: string; exitCode: number }>("lap:optimize:scan-wifi"),
  },
  upload: {
    status: () =>
      invoke<{
        hasSession: boolean;
        session: StoredSession | null;
        secretFingerprint: string;
        appVersion: string;
      }>("lap:upload:status"),
    build: (input: {
      hardware?: unknown;
      benchmark?: unknown;
      tests?: unknown;
    }) => invoke<unknown>("lap:upload:build", input),
    send: (payload: unknown) =>
      invoke<unknown>("lap:upload:send", { payload }),
  },
  session: {
    get: () => invoke<StoredSession | null>("lap:session:get"),
    import: (input: {
      sid: string;
      uploadUrl?: string;
      webUrl?: string;
      expiresAt?: string;
    }) => invoke<StoredSession | null>("lap:session:import", input),
    clear: () => invoke<boolean>("lap:session:clear"),
  },
  clipboard: {
    read: () => invoke<string>("lap:clipboard:read"),
  },
  audio: {
    list: () =>
      invoke<{ dir: string; items: AudioFileInfo[] }>("lap:audio:list"),
    reveal: () =>
      invoke<{ dir: string }>("lap:audio:reveal"),
    add: () =>
      invoke<{ added: number; skipped: string[] }>("lap:audio:add"),
    read: (fileName: string) =>
      invoke<{ mime: string; buffer: ArrayBuffer }>("lap:audio:read", fileName),
  },
  power: {
    list: () => invoke<PowerPlan[]>("lap:power:list"),
    getActive: () => invoke<PowerPlan>("lap:power:get-active"),
    setActive: (guid: string) =>
      invoke<{ ok: boolean; error?: string }>("lap:power:set-active", guid),
    getCpuMax: () => invoke<CpuPowerState>("lap:power:get-cpu-max"),
    setCpuMax: (payload: { ac: number; dc: number }) =>
      invoke<{ ok: boolean; error?: string }>("lap:power:set-cpu-max", payload),
    openPanel: () => invoke<boolean>("lap:power:open-panel"),
  },
  startup: {
    list: () => invoke<StartupApp[]>("lap:startup:list"),
    toggle: (payload: { currentName: string; location: string; newEnabled: boolean }) =>
      invoke<{ newName: string; enabled: boolean }>("lap:startup:toggle", payload),
  },
  quickOptimize: {
    clearRam: () =>
      invoke<{
        stdout: string;
        stderr: string;
        exitCode: number;
        beforeFreeMb: number;
        afterFreeMb: number | null;
        freedMb: number | null;
      }>("lap:optimize:clear-ram"),
    dns: () =>
      invoke<{ stdout: string; stderr: string; exitCode: number }>("lap:optimize:dns"),
    checkDriver: () =>
      invoke<{
        stdout: string;
        stderr: string;
        exitCode: number;
        parsed: {
          source: "wua" | "pnp";
          count: number;
          updates: Array<{ title?: string; kb?: string; size?: number; version?: string; manufacturer?: string }>;
          ok: boolean;
        } | null;
      }>("lap:optimize:check-driver"),
    netSpeed: () =>
      invoke<{
        adapters: Array<{ name: string; rxBytes: number; txBytes: number }>;
        pings: Array<{ host: string; ms: number }>;
      } | null>("lap:optimize:net-speed"),
  },
  shell: {
    openExternal: (url: string) =>
      invoke<boolean>("lap:shell:open-external", url),
  },
  dialog: {
    pickFile: (filters?: { name: string; extensions: string[] }[]) =>
      invoke<Electron.OpenDialogReturnValue>("lap:dialog:pick-file", {
        filters,
      }),
  },
  dashboard: {
    battery: () => invoke<BatterySnapshot>("lap:dashboard:battery"),
    display: () => invoke<DisplaySnapshot>("lap:dashboard:display"),
    system: () => invoke<SystemInfoSnapshot>("lap:dashboard:system"),
    storage: () => invoke<StorageDisk[]>("lap:dashboard:storage"),
    wifiProfiles: () => invoke<WifiSnapshot>("lap:dashboard:wifi-profiles"),
    hdSentinel: {
      find: () => invoke<HdSentinelFindResult>("lap:dashboard:hd-sentinel:find"),
      launch: (exePath: string) =>
        invoke<boolean>("lap:dashboard:hd-sentinel:launch", exePath),
    },
  },
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
};

export type LapApi = typeof lap;

contextBridge.exposeInMainWorld("lap", lap);