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
  type: "speaker" | "display" | "keyboard" | "mic" | "camera";
  result: "pass" | "fail" | "skip";
  payload?: Record<string, unknown>;
  capturedAt: string;
}

export interface SessionStore {
  session: StoredSession | null;
  hardware: CollectedHardware | null;
  benchmark: BenchmarkRecord | null;
  tests: TestRecord[];
  ktvMode: boolean;
  setSession: (s: StoredSession | null) => void;
  setHardware: (h: CollectedHardware | null) => void;
  setBenchmark: (b: BenchmarkRecord | null) => void;
  upsertTest: (t: TestRecord) => void;
  setKtvMode: (v: boolean) => void;
  resetAll: () => void;
}

const Ctx = React.createContext<SessionStore | null>(null);

const initial: Omit<
  SessionStore,
  | "setSession"
  | "setHardware"
  | "setBenchmark"
  | "upsertTest"
  | "setKtvMode"
  | "resetAll"
> = {
  session: null,
  hardware: null,
  benchmark: null,
  tests: [],
  ktvMode: false,
};

function reducer(
  state: ReturnType<typeof cloneState>,
  patch: Partial<ReturnType<typeof cloneState>>,
): ReturnType<typeof cloneState> {
  return { ...state, ...patch };
}

function cloneState() {
  return {
    session: initial.session,
    hardware: initial.hardware,
    benchmark: initial.benchmark,
    tests: [...initial.tests],
    ktvMode: initial.ktvMode,
  };
}

export function SessionStoreProvider(props: { children: React.ReactNode }) {
  const [state, setState] = React.useState(() => ({
    session: initial.session,
    hardware: initial.hardware,
    benchmark: initial.benchmark,
    tests: [...initial.tests],
    ktvMode: initial.ktvMode,
  }));

  const value = React.useMemo<SessionStore>(
    () => ({
      ...state,
      setSession: (session) => setState((s) => ({ ...s, session })),
      setHardware: (hardware) => setState((s) => ({ ...s, hardware })),
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
      resetAll: () => setState(cloneState()),
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