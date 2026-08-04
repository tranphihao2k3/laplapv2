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
    const acquired = await this.tryAcquire(lockPath);
    if (acquired) return true;
    // Lock đã tồn tại — kiểm tra có phải stale (process chết) không.
    // Nếu stale → xóa và retry 1 lần. Đây là cách Chromium/Chrome tự
    // recovery khi app trước bị kill đột ngột (Ctrl+C, crash, force quit).
    const stale = await this.isLockStale(lockPath);
    if (stale) {
      console.warn(`[browser] removing stale lock file (pid ${stale.pid} chết, lock ${stale.ageMs}ms cũ)`);
      try {
        await fs.unlink(lockPath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error(`[browser] failed to remove stale lock:`, err);
          return false;
        }
      }
      return this.tryAcquire(lockPath);
    }
    return false;
  }

  /** Thử tạo lock file O_EXCL. Returns true nếu acquire thành công. */
  private async tryAcquire(lockPath: string): Promise<boolean> {
    try {
      const fd = await fs.open(lockPath, "wx");
      await fd.writeFile(JSON.stringify({ acquiredAt: new Date().toISOString(), pid: process.pid }, null, 2));
      await fd.close();
      this.lockAcquiredAt = new Date().toISOString();
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw err;
    }
  }

  /**
   * Check xem lock file có phải stale không (PID chết hoặc quá cũ).
   * Returns {pid, ageMs} nếu stale, null nếu lock còn valid.
   */
  private async isLockStale(lockPath: string): Promise<{ pid: number; ageMs: number } | null> {
    try {
      const [stat, content] = await Promise.all([
        fs.stat(lockPath),
        fs.readFile(lockPath, "utf8").catch(() => ""),
      ]);
      const ageMs = Date.now() - stat.mtimeMs;
      // Nếu lock > 1 giờ → chắc chắn stale (dù PID còn sống).
      if (ageMs > 60 * 60 * 1000) return { pid: -1, ageMs };
      let pid = -1;
      try {
        const parsed = JSON.parse(content);
        pid = typeof parsed?.pid === "number" ? parsed.pid : -1;
      } catch {
        // Lock file không phải JSON — coi như stale.
        return { pid: -1, ageMs };
      }
      if (pid === process.pid) return { pid, ageMs }; // bị chính mình giữ = stale
      // Check PID còn sống không.
      if (pid > 0 && !this.isPidAlive(pid)) {
        return { pid, ageMs };
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Check PID còn sống không (cross-platform). Returns true nếu còn alive. */
  private isPidAlive(pid: number): boolean {
    try {
      // Windows: process.kill(pid, 0) throw ESRCH nếu PID chết.
      // POSIX: same.
      process.kill(pid, 0);
      return true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EPERM") return true; // sống nhưng không có quyền
      return false; // ESRCH hoặc khác = chết
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
      const context = await (playwright.chromium as any).launchPersistentContext(dir, {
        headless: false, // PW-002 chỉ yêu cầu headed để user login/2FA.
        // channel: input?.channel,  // REMOVED — anti-detection forbidden.
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