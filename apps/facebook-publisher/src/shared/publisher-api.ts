/**
 * Shared type definitions exposed to renderer.
 *
 * Renderer chỉ nên `import type` từ đây (không kéo theo electron).
 * Implementation thực sự nằm ở preload/index.ts và chỉ expose object
 * `publisherApi` qua contextBridge — không có require/electron ngoài.
 */
import type { IpcResult } from "../ipc";
import type { AppSettings, SettingsPatch } from "../settings";
import type { AuthStatus } from "../auth";

export type { IpcResult, AppSettings, SettingsPatch, AuthStatus };

export interface PublisherApi {
  getAppVersion: () => Promise<IpcResult<string>>;
  /** Đọc settings hiện tại từ DB; trả default nếu rỗng. */
  settingsGet: () => Promise<IpcResult<AppSettings>>;
  /** Đọc schema default — dùng để render form/placeholder. */
  settingsGetDefaults: () => Promise<IpcResult<AppSettings>>;
  /** Patch settings (validate ở main). Trả object merged. */
  settingsPatch: (patch: SettingsPatch) => Promise<IpcResult<AppSettings>>;
  /** Reset về default. */
  settingsReset: () => Promise<IpcResult<AppSettings>>;
  /**
   * Đọc auth status. Renderer KHÔNG BAO GIỜ nhận được access/refresh
   * token — chỉ biết anonymous hay authenticated + thời điểm.
   */
  authGetStatus: () => Promise<IpcResult<AuthStatus>>;
  /** Logout — xoá refresh token + clear in-memory access token. */
  authLogout: () => Promise<IpcResult<{ ok: true }>>;
}
