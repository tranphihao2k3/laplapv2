/**
 * Shared type definitions exposed to renderer.
 *
 * Renderer chỉ nên `import type` từ đây (không kéo theo electron).
 * Implementation thực sự nằm ở preload/index.ts và chỉ expose object
 * `publisherApi` qua contextBridge — không có require/electron ngoài.
 */
import type { IpcResult } from "../ipc";
import type { AppSettings, SettingsPatch } from "../settings";

export type { IpcResult, AppSettings, SettingsPatch };

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
}
