/**
 * Shared IPC contract — dùng chung main, preload, renderer.
 *
 * Channel name là string literal KHÔNG lộ ra renderer; preload phải dùng
 * đúng tên này để qua allowlist `ipcMain.handle` ở main. Renderer không
 * trực tiếp thấy channel — chỉ thấy method trên `publisherApi`.
 */
export const IpcChannel = {
  AppGetVersion: "app:get-version",
  SettingsGet: "settings:get",
  SettingsPatch: "settings:patch",
  SettingsReset: "settings:reset",
  SettingsGetDefaults: "settings:get-defaults",
  AuthGetStatus: "auth:get-status",
  AuthLogout: "auth:logout",
  AuthLogin: "auth:login",
  AuthRefresh: "auth:refresh",
  CatalogSyncPage: "catalog:sync-page",
  CatalogSyncAll: "catalog:sync-all",
  CatalogList: "catalog:list",
  CatalogGet: "catalog:get",
  CatalogVariants: "catalog:variants",
  CatalogLastSync: "catalog:last-sync",
  MediaDownload: "media:download",
  MediaCleanup: "media:cleanup",
  MediaList: "media:list",
} as const;
export type IpcChannelValue = (typeof IpcChannel)[keyof typeof IpcChannel];

/** Kết quả IPC chuẩn — renderer xử lý theo discriminator `ok`. */
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
