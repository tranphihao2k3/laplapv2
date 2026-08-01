/**
 * Service locator — singleton lazy init cho settings + auth service.
 *
 * Tách khỏi từng service để tránh circular dep khi thêm service khác
 * (queue, products, ...) sau này.
 * Caller gọi `getCachedSettingsService()` / `getCachedAuthService()` bất
 * kỳ lúc nào — nếu chưa init, throw UNAVAILABLE.
 *
 * App chính gọi `initServices(db, authService)` trong `app.whenReady()`
 * sau khi openDb + runMigrations xong. AuthService được khởi tạo ở main
 * trực tiếp vì nó cần `app.getPath('userData')`.
 */
import { app } from "electron";
import { AppError } from "../../shared/errors";
import { SettingsRepository } from "../db/repositories/settings";
import { SettingsService } from "../services/settings-service";
import { AuthService } from "../services/auth-service";

let settingsService: SettingsService | null = null;
let authService: AuthService | null = null;

export function initServices(db: import("better-sqlite3").Database): void {
  const settingsRepo = new SettingsRepository(db);
  settingsService = new SettingsService(settingsRepo);
  authService = new AuthService(app.getPath("userData"));
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
