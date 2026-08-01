/**
 * M4 — Browser / Playwright adapter tests.
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import os from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../src/main/db/migrations";
import { SettingsRepository } from "../../src/main/db/repositories/settings";
import { AutoSubmitGate } from "../../src/main/browser/auto-submit-gate";
import { DiagnosticsService } from "../../src/main/browser/diagnostics-service";

let db: Database.Database;
let settings: SettingsRepository;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  settings = new SettingsRepository(db);
});

afterEach(() => db.close());

describe("AutoSubmitGate", () => {
  it("blocked: group.postingMode = 'assisted'", () => {
    const gate = new AutoSubmitGate(settings);
    const r = gate.canAutoSubmit({ groupPostingMode: "assisted" });
    expect(r.kind).toBe("blocked");
    expect(r.reason).toMatch(/postingMode/i);
  });

  it("blocked: autoSubmitGloballyAllowed = false", () => {
    settings.patch({ autoSubmitGloballyAllowed: false });
    const gate = new AutoSubmitGate(settings);
    const r = gate.canAutoSubmit({ groupPostingMode: "auto" });
    expect(r.kind).toBe("blocked");
    expect(r.reason).toMatch(/autoSubmitGloballyAllowed/i);
  });

  it("blocked: defaultPostingMode != 'auto'", () => {
    settings.patch({
      autoSubmitGloballyAllowed: true,
      defaultPostingMode: "assisted",
    });
    const gate = new AutoSubmitGate(settings);
    const r = gate.canAutoSubmit({ groupPostingMode: "auto" });
    expect(r.kind).toBe("blocked");
    expect(r.reason).toMatch(/defaultPostingMode/i);
  });

  it("allowed khi 3 flag dung", () => {
    settings.patch({
      autoSubmitGloballyAllowed: true,
      defaultPostingMode: "auto",
    });
    const gate = new AutoSubmitGate(settings);
    const r = gate.canAutoSubmit({ groupPostingMode: "auto" });
    expect(r.kind).toBe("allowed");
  });
});

describe("DiagnosticsService.redact", () => {
  it("redact cookie + Authorization", () => {
    const input = "Cookie: c_user=12345; xs=abcdef; sb=xyz\nAuthorization: Bearer eyJabc";
    const out = DiagnosticsService.redact(input);
    expect(out).not.toContain("12345");
    expect(out).not.toContain("abcdef");
    expect(out).not.toContain("eyJabc");
    expect(out).toContain("c_user=REDACTED");
    expect(out).toContain("Authorization: Bearer REDACTED");
  });

  it("không redact plain text", () => {
    const input = "Hello world, đẹp quá!";
    expect(DiagnosticsService.redact(input)).toBe("Hello world, đẹp quá!");
  });
});

describe("DiagnosticsService.cleanupExpired", () => {
  it("file cũ bị xoá (mock userData)", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "laplap-diag-"));
    try {
      // Mock app.getPath('userData') bằng cách tạo dir giả trong tmp.
      const diagDir = path.join(tmp, "diagnostics");
      await fs.mkdir(diagDir, { recursive: true });
      const old = path.join(diagDir, "old-job-step1.png");
      const fresh = path.join(diagDir, "fresh-job-step1.png");
      await fs.writeFile(old, "old");
      await fs.writeFile(fresh, "fresh");
      const oldTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await fs.utimes(old, oldTime, oldTime);

      // Override diagDir for test.
      const svc = new (class extends DiagnosticsService {
        override diagDir() {
          return diagDir;
        }
      })(settings);

      const result = await svc.cleanupExpired();
      expect(result.removed).toBe(1);
      expect(await fs.stat(fresh).catch(() => null)).not.toBeNull();
      expect(await fs.stat(old).catch(() => null)).toBeUndefined();
    } finally {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
    }
  });
});