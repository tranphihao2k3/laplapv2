import { contextBridge, ipcRenderer } from "electron";
import type {
  IpcResult,
  CollectedHardware,
  HardwarePart,
  FurmarkDetectResult,
  PwshResult,
  StoredSession,
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
  },
  optimize: {
    cleanTemp: () => invoke<PwshResult>("lap:optimize:clean-temp"),
    disableBitlocker: () =>
      invoke<PwshResult>("lap:optimize:disable-bitlocker"),
    renamePc: (newName: string) =>
      invoke<PwshResult>("lap:optimize:rename-pc", newName),
    setWallpaper: (filePath: string) =>
      invoke<PwshResult>("lap:optimize:set-wallpaper", filePath),
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