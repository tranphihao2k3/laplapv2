/**
 * Shared type definitions exposed to renderer.
 *
 * Renderer chỉ nên `import type` từ đây (không kéo theo electron).
 * Implementation thực sự nằm ở preload/index.ts và chỉ expose object
 * `publisherApi` qua contextBridge — không có require/electron ngoài.
 */
import type { IpcResult } from "./ipc";
import type { AppSettings, SettingsPatch } from "./settings";
import type { AuthStatus } from "./auth";
import type {
  CatalogQuery,
  ProductDetail,
  ProductSummary,
  ProductVariantSummary,
  SyncResult,
} from "./catalog";
import type { DownloadedImage, MediaCleanupResult } from "./media";
import type {
  GroupRecord,
  GroupSetRecord,
  GroupSetWithMembers,
  GroupUpsert,
} from "./groups";
import type {
  TemplateInput,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
  TemplateRecord,
} from "./templates";
import type {
  CampaignInput,
  CampaignJobSummary,
  CampaignRecord,
  EnqueueRequest,
  EnqueueResult,
} from "./campaigns";
import type {
  AutoSubmitDecision,
  BrowserSessionStatus,
  SavedScreenshot,
  SessionHealth,
} from "./browser";
import type {
  JobAttemptRecord,
  PreflightResult,
  QueueCount,
  RecoveryReport,
  WorkerStatus,
} from "./queue";

export type { IpcResult, AppSettings, SettingsPatch, AuthStatus };
export type {
  CatalogQuery,
  ProductSummary,
  ProductVariantSummary,
  SyncResult,
  DownloadedImage,
  MediaCleanupResult,
  GroupRecord,
  GroupSetRecord,
  GroupSetWithMembers,
  GroupUpsert,
  TemplateInput,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
  TemplateRecord,
  CampaignInput,
  CampaignJobSummary,
  CampaignRecord,
  EnqueueRequest,
  EnqueueResult,
  AutoSubmitDecision,
  BrowserSessionStatus,
  SavedScreenshot,
  SessionHealth,
  JobAttemptRecord,
  PreflightResult,
  QueueCount,
  RecoveryReport,
  WorkerStatus,
};

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
  /**
   * Login Supabase bang email + password. Frontend KHONG gui password qua
   * thu vien cua no — chi goi publisherApi.authLogin, main goi Supabase
   * HTTPS, password KHONG bao gio nhan dien o renderer.
   */
  authLogin: (input: { email: string; password: string }) => Promise<IpcResult<AuthStatus>>;
  /**
   * Yêu cầu refresh session. Dùng khi API-003 trả 401 hoặc scheduler phát
   * hiện token sắp hết. Trả AuthStatus mới.
   */
  authRefresh: () => Promise<IpcResult<AuthStatus>>;

  // CAT-001
  /** Sync 1 page từ API và upsert vào cache. */
  catalogSyncPage: (query: CatalogQuery) => Promise<IpcResult<SyncResult>>;
  /** Sync tất cả page (UI nút "Đồng bộ ngay"). */
  catalogSyncAll: (query: { q?: string; pageSize?: number }) => Promise<IpcResult<SyncResult>>;
  /** List product từ cache (UI render list). */
  catalogList: (query: { q?: string; page: number; pageSize: number }) => Promise<IpcResult<{ items: ProductSummary[]; total: number }>>;
  /** Get 1 product kèm variants + previewSpecs (cho modal chi tiết). */
  catalogGet: (productId: string) => Promise<IpcResult<ProductDetail | null>>;
  /** List variants của 1 product. */
  catalogVariants: (productId: string) => Promise<IpcResult<ProductVariantSummary[]>>;
  /** Tra timestamp last sync (UI indicator). */
  catalogLastSync: () => Promise<IpcResult<string | null>>;

  // MED-001
  /** Tải 1 ảnh URL về app data/temp/media/<hash>.<ext>. */
  mediaDownload: (url: string) => Promise<IpcResult<DownloadedImage>>;
  /** Dọn file cũ hơn diagnostics TTL. */
  mediaCleanup: () => Promise<IpcResult<MediaCleanupResult>>;
  /** List file media đã tải (cho UI image picker). */
  mediaList: () => Promise<IpcResult<DownloadedImage[]>>;

  // GRP-001 — Facebook groups CRUD
  groupsList: () => Promise<IpcResult<GroupRecord[]>>;
  groupsGet: (id: string) => Promise<IpcResult<GroupRecord | null>>;
  groupsCreate: (input: GroupUpsert) => Promise<IpcResult<GroupRecord>>;
  groupsUpdate: (id: string, patch: GroupUpsert) => Promise<IpcResult<GroupRecord>>;
  groupsDelete: (id: string) => Promise<IpcResult<null>>;

  // GRP-002 — Group sets
  groupSetsList: () => Promise<IpcResult<GroupSetRecord[]>>;
  groupSetsCreate: (name: string) => Promise<IpcResult<GroupSetRecord>>;
  groupSetsDelete: (setId: string) => Promise<IpcResult<null>>;
  groupSetsMembers: (setId: string) => Promise<IpcResult<GroupRecord[]>>;
  groupSetsAddMember: (setId: string, groupId: string) => Promise<IpcResult<null>>;
  groupSetsRemoveMember: (setId: string, groupId: string) => Promise<IpcResult<null>>;

  // TPL-001 + TPL-002
  templatesList: () => Promise<IpcResult<TemplateRecord[]>>;
  templatesGet: (id: string) => Promise<IpcResult<TemplateRecord | null>>;
  templatesCreate: (input: TemplateInput) => Promise<IpcResult<TemplateRecord>>;
  templatesUpdate: (id: string, patch: TemplateInput) => Promise<IpcResult<TemplateRecord>>;
  templatesDelete: (id: string) => Promise<IpcResult<null>>;
  templatesPreview: (req: TemplatePreviewRequest) => Promise<IpcResult<TemplatePreviewResponse>>;

  // CMP-001/002/003
  campaignsList: () => Promise<IpcResult<CampaignRecord[]>>;
  campaignsGet: (id: string) => Promise<IpcResult<CampaignRecord | null>>;
  campaignsCreate: (input: CampaignInput) => Promise<IpcResult<CampaignRecord>>;
  campaignsUpdate: (id: string, patch: CampaignInput) => Promise<IpcResult<CampaignRecord>>;
  campaignsDelete: (id: string) => Promise<IpcResult<null>>;
  campaignsEnqueue: (req: EnqueueRequest) => Promise<IpcResult<EnqueueResult>>;
  campaignsJobs: (campaignId: string) => Promise<IpcResult<CampaignJobSummary[]>>;

  // PW-001 / PW-002 / PW-005 / PW-008
  browserLaunch: () => Promise<IpcResult<BrowserSessionStatus>>;
  browserClose: () => Promise<IpcResult<null>>;
  browserStatus: () => Promise<IpcResult<BrowserSessionStatus>>;
  browserSessionHealth: () => Promise<IpcResult<SessionHealth>>;
  browserCanAutoSubmit: (groupId: string) => Promise<IpcResult<AutoSubmitDecision>>;
  diagnosticsSaveScreenshot: (jobId: string, step: string, data: number[]) =>
    Promise<IpcResult<SavedScreenshot>>;
  diagnosticsCleanup: () => Promise<IpcResult<{ removed: number }>>;

  // QUE-001/002/003/004/005 + UI-001/002
  queueRunRecovery: () => Promise<IpcResult<RecoveryReport>>;
  queueTransition: (id: string, toState: string, opts?: { errorCode?: string; errorMessage?: string }) =>
    Promise<IpcResult<{ attemptNumber: number }>>;
  queueCancelJob: (id: string) => Promise<IpcResult<null>>;
  queueCancelCampaign: (campaignId: string) => Promise<IpcResult<{ cancelled: number; notFound: number }>>;
  queueCounts: () => Promise<IpcResult<QueueCount[]>>;
  queueAttempts: (jobId: string) => Promise<IpcResult<JobAttemptRecord[]>>;
  queuePreflight: (jobId: string) => Promise<IpcResult<PreflightResult>>;

  // QUE-002 — Worker controls.
  workerStart: () => Promise<IpcResult<WorkerStatus>>;
  workerPause: () => Promise<IpcResult<WorkerStatus>>;
  workerResume: () => Promise<IpcResult<WorkerStatus>>;
  workerStop: () => Promise<IpcResult<{ paused: boolean; cancelled: number }>>;
  workerStatus: () => Promise<IpcResult<WorkerStatus>>;
}
