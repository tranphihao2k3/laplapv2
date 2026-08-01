/**
 * Service locator — singleton lazy init cho settings + auth service.
 *
 * Tách khỏi từng service để tránh circular dep khi thêm service khác
 * (queue, products, ...) sau này.
 *
 * Caller gọi `getCached*Service()` bất kỳ lúc nào — nếu chưa init, throw
 * UNAVAILABLE.
 *
 * `initServices(db, settings)` được gọi trong `app.whenReady()` sau khi
 * openDb + runMigrations xong. AuthService được khởi tạo ở đây vì nó
 * cần `app.getPath('userData')` (Electron runtime).
 *
 * SupabaseAuthClient dùng callback cho `getApiBaseUrl()` — UI thay đổi
 * setting.apiBaseUrl sẽ được thấy ngay lập tức, không phải khởi tạo lại.
 */
import { app } from "electron";
import { AppError } from "../../shared/errors";
import { SettingsRepository } from "../db/repositories/settings";
import { SettingsService } from "../services/settings-service";
import { AuthService } from "../services/auth-service";
import { SupabaseAuthClient } from "../api/supabase-auth-client";
import { env } from "../env";

let settingsService: SettingsService | null = null;
let authService: AuthService | null = null;
let supabaseAuthClient: SupabaseAuthClient | null = null;

export function initServices(db: import("better-sqlite3").Database): void {
  const settingsRepo = new SettingsRepository(db);
  settingsService = new SettingsService(settingsRepo);
  authService = new AuthService(app.getPath("userData"));
  supabaseAuthClient = new SupabaseAuthClient(() => {
    // Lazy read settings.apiBaseUrl, fallback env default.
    try {
      return settingsService?.get().apiBaseUrl ?? env.defaultApiBaseUrl;
    } catch {
      return env.defaultApiBaseUrl;
    }
  });
}

export function getCachedSettingsService(): SettingsService {
  if (!settingsService) {
    throw new AppError(
      "SERVICE_NOT_READY",
      "Services chưa được khởi tạo — gọi initServices() trong app.whenReady() trước khi IPC tới",
      503,
    );
  }
  return settingsService;
}

export function getCachedAuthService(): AuthService {
  if (!authService) {
    throw new AppError(
      "SERVICE_NOT_READY",
      "AuthService chưa sẵn sàng — gọi initServices() trước",
      503,
    );
  }
  return authService;
}

export function getCachedSupabaseAuthClient(): SupabaseAuthClient {
  if (!supabaseAuthClient) {
    throw new AppError(
      "SERVICE_NOT_READY",
      "SupabaseAuthClient chưa sẵn sàng — gọi initServices() trước",
      503,
    );
  }
  return supabaseAuthClient;
}
