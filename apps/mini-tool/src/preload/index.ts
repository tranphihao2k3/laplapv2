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
} from "./api";

const invoke = <T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> =>
  ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<T>>;

const lap = {
  hardware: {
    collect: () =>
      invoke<{ started: boolean }>("lap:hardware:collect"),
    cancel: () => invoke<boolean>("lap:hardware:cancel"),
    onPart: (cb: (part: HardwarePart) => void) => {
      const handler = (_evt: unknown, part: HardwarePart) => cb(part);
      ipcRenderer.on("lap:hardware:part", handler);
      return () => ipcRenderer.off("lap:hardware:part", handler);
    },
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
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
};

export type LapApi = typeof lap;

contextBridge.exposeInMainWorld("lap", lap);