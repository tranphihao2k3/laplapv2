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
import { safeStorage } from "electron";
import {
  clearTokens,
  loadRefreshToken,
  saveRefreshToken,
  type AccessTokenHolder,
  type StoredTokens,
} from "../security/token-storage";
import { SupabaseAuthClient } from "../api/supabase-auth-client";
import type { SupabaseTokensResponse } from "../api/supabase-auth-client";

export type AuthStatus =
  | { kind: "anonymous" }
  | {
      kind: "authenticated";
      email: string | null;
      refreshExpiresAt: string | null;
      loggedInAt: string;
      rememberMe: boolean;
      /** True khi safeStorage.encryptString KHÔNG khả dụng — file token
       *  không được mã hoá. UI nên warn user. */
      secureStorageUnavailable: boolean;
    };

export class AuthService {
  private readonly holder: AccessTokenHolder = { accessToken: null, obtainedAt: null };
  // Track để tránh 2 tác vụ cùng refresh 1 lúc.
  private refreshInFlight: Promise<string> | null = null;

  constructor(private readonly userDataDir?: string) {}

  /**
   * APP-005: Login bang email + password qua Supabase auth.
   * Luu refresh + set access in-memory. Tra AppError neu that bai.
   *
   * `rememberMe`:
   *  - true (default): persist refresh token đã mã hoá xuống local → auto
   *    refresh on boot, không phải đăng nhập lại.
   *  - false: chỉ giữ access token trong session hiện tại; logout khi đóng
   *    app. Phù hợp máy dùng chung.
   */
  async login(input: {
    supabase: SupabaseAuthClient;
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<AuthStatus> {
    const remember = input.rememberMe ?? true;
    try {
      const result = await input.supabase.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      await this.applyTokens(result, remember);
      return this.statusFromHolder(result.user.email);
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
   *
   * Lưu ý: nếu muốn auto-refresh (để có access token ngay khi mở app),
   * dùng `bootstrap()` thay thế (gọi loadFromDiskAndMaybeRefresh internally).
   */
  async loadFromDisk(): Promise<AuthStatus> {
    const stored = await loadRefreshToken(this.userDataDir);
    if (!stored) return { kind: "anonymous" };
    return this.statusFromStored(stored);
  }

  /**
   * Bootstrap session khi app mount: load token + auto-refresh nếu user
   * đã tick "Ghi nhớ đăng nhập". Đây là entry point chính cho UI.
   *  - Không có token → anonymous.
   *  - rememberMe=false → chỉ đọc metadata, không gọi network.
   *  - rememberMe=true + supabase OK → refresh → có access token ngay.
   *  - Refresh fail → đã clearTokens bên trong; caller nhận anonymous
   *    (UI đẩy login lại).
   */
  async bootstrap(input: { supabase: SupabaseAuthClient }): Promise<AuthStatus> {
    return this.loadFromDiskAndMaybeRefresh(input);
  }

  /**
   * Variant của loadFromDisk — nếu stored.rememberMe=true VÀ có supabase
   * callback, tự gọi refresh để có access token sẵn sàng cho queue worker.
   * Nếu rememberMe=false hoặc refresh fail → trả AuthStatus (KHÔNG throw).
   */
  async loadFromDiskAndMaybeRefresh(input: {
    supabase: SupabaseAuthClient;
  }): Promise<AuthStatus> {
    const stored = await loadRefreshToken(this.userDataDir);
    if (!stored) return { kind: "anonymous" };
    if (!stored.rememberMe) return this.statusFromStored(stored);

    try {
      await this.refreshAccessToken({ supabase: input.supabase });
    } catch {
      // Refresh fail → caller vẫn nhận AuthStatus authenticated (đã xoá
      // token trong refreshAccessToken). UI sẽ đẩy login lại.
      return this.loadFromDisk();
    }
    // Refresh OK → lấy status mới từ holder.
    return this.statusFromStored(stored);
  }

  /**
   * Áp tokens vừa nhận (login hoặc refresh) → cập nhật holder + persist
   * refresh xuống file encrypted (nếu rememberMe=true).
   */
  private async applyTokens(t: SupabaseTokensResponse, rememberMe: boolean): Promise<void> {
    this.holder.accessToken = t.access_token;
    this.holder.obtainedAt = new Date().toISOString();
    if (rememberMe) {
      await saveRefreshToken(
        t.refresh_token,
        t.user.email,
        this.expiryIsoFromUnix(t.expires_at),
        rememberMe,
        this.userDataDir,
      );
    }
  }

  private statusFromStored(stored: StoredTokens): AuthStatus {
    return {
      kind: "authenticated",
      email: stored.email,
      refreshExpiresAt: stored.expiresAt,
      loggedInAt: stored.loggedInAt,
      rememberMe: stored.rememberMe,
      secureStorageUnavailable: !safeStorage.isEncryptionAvailable(),
    };
  }

  private statusFromHolder(email: string | undefined): AuthStatus {
    const stored: StoredTokens = {
      refreshToken: "",
      email: email ?? null,
      expiresAt: null,
      loggedInAt: new Date().toISOString(),
      rememberMe: true,
    };
    return this.statusFromStored(stored);
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
        // Refresh giữ nguyên rememberMe từ stored token.
        await this.applyTokens(result, stored.rememberMe);
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
