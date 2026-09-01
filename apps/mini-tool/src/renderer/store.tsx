// Lightweight store shared across tabs using React Context + useSyncExternalStore
// pattern. Avoids pulling in zustand since this is a tiny app and we want zero
// extra deps for the renderer.

import * as React from "react";
import type { CollectedHardware, StoredSession } from "./types/window";

export interface BenchmarkRecord {
  tool: string;
  score: number;
  fps?: number;
  preset?: string;
  capturedAt: string;
}

export interface TestRecord {
  type: "speaker" | "display" | "keyboard" | "mic" | "camera" | "wifi" | "touchpad";
  result: "pass" | "fail" | "skip";
  payload?: Record<string, unknown>;
  capturedAt: string;
}

export interface AppSettings {
  autoScanOnStartup: boolean;
  ktvModeDefault: boolean;
  darkTheme: boolean;
  autoTest: boolean;
  soundTestEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  autoScanOnStartup: false,
  ktvModeDefault: false,
  darkTheme: true,
  autoTest: false,
  soundTestEnabled: true,
};

export interface SessionStore {
  session: StoredSession | null;
  hardware: CollectedHardware | null;
  benchmark: BenchmarkRecord | null;
  tests: TestRecord[];
  ktvMode: boolean;
  settings: AppSettings;
  setSession: (s: StoredSession | null) => void;
  setHardware: (h: CollectedHardware | null) => void;
  setBenchmark: (b: BenchmarkRecord | null) => void;
  upsertTest: (t: TestRecord) => void;
  setKtvMode: (v: boolean) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetAll: () => void;
}

const Ctx = React.createContext<SessionStore | null>(null);

const STORAGE_KEY = "laplap-mini-tool-v1";
const HARDWARE_KEY = "laplap-mini-tool-hardware-v1";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

/**
 * Persist hardware snapshot vào localStorage để cache qua page reload.
 * Khi hardware không có (null) → xóa cache.
 */
function loadCachedHardware(): CollectedHardware | null {
  try {
    const raw = localStorage.getItem(HARDWARE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CollectedHardware;
    if (parsed && typeof parsed === "object" && "cpu" in parsed) {
      return parsed;
    }
  } catch {}
  return null;
}

function saveCachedHardware(h: CollectedHardware | null): void {
  try {
    if (!h) {
      localStorage.removeItem(HARDWARE_KEY);
      return;
    }
    localStorage.setItem(HARDWARE_KEY, JSON.stringify(h));
  } catch {
    // localStorage có thể đầy hoặc bị disable; bỏ qua.
  }
}

const initialSettings = loadSettings();
const initialHardware = loadCachedHardware();

const initial: Omit<
  SessionStore,
  | "setSession"
  | "setHardware"
  | "setBenchmark"
  | "upsertTest"
  | "setKtvMode"
  | "updateSettings"
  | "resetAll"
> = {
  session: null,
  hardware: initialHardware,
  benchmark: null,
  tests: [],
  ktvMode: initialSettings.ktvModeDefault,
  settings: initialSettings,
};

function cloneState(): Omit<SessionStore, keyof SessionStore> {
  return {
    session: initial.session,
    hardware: initial.hardware,
    benchmark: initial.benchmark,
    tests: [...initial.tests],
    ktvMode: initial.ktvMode,
    settings: { ...initial.settings },
  };
}

export function SessionStoreProvider(props: { children: React.ReactNode }) {
  const [state, setState] = React.useState(() => ({
    session: initial.session,
    hardware: initial.hardware,
    benchmark: initial.benchmark,
    tests: [...initial.tests],
    ktvMode: initial.ktvMode,
    settings: { ...initial.settings },
  }));

  const value = React.useMemo<SessionStore>(
    () => ({
      ...state,
      setSession: (session) => setState((s) => ({ ...s, session })),
      setHardware: (hardware) => {
        saveCachedHardware(hardware);
        setState((s) => ({ ...s, hardware }));
      },
      setBenchmark: (benchmark) => setState((s) => ({ ...s, benchmark })),
      upsertTest: (t) =>
        setState((s) => {
          const existingIdx = s.tests.findIndex((x) => x.type === t.type);
          if (existingIdx >= 0) {
            const next = [...s.tests];
            next[existingIdx] = t;
            return { ...s, tests: next };
          }
          return { ...s, tests: [...s.tests, t] };
        }),
      setKtvMode: (ktvMode) => setState((s) => ({ ...s, ktvMode })),
      updateSettings: (patch) =>
        setState((s) => {
          const next = { ...s.settings, ...patch };
          saveSettings(next);
          return { ...s, settings: next };
        }),
      resetAll: () => {
        saveSettings(DEFAULT_SETTINGS);
        saveCachedHardware(null);
        setState(cloneState() as never);
      },
    }),
    [state],
  );

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useSessionStore(): SessionStore {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useSessionStore must be used inside SessionStoreProvider");
  return v;
}