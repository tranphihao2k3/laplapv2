// power.ts — Wrapper for `powercfg.exe` to read/write Windows power plans
//
// Read operations (list / getactivescheme / query) do NOT require admin.
// Write operations (setactive, setacvalueindex, setdcvalueindex) DO require
// admin rights. When the app is not run elevated, Windows will show a UAC
// prompt. We surface the underlying error verbatim to the renderer.
//
// All process spawns use `execFile`/`spawn` with an argument array so no shell
// expansion happens. `powercfg.exe` always lives in `%SystemRoot%\System32`
// but it is reachable through `PATH` on Windows so we call it by name.

import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const POWERCFG = "powercfg.exe";
const TIMEOUT_MS = 15_000;
const MAX_BUFFER = 1024 * 1024 * 4; // 4MB

export type PowerPlan = {
  guid: string;
  name: string;
  isActive: boolean;
};

export type CpuPowerState = {
  ac: number;
  dc: number;
};

function ensureWindows(): void {
  if (process.platform !== "win32") {
    throw new Error("Tính năng chỉ hỗ trợ Windows");
  }
}

function parseHexOrDec(raw: string): number {
  const s = raw.trim();
  const parsed = s.toLowerCase().startsWith("0x")
    ? parseInt(s.slice(2), 16)
    : parseInt(s, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validateGuid(guid: unknown): string {
  if (typeof guid !== "string") {
    throw new Error("GUID không hợp lệ");
  }
  const trimmed = guid.trim();
  if (
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      trimmed,
    )
  ) {
    throw new Error("GUID không hợp lệ");
  }
  return trimmed.toLowerCase();
}

function clampPercent(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new Error("Giá trị phải là số");
  }
  const v = Math.round(n);
  if (v < 1 || v > 100) {
    throw new Error("Giá trị phải từ 1 đến 100%");
  }
  return v;
}

function execPowercfg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(POWERCFG, args, {
    timeout: TIMEOUT_MS,
    windowsHide: true,
    maxBuffer: MAX_BUFFER,
  }) as unknown as Promise<{ stdout: string; stderr: string }>;
}

export async function listPowerPlans(): Promise<PowerPlan[]> {
  ensureWindows();
  const { stdout } = await execPowercfg(["/list"]);
  const plans: PowerPlan[] = [];
  const lines = stdout.split(/\r?\n/);
  for (const line of lines) {
    // Sample lines:
    //   Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced) *
    //   Power Scheme GUID: 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c  (High performance)
    const m = line.match(/Power Scheme GUID:\s*([0-9a-fA-F-]+)\s*\(([^)]*)\)/);
    if (!m) continue;
    const guid = m[1].toLowerCase();
    const name = m[2].trim() || "(unnamed)";
    const isActive = line.includes("*");
    plans.push({ guid, name, isActive });
  }
  if (plans.length === 0) {
    throw new Error("Không đọc được danh sách power plans");
  }
  return plans;
}

export async function getActivePowerPlan(): Promise<PowerPlan> {
  ensureWindows();
  const { stdout } = await execPowercfg(["/getactivescheme"]);
  const m = stdout.match(/Power Scheme GUID:\s*([0-9a-fA-F-]+)\s*\(([^)]*)\)/);
  if (!m) {
    throw new Error("Không đọc được power plan hiện tại");
  }
  return {
    guid: m[1].toLowerCase(),
    name: m[2].trim() || "(unnamed)",
    isActive: true,
  };
}

export async function setActivePowerPlan(guid: unknown): Promise<void> {
  ensureWindows();
  const safeGuid = validateGuid(guid);
  await execPowercfg(["/setactive", safeGuid]);
}

export async function getCpuMaxProcessorState(): Promise<CpuPowerState> {
  ensureWindows();
  const { stdout } = await execPowercfg([
    "/query",
    "SCHEME_CURRENT",
    "SUB_PROCESSOR",
    "PROCTHROTTLEMAX",
  ]);
  // Sample:
  //   Current AC Power Setting Index: 0x00000064
  //   Current DC Power Setting Index: 0x00000064
  const acMatch = stdout.match(
    /Current\s+AC\s+Power\s+Setting\s+Index:\s*(0x[0-9a-fA-F]+|\d+)/i,
  );
  const dcMatch = stdout.match(
    /Current\s+DC\s+Power\s+Setting\s+Index:\s*(0x[0-9a-fA-F]+|\d+)/i,
  );
  return {
    ac: acMatch ? parseHexOrDec(acMatch[1]) : 100,
    dc: dcMatch ? parseHexOrDec(dcMatch[1]) : 100,
  };
}

export async function setCpuMaxProcessorState(
  ac: unknown,
  dc: unknown,
): Promise<void> {
  ensureWindows();
  const acVal = clampPercent(ac);
  const dcVal = clampPercent(dc);
  const baseArgs = [
    "SCHEME_CURRENT",
    "SUB_PROCESSOR",
    "PROCTHROTTLEMAX",
  ];
  await execPowercfg(["/setacvalueindex", ...baseArgs, String(acVal)]);
  await execPowercfg(["/setdcvalueindex", ...baseArgs, String(dcVal)]);
  // Activate so the new values take effect immediately.
  await execPowercfg(["/setactive", "SCHEME_CURRENT"]);
}

export function openWindowsPowerPanel(): void {
  ensureWindows();
  // Spawn detached + unref so we don't block on the panel closing.
  const child = spawn(
    "control.exe",
    ["/name", "Microsoft.PowerOptions"],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    },
  );
  child.unref();
}
