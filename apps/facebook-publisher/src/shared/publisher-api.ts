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
import type {
  CatalogQuery,
  ProductSummary,
  ProductVariantSummary,
  SyncResult,
} from "../catalog";

export type { IpcResult, AppSettings, SettingsPatch, AuthStatus };
export type {
  CatalogQuery,
  ProductSummary,
  ProductVariantSummary,
  SyncResult,
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
  /** Get 1 product (MED-001 dùng). */
  catalogGet: (productId: string) => Promise<IpcResult<ProductSummary | null>>;
  /** List variants của 1 product. */
  catalogVariants: (productId: string) => Promise<IpcResult<ProductVariantSummary[]>>;
  /** Tra timestamp last sync (UI indicator). */
  catalogLastSync: () => Promise<IpcResult<string | null>>;
}
