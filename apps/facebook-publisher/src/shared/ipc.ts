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
  GroupsList: "groups:list",
  GroupsGet: "groups:get",
  GroupsCreate: "groups:create",
  GroupsUpdate: "groups:update",
  GroupsDelete: "groups:delete",
  GroupSetsList: "group-sets:list",
  GroupSetsCreate: "group-sets:create",
  GroupSetsDelete: "group-sets:delete",
  GroupSetsMembers: "group-sets:members",
  GroupSetsAddMember: "group-sets:add-member",
  GroupSetsRemoveMember: "group-sets:remove-member",
  TemplatesList: "templates:list",
  TemplatesGet: "templates:get",
  TemplatesCreate: "templates:create",
  TemplatesUpdate: "templates:update",
  TemplatesDelete: "templates:delete",
  TemplatesPreview: "templates:preview",
  CampaignsList: "campaigns:list",
  CampaignsGet: "campaigns:get",
  CampaignsCreate: "campaigns:create",
  CampaignsUpdate: "campaigns:update",
  CampaignsDelete: "campaigns:delete",
  CampaignsEnqueue: "campaigns:enqueue",
  CampaignsJobs: "campaigns:jobs",
  BrowserLaunch: "browser:launch",
  BrowserClose: "browser:close",
  BrowserStatus: "browser:status",
  BrowserSessionHealth: "browser:session-health",
  BrowserCanAutoSubmit: "browser:can-auto-submit",
  DiagnosticsSaveScreenshot: "diagnostics:save-screenshot",
  DiagnosticsCleanup: "diagnostics:cleanup",
  QueueRunRecovery: "queue:run-recovery",
  QueueTransition: "queue:transition",
  QueueCancelJob: "queue:cancel-job",
  QueueCancelCampaign: "queue:cancel-campaign",
  QueueCounts: "queue:counts",
  QueueAttempts: "queue:attempts",
  QueuePreflight: "queue:preflight",
  WorkerStart: "worker:start",
  WorkerPause: "worker:pause",
  WorkerResume: "worker:resume",
  WorkerStop: "worker:emergency-stop",
  WorkerStatus: "worker:status",
} as const;
export type IpcChannelValue = (typeof IpcChannel)[keyof typeof IpcChannel];

/** Kết quả IPC chuẩn — renderer xử lý theo discriminator `ok`. */
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
