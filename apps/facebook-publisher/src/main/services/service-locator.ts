/**
 * Service locator — singleton lazy init cho settings service.
 *
 * Tách khỏi settings-service.ts để tránh circular dep khi thêm service
 * khác (queue, auth, ...) sau này. Caller gọi `getCachedSettingsService()`
 * bất kỳ lúc nào — nếu chưa init, throw UNAVAILABLE.
 *
 * App chính gọi `initServices(db)` trong `app.whenReady()` để bind
 * service với DB connection đã mở.
 */
import { AppError } from "../../shared/errors";
import { SettingsRepository } from "../db/repositories/settings";
import { SettingsService } from "../services/settings-service";

let settingsService: SettingsService | null = null;

export function initServices(db: import("better-sqlite3").Database): void {
  const settingsRepo = new SettingsRepository(db);
  settingsService = new SettingsService(settingsRepo);
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
