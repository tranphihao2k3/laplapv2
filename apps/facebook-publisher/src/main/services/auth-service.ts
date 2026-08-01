/**
 * AuthService — quản lý session + access token in-memory + refresh flow.
 *
 * APP-004 acceptance:
 *  - access token KHÔNG bao giờ rời main process (trừ qua IPC để gửi
 *    header Bearer khi gọi /api/v1/desktop-posting/*).
 *  - Logout xoá: file refresh token + in-memory access token.
 *  - Hàm log bất kỳ phải qua redact() trước khi in.
 *  - onBoot: đọc refresh token (nếu có) — UI-* có thể dùng để khởi động
 *    queue ngay mà không cần login lại.
 *
 * Refresh flow (chi tiết sang APP-005):
 *  - Caller (HTTP client) thấy 401.
 *  - Gọi AuthService.refreshAccessToken() → POST /auth/v1/token?grant_type=refresh_token.
 *  - Thành công: update in-memory access token + persist refresh token mới.
 *  - Fail: clearTokens() và trả UNAUTHORIZED — UI phải đẩy user về login.
 */
import { AppError } from "../../shared/errors";
import {
  clearTokens,
  loadRefreshToken,
  saveRefreshToken,
  type AccessTokenHolder,
} from "../security/token-storage";

export type AuthStatus =
  | { kind: "anonymous" }
  | { kind: "authenticated"; refreshExpiresAt: string | null; loggedInAt: string };

/**
 * Lightweight refresh interface — caller có thể inject HTTP client thật
 * (APP-005) hoặc fake cho test.
 */
export type RefreshFn = (refreshToken: string) => Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt: string | null;
}>;

export class AuthService {
  private readonly holder: AccessTokenHolder = { accessToken: null, obtainedAt: null };
  // Caller inject để tránh AuthService phụ thuộc trực tiếp Supabase lib.
  private refreshFn: RefreshFn | null = null;
  // Track để tránh 2 tác vụ cùng refresh 1 lúc.
  private refreshInFlight: Promise<string> | null = null;

  constructor(private readonly userDataDir?: string) {}

  /** Cho main app inject http client sau khi wire xong. */
  bindRefresh(fn: RefreshFn): void {
    this.refreshFn = fn;
  }

  /** Trả access token hiện tại — null nếu chưa login. */
  getAccessToken(): string | null {
    return this.holder.accessToken;
  }

  /**
   * Trả access token dùng cho Bearer (API-003 đã wire). Trả throw nếu
   * anonymous — renderer (qua IPC) phải hiện màn login.
   */
  requireAccessToken(): string {
    const t = this.holder.accessToken;
    if (!t) {
      throw new AppError("UNAUTHORIZED", "Chưa login — không có access token", 401);
    }
    return t;
  }

  /**
   * App startup: đọc refresh token đã persist. Trả AuthStatus để UI biết
   * nên resume session hay đẩy login. KHÔNG tự động refresh — để UI điều
   * khiển để tránh silent network call.
   */
  async loadFromDisk(): Promise<AuthStatus> {
    const stored = await loadRefreshToken(this.userDataDir);
    if (!stored) return { kind: "anonymous" };
    return {
      kind: "authenticated",
      refreshExpiresAt: stored.expiresAt,
      loggedInAt: stored.loggedInAt,
    };
  }

  /**
   * Sau khi login thành công: lưu refresh + cập nhật access token.
   * `tokens.refreshToken` optional — nếu Supabase rotate refresh, ta dùng
   * token mới; nếu không thì giữ token cũ.
   */
  async startSession(input: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string | null;
  }): Promise<void> {
    this.holder.accessToken = input.accessToken;
    this.holder.obtainedAt = new Date().toISOString();

    await saveRefreshToken(input.refreshToken, input.expiresAt, this.userDataDir);
  }

  /** Refresh access token bằng stored refresh. Có guard race condition. */
  async refreshAccessToken(): Promise<string> {
    if (this.refreshInFlight) return this.refreshInFlight;
    if (!this.refreshFn) {
      throw new AppError("NOT_READY", "AuthService chưa bind refresh", 503);
    }
    const stored = await loadRefreshToken(this.userDataDir);
    if (!stored) {
      throw new AppError("UNAUTHORIZED", "Không có refresh token — cần login lại", 401);
    }

    const promise = (async () => {
      try {
        const result = await this.refreshFn!(stored.refreshToken);
        await this.startSession({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken ?? stored.refreshToken,
          expiresAt: result.expiresAt,
        });
        return result.accessToken;
      } catch (err) {
        // Refresh fail: xoá sạch session.
        await this.logout();
        const msg = err instanceof Error ? err.message : "refresh failed";
        throw new AppError("UNAUTHORIZED", `Refresh thất bại: ${msg}`, 401);
      } finally {
        this.refreshInFlight = null;
      }
    })();

    this.refreshInFlight = promise;
    return promise;
  }

  /**
   * Logout: xoá file + in-memory. KHÔNG throw nếu file không tồn tại.
   * Idempotent.
   */
  async logout(): Promise<void> {
    this.holder.accessToken = null;
    this.holder.obtainedAt = null;
    await clearTokens(this.userDataDir);
  }

  /** Test helper — chỉ dùng trong unit test. */
  _setAccessTokenForTest(token: string | null): void {
    this.holder.accessToken = token;
  }
}
