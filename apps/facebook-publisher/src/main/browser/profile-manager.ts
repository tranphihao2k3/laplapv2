/**
 * BrowserProfileManager — PW-001.
 *
 * Quản lý Playwright launchPersistentContext với profile riêng trong
 * app data. KHÔNG trỏ vào Chrome profile cá nhân.
 *
 * Acceptance (docs §12 PW-001):
 *  - Restart giữ session (persistent context).
 *  - Context thứ 2 cùng profile bị chặn (lock file).
 *  - Profile path KHÔNG nằm trong repo hoặc install dir.
 *
 * Lưu ý: Dùng `playwright-core` để không bắt buộc cài Chromium binary
 * (chỉ dùng khi user cấu hình). Nếu thiếu binary → throw typed error.
 */
import path from "node:path";
import fs from "node:fs/promises";
import { app } from "electron";
import { AppError } from "../../shared/errors";

const PROFILE_DIR_NAME = "browser-profile";
const LOCK_FILENAME = "profile.lock";

export type BrowserSessionStatus =
  | { kind: "unknown" }
  | { kind: "running" }
  | { kind: "not_running" }
  | { kind: "missing_binary" }
  | { kind: "lock_held" };

export class BrowserProfileManager {
  private currentContext: import("playwright-core").BrowserContext | null = null;
  private lockAcquiredAt: string | null = null;

  /** Đường dẫn tới profile persistent. */
  profileDir(): string {
    // profile nằm trong app data, không trong repo / install dir.
    return path.join(app.getPath("userData"), PROFILE_DIR_NAME);
  }

  async ensureProfileDir(): Promise<string> {
    const dir = this.profileDir();
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  /**
   * Thử acquire lock file. Nếu đã có lock cũ (crash) thì fail-fast và
   * yêu cầu cleanup manual (PW-007 sẽ phát hiện crash và clear).
   */
  private lockPath(): string {
    return path.join(this.profileDir(), LOCK_FILENAME);
  }

  async acquireLock(): Promise<boolean> {
    const dir = await this.ensureProfileDir();
    const lockPath = path.join(dir, LOCK_FILENAME);
    try {
      // O_EXCL — atomic create
      const fd = await fs.open(lockPath, "wx");
      await fd.writeFile(JSON.stringify({ acquiredAt: new Date().toISOString(), pid: process.pid }, null, 2));
      await fd.close();
      this.lockAcquiredAt = new Date().toISOString();
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") {
        return false;
      }
      throw err;
    }
  }

  async releaseLock(): Promise<void> {
    try {
      await fs.unlink(this.lockPath());
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    this.lockAcquiredAt = null;
  }

  /**
   * Khởi tạo browser context persistent. Nếu profile đang bị lock → throw.
   * Caller phải release lock khi close.
   *
   * Note: playwright-core có thể thiếu Chromium binary. Catch ENOENT
   * → trả BrowserSessionStatus "missing_binary".
   */
  async launch(input?: { channel?: string }): Promise<BrowserSessionStatus> {
    const lockOk = await this.acquireLock();
    if (!lockOk) return { kind: "lock_held" };

    const dir = await this.ensureProfileDir();
    let playwright: typeof import("playwright-core");
    try {
      playwright = await import("playwright-core");
    } catch (err) {
      await this.releaseLock();
      throw new AppError(
        "BROWSER_PLAYWRIGHT_MISSING",
        `playwright-core chưa cài: ${err instanceof Error ? err.message : String(err)}`,
        503,
      );
    }

    try {
      const context = await playwright.chromium.launchPersistentContext(dir, {
        headless: false, // PW-002 chỉ yêu cầu headed để user login/2FA.
        channel: input?.channel,
        // args: không dùng anti-detection, không proxy rotation (docs §12 PW-007).
      });
      this.currentContext = context;
      return { kind: "running" };
    } catch (err) {
      await this.releaseLock();
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Executable doesn't exist") || msg.includes("browser was not found")) {
        return { kind: "missing_binary" };
      }
      throw new AppError("BROWSER_LAUNCH_FAILED", msg, 500);
    }
  }

  async close(): Promise<void> {
    if (this.currentContext) {
      try {
        await this.currentContext.close();
      } catch {
        // ignore — close đã có thể throw khi context đã đóng.
      }
      this.currentContext = null;
    }
    await this.releaseLock();
  }

  /** Truy cập context hiện tại (cho PW-002..007). */
  context(): import("playwright-core").BrowserContext | null {
    return this.currentContext;
  }

  /** Trạng thái session. */
  status(): BrowserSessionStatus {
    if (this.currentContext) return { kind: "running" };
    return { kind: "not_running" };
  }
}