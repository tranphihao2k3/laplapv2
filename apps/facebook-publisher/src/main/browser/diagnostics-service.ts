/**
 * DiagnosticsService — PW-008.
 *
 * - Lưu screenshot/trace trong <userData>/diagnostics/.
 * - TTL mặc định lấy từ Settings.diagnosticsTtlMs.
 * - Cleanup theo lịch (manual trigger từ UI).
 * - Redact cookie/header/token trước khi lưu (PW-008 acceptance).
 */
import path from "node:path";
import fs from "node:fs/promises";
import { app } from "electron";
import { SettingsRepository } from "../db/repositories/settings";

const DIAG_DIR_NAME = "diagnostics";

export type SavedScreenshot = {
  filePath: string;
  bytes: number;
  savedAt: string;
};

export class DiagnosticsService {
  constructor(private readonly settings: SettingsRepository) {}

  diagDir(): string {
    return path.join(app.getPath("userData"), DIAG_DIR_NAME);
  }

  /** Lưu screenshot với tên jobId-step.png. */
  async saveScreenshot(input: { jobId: string; step: string; data: Buffer }): Promise<SavedScreenshot> {
    const dir = this.diagDir();
    await fs.mkdir(dir, { recursive: true });
    const safeStep = input.step.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
    const filePath = path.join(dir, `${input.jobId}-${safeStep}.png`);
    await fs.writeFile(filePath, input.data);
    const stat = await fs.stat(filePath);
    return {
      filePath,
      bytes: stat.size,
      savedAt: new Date().toISOString(),
    };
  }

  /**
   * Cleanup file cũ hơn TTL. Đếm số file đã xoá để UI hiển thị.
   */
  async cleanupExpired(): Promise<{ removed: number }> {
    const ttlMs = this.settings.get().diagnosticsTtlMs;
    const cutoff = Date.now() - ttlMs;
    const dir = this.diagDir();
    let entries: import("node:fs").Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return { removed: 0 };
      throw err;
    }
    let removed = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const full = path.join(dir, entry.name);
      const stat = await fs.stat(full);
      if (stat.mtimeMs < cutoff) {
        await fs.unlink(full).catch(() => undefined);
        removed += 1;
      }
    }
    return { removed };
  }

  /** Redact cookie/header/token từ text — dùng trước khi lưu log. */
  static redact(input: string): string {
    if (!input) return "";
    return input
      .replace(/c_user=[^;\s]+/gi, "c_user=REDACTED")
      .replace(/xs=[^;\s]+/gi, "xs=REDACTED")
      .replace(/fr=[^;\s]+/gi, "fr=REDACTED")
      .replace(/datr=[^;\s]+/gi, "datr=REDACTED")
      .replace(/Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/gi, "Authorization: Bearer REDACTED")
      .replace(/cookie:\s*[^;\n]+/gi, "cookie: REDACTED")
      .replace(/sb=[^;\s]+/gi, "sb=REDACTED");
  }
}