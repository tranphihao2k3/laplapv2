//powershell.ts
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

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
  sink: { stdin?: string; scriptPath?: string },
): Promise<PwshResult> {
  return new Promise((resolve, reject) => {
    let child;
    let tempFilePath: string | null = null;
    const cleanup = () => {
      if (tempFilePath) {
        fs.unlink(tempFilePath).catch(() => {});
        tempFilePath = null;
      }
    };

    if (sink.scriptPath) {
      // Use -File with a real file (avoids the >~2KB stdin truncation bug)
      child = spawnPwsh(["-File", sink.scriptPath]);
    } else {
      child = spawnPwsh(extraArgs);
    }

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      cleanup();
      reject(new Error(`PowerShell timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
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
 * Chạy 1 đoạn PowerShell ngắn. Để tránh bug PowerShell nuốt mất output khi
 * pipe STDIN >~2KB, luôn ghi script ra temp file rồi dùng -File.
 */
export function runPwshCommand(
  command: string,
  timeoutMs = 30_000,
): Promise<PwshResult> {
  const scriptPath = join(tmpdir(), `lap-pwsh-${randomBytes(6).toString("hex")}.ps1`);
  return fs
    .writeFile(scriptPath, command, "utf8")
    .then(() => runPwshInternal([], timeoutMs, { scriptPath }));
}

/**
 * Chạy 1 file .ps1 với args. Dùng cho scripts/cleanup.ps1, disable-bitlocker.ps1, …
 */
export function runPwshScript(
  scriptPath: string,
  args: string[] = [],
  timeoutMs = 30_000,
): Promise<PwshResult> {
  return runPwshInternal([], timeoutMs, {});
}
