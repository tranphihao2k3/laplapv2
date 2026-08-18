import { spawn } from "node:child_process";
import path from "node:path";

export interface PwshResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function runPwsh(
  scriptPath: string,
  args: string[] = [],
  timeoutMs: number = 30_000,
): Promise<PwshResult> {
  return new Promise((resolve, reject) => {
    const fullArgs = [
      "-NoLogo",
      "-ExecutionPolicy",
      "Bypass",
      "-NoProfile",
      "-File",
      path.resolve(scriptPath),
      ...args,
    ];

    const child = spawn("powershell.exe", fullArgs, {
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error(`PowerShell timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const exitCode = typeof code === "number" ? code : -1;
      if (exitCode !== 0) {
        reject(
          new Error(
            `PowerShell exited with code ${exitCode}: ${stderr || stdout}`.trim(),
          ),
        );
        return;
      }
      resolve({ stdout, stderr, exitCode });
    });
  });
}