export interface IpcResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface CollectedHardware {
  cpu: unknown | null;
  memory: unknown | null;
  diskLayout: unknown[] | null;
  graphics: unknown | null;
  system: unknown | null;
  battery: unknown | null;
  osInfo: unknown | null;
  networkInterfaces: unknown[] | null;
  baseboard: unknown | null;
  bios: unknown | null;
  collectedAt: string;
}

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
    collect: () => Promise<IpcResult<CollectedHardware>>;
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