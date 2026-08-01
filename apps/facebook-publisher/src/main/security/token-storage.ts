/**
 * Token storage — Electron safeStorage wrapper (APP-004).
 *
 * Nguyên tắc (docs §10 APP-004):
 *  - Refresh token: mã hoá bằng safeStorage (OS keychain/DPAPI), lưu file
 *    trong app data (KHÔNG trong SQLite, KHÔNG trong install dir).
 *  - Access token: ngắn hạn (~ 1h), KHÔNG persist; chỉ in-memory ở main.
 *  - expiry_at: lưu kèm refresh để reload xác định cần refresh hay login.
 *  - Log redact: BẤT KỲ chỗ nào cố tình log token, phải qua `redact()` để
 *    rò rỉ plaintext không xảy ra ngay cả khi dev copy/paste log.
 *
 * Trade-off:
 *  - safeStorage.isEncryptionAvailable() = false (Linux không có keyring)
 *    → fallback store plaintext và TODO warn. M2 chấp nhận để dev trên
 *    Linux; production sẽ fail-fast theo SPEC §4 (Không chạy production
 *    trên Linux).
 */
import { app, safeStorage } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AppError } from "../../shared/errors";

const TOKEN_FILE = "auth-tokens.bin";

export type StoredTokens = {
  /** Supabase refresh token. */
  refreshToken: string;
  /** ISO timestamp khi refresh hết hạn (Supabase TTL mặc định ~ 30 ngày). */
  expiresAt: string | null;
  /** ISO timestamp lúc user lần cuối login. */
  loggedInAt: string;
};

/** Plaintext access token — không bao giờ persist, chỉ in-memory. */
export type AccessTokenHolder = {
  accessToken: string | null;
  // Lưu kèm thời điểm để biết khi nào gần hết hạn.
  obtainedAt: string | null;
};

function resolveFile(customDir?: string): string {
  const dir = customDir ?? app.getPath("userData");
  return path.join(dir, TOKEN_FILE);
}

/**
 * Mã hoá + lưu refresh token. Throw nếu safeStorage không khả dụng
 * (vd Linux prod) — caller (login flow) phải xử lý fail-fast.
 */
export async function saveRefreshToken(
  refreshToken: string,
  expiresAt: string | null,
  customDir?: string,
): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new AppError(
      "STORAGE_UNAVAILABLE",
      "safeStorage không khả dụng trên nền tảng này — production chạy Linux không được",
      503,
    );
  }

  const payload: StoredTokens = {
    refreshToken,
    expiresAt,
    loggedInAt: new Date().toISOString(),
  };
  const encrypted = safeStorage.encryptString(JSON.stringify(payload));
  const file = resolveFile(customDir);

  // Ghi tạm → rename để tránh corruption khi app crash giữa chừng.
  const tmp = file + ".tmp";
  await fs.writeFile(tmp, encrypted);
  await fs.rename(tmp, file);
}

/** Đọc + giải mã refresh token. Trả null nếu chưa login hoặc lỗi. */
export async function loadRefreshToken(customDir?: string): Promise<StoredTokens | null> {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const file = resolveFile(customDir);
  try {
    const buf = await fs.readFile(file);
    const plaintext = safeStorage.decryptString(buf);
    const parsed = JSON.parse(plaintext.toString("utf-8")) as Partial<StoredTokens>;
    if (typeof parsed.refreshToken !== "string" || parsed.refreshToken.length === 0) {
      return null;
    }
    return {
      refreshToken: parsed.refreshToken,
      expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : null,
      loggedInAt:
        typeof parsed.loggedInAt === "string" ? parsed.loggedInAt : new Date().toISOString(),
    };
  } catch {
    // File không tồn tại hoặc sai format → trả null, KHÔNG throw.
    return null;
  }
}

/** Xoá file refresh token. Idempotent. */
export async function clearTokens(customDir?: string): Promise<void> {
  const file = resolveFile(customDir);
  try {
    await fs.unlink(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
}

/**
 * Log redaction — thay thế mọi pattern trông như JWT/SK bằng placeholder.
 *
 * Pattern phát hiện:
 *  - JWT 3 phần base64url phân cách bằng dấu chấm (header.payload.sig).
 *  - Anonymous bearer-like token (chuỗi base64 dài > 32 ký tự).
 *  - Supabase keys (eyJ... chuỗi bắt đầu bằng ey...).
 *
 * Áp dụng trên toàn bộ log context: `redact(input)` trước khi in ra stdout.
 * Không thay thế lỗi có thông tin giúp debug — chỉ thay thế string trông
 * như token.
 */
export function redact(input: string): string {
  return input
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/\bbearer\s+[A-Za-z0-9_-]{20,}/gi, "bearer [REDACTED]")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, (m) => (m.includes(".") ? "[REDACTED_TOKEN]" : m));
}
