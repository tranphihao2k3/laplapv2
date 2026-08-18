import { spawn } from "node:child_process";

export interface FurmarkDetectResult {
  found: boolean;
  path: string | null;
  source: "env" | "where" | "registry" | null;
  version: string | null;
}

const COMMON_NAMES = ["furmark.exe", "FurMark.exe", "FurMark_2.exe"];

function runWhere(): Promise<string[]> {
  return new Promise((resolve) => {
    const child = spawn("where.exe", COMMON_NAMES, { windowsHide: true });
    let out = "";
    child.stdout.on("data", (c: Buffer) => {
      out += c.toString("utf8");
    });
    child.on("close", () => {
      resolve(
        out
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
    });
    child.on("error", () => resolve([]));
  });
}

export async function detectFurmark(): Promise<FurmarkDetectResult> {
  const env = process.env["FURMARK_PATH"];
  if (env && env.toLowerCase().endsWith(".exe")) {
    return { found: true, path: env, source: "env", version: null };
  }

  const where = await runWhere();
  if (where.length > 0) {
    return { found: true, path: where[0] ?? null, source: "where", version: null };
  }

  return { found: false, path: null, source: null, version: null };
}