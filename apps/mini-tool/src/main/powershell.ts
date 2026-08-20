//powershell.ts
import { spawn } from "node:child_process";

export interface PwshResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function spawnPwsh(extraArgs: string[]) {
  return spawn(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", ...extraArgs],
    { windowsHide: true },
  );
}

function runPwshInternal(
  extraArgs: string[],
  timeoutMs: number,
  sink: { stdin?: string },
): Promise<PwshResult> {
  return new Promise((resolve, reject) => {
    const child = spawnPwsh(extraArgs);
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`PowerShell timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: typeof code === "number" ? code : -1,
      });
    });

    if (sink.stdin !== undefined) {
      child.stdin.write(sink.stdin, "utf8");
      child.stdin.end();
    }
  });
}

/**
 * Chạy 1 đoạn PowerShell ngắn (qua stdin). Không cần file .ps1.
 * Dùng cho hardware query where script không cần ship kèm app.
 */
export function runPwshCommand(
  command: string,
  timeoutMs = 30_000,
): Promise<PwshResult> {
  return runPwshInternal(["-Command", "-"], timeoutMs, { stdin: command });
}

/**
 * Chạy 1 file .ps1 với args. Dùng cho scripts/cleanup.ps1, disable-bitlocker.ps1, …
 */
export function runPwshScript(
  scriptPath: string,
  args: string[] = [],
  timeoutMs = 30_000,
): Promise<PwshResult> {
  return runPwshInternal(["-File", scriptPath, ...args], timeoutMs, {});
}
