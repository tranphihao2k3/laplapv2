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
 * APP-005:
 *  - login(email, password): goi SupabaseAuthClient, persist refresh + holder.
 *  - refreshAccessToken: SupabaseAuthClient.refresh, persist new refresh.
 *  - error state: AuthError typed tra ve qua IPC cho UI hien thi.
 */
import { AppError } from "../../shared/errors";
import {
  clearTokens,
  loadRefreshToken,
  saveRefreshToken,
  type AccessTokenHolder,
} from "../security/token-storage";
import { SupabaseAuthClient } from "../api/supabase-auth-client";
import type { SupabaseTokensResponse } from "../api/supabase-auth-client";

export type AuthStatus =
  | { kind: "anonymous" }
  | { kind: "authenticated"; refreshExpiresAt: string | null; loggedInAt: string };

export class AuthService {
  private readonly holder: AccessTokenHolder = { accessToken: null, obtainedAt: null };
  // Track để tránh 2 tác vụ cùng refresh 1 lúc.
  private refreshInFlight: Promise<string> | null = null;

  constructor(private readonly userDataDir?: string) {}

  /**
   * APP-005: Login bang email + password qua Supabase auth.
   * Luu refresh + set access in-memory. Tra AppError neu that bai.
   */
  async login(input: { supabase: SupabaseAuthClient; email: string; password: string }): Promise<AuthStatus> {
    try {
      const result = await input.supabase.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      await this.applyTokens(result);
      return {
        kind: "authenticated",
        refreshExpiresAt: this.expiryIsoFromUnix(result.expires_at),
        loggedInAt: new Date().toISOString(),
      };
    } catch (err) {
      throw SupabaseAuthClient.normalizeError(err);
    }
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
   * Áp tokens vừa nhận (login hoặc refresh) → cập nhật holder + persist
   * refresh xuống file encrypted.
   */
  private async applyTokens(t: SupabaseTokensResponse): Promise<void> {
    this.holder.accessToken = t.access_token;
    this.holder.obtainedAt = new Date().toISOString();
    await saveRefreshToken(t.refresh_token, this.expiryIsoFromUnix(t.expires_at), this.userDataDir);
  }

  private expiryIsoFromUnix(seconds: number | undefined | null): string | null {
    if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
    return new Date(seconds * 1000).toISOString();
  }

  /**
   * Refresh access token bằng stored refresh qua SupabaseAuthClient.
   * Có guard race condition: 2 tác vụ refresh đồng thời chỉ chạy 1.
   * Fail → clearTokens() + throw mapped AppError, UI sẽ đẩy login.
   */
  async refreshAccessToken(input: { supabase: SupabaseAuthClient }): Promise<string> {
    if (this.refreshInFlight) return this.refreshInFlight;
    const stored = await loadRefreshToken(this.userDataDir);
    if (!stored) {
      throw new AppError("UNAUTHORIZED", "Không có refresh token — cần login lại", 401);
    }

    const promise = (async () => {
      try {
        const result = await input.supabase.refresh(stored.refreshToken);
        await this.applyTokens(result);
        return result.access_token;
      } catch (err) {
        await this.logout();
        throw SupabaseAuthClient.normalizeError(err);
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
