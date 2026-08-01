/**
 * Supabase Auth API client.
 *
 * Dùng cho:
 *  - Login: POST /auth/v1/token?grant_type=password (email + password).
 *  - Refresh: POST /auth/v1/token?grant_type=refresh_token (refresh token).
 *  - Logout: POST /auth/v1/logout (global sign-out).
 *
 * Endpoint format: <apiBaseUrl>/auth/v1/...
 *
 * Supabase Access token format:
 *   {
 *     access_token: string,
 *     token_type: "bearer",
 *     expires_in: number,           // seconds
 *     expires_at: number,           // UNIX seconds
 *     refresh_token: string,
 *     user: { id, email, ... }
 *   }
 *
 * Wire với AuthService qua callback `refreshFn` của AuthService:
 *   supabaseAuthClient.bindAsRefreshFn(authService)
 */
import { apiFetch, HttpError } from "./http-client";
import { AppError } from "../../shared/errors";

export const SUPABASE_AUTH_PATH_PREFIX = "/auth/v1";

export type SupabaseTokensResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    [k: string]: unknown;
  };
};

export type SupabaseErrorResponse = {
  error?: string;
  error_description?: string;
  message?: string;
  code?: string | number;
};

export class SupabaseAuthClient {
  constructor(private readonly getApiBaseUrl: () => string) {}

  /** Login bằng email + password. Trả full token set. */
  async signInWithPassword(input: { email: string; password: string }): Promise<SupabaseTokensResponse> {
    return apiFetch<SupabaseTokensResponse>(
      this.getApiBaseUrl(),
      `${SUPABASE_AUTH_PATH_PREFIX}/token?grant_type=password`,
      "POST",
      { body: input },
    );
  }

  /** Refresh access token bằng refresh token. */
  async refresh(refreshToken: string): Promise<SupabaseTokensResponse> {
    return apiFetch<SupabaseTokensResponse>(
      this.getApiBaseUrl(),
      `${SUPABASE_AUTH_PATH_PREFIX}/token?grant_type=refresh_token`,
      "POST",
      { body: { refresh_token: refreshToken } },
    );
  }

  /** Logout server-side (revoke refresh token). */
  async signOut(accessToken: string): Promise<void> {
    await apiFetch<unknown>(
      this.getApiBaseUrl(),
      `${SUPABASE_AUTH_PATH_PREFIX}/logout`,
      "POST",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
  }

  /**
   * Map HttpError sang AppError có nghĩa cho UI:
   *  - 400: invalid_grant → AUTH_BAD_CREDENTIALS
   *  - 401: refresh invalid → AUTH_REFRESH_FAILED
   *  - 5xx/timeout/network: AUTH_PROVIDER_UNAVAILABLE
   */
  static normalizeError(err: unknown): AppError {
    if (err instanceof AppError) return err;
    if (err instanceof HttpError) {
      const body = (err.details ?? {}) as SupabaseErrorResponse;
      const code = body?.error ?? body?.code ?? err.code;
      switch (err.status) {
        case 400:
        case 422:
          return new AppError(
            "AUTH_BAD_CREDENTIALS",
            `Email hoặc mật khẩu không đúng (${code ?? "invalid_grant"})`,
            400,
          );
        case 401:
          return new AppError(
            "AUTH_REFRESH_FAILED",
            "Refresh token không hợp lệ hoặc đã hết hạn — vui lòng login lại",
            401,
          );
        case 0:
          // TIMEOUT hoặc NETWORK.
          return new AppError(
            "AUTH_PROVIDER_UNAVAILABLE",
            `Không liên lạc được LapLap API: ${err.message}`,
            503,
          );
        default:
          return new AppError(
            "AUTH_PROVIDER_ERROR",
            `Lỗi LapLap API: ${err.status} ${err.message}`,
            err.status || 500,
          );
      }
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new AppError("AUTH_INTERNAL_ERROR", msg, 500);
  }
}
