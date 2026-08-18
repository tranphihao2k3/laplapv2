import { createHmac } from "node:crypto";
import { app } from "electron";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

function readSecret(): string | null {
  const filePath = path.join(app.getAppPath(), ".secret");
  if (existsSync(filePath)) {
    try {
      const raw = readFileSync(filePath, "utf8").trim();
      if (raw) return raw;
    } catch {
      /* swallow */
    }
  }
  const env = process.env["LAPLAP_MINI_TOOL_SECRET"]?.trim();
  if (env) return env;
  return null;
}

export function getSecret(): string {
  const secret = readSecret();
  if (!secret) {
    if (app.isPackaged) {
      throw new Error(
        "Missing LAPLAP_MINI_TOOL_SECRET (file ./.secret or env var required in production)",
      );
    }
    return "dev-only-insecure-secret-do-not-ship";
  }
  return secret;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalize(v)).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k]))
      .join(",") +
    "}"
  );
}

export function sign(payload: unknown, secret?: string): string {
  const key = secret ?? getSecret();
  const canonical = canonicalize(payload);
  return createHmac("sha256", key).update(canonical).digest("hex");
}

export function getSecretFingerprint(): string {
  try {
    const key = getSecret();
    return createHmac("sha256", key).update("laplap-mini-tool-fingerprint").digest("hex").slice(0, 12);
  } catch {
    return "unconfigured";
  }
}