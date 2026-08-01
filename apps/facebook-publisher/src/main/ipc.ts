/**
 * IPC handlers — main process.
 *
 * APP-002: Mọi handler PHẢI validate input qua Zod schema trước khi xử lý.
 * Channel name là string literal được allowlist trong `IpcChannel` (shared/ipc.ts)
 * để preload không thể gọi nhầm channel ngoài ý muốn. Trả về shape thống nhất:
 *   { ok: true, data } hoặc { ok: false, error: { code, message } }.
 *
 * KHÔNG bao giờ throw Error thô — renderer phải nhận object để đỡ sập UI.
 *
 * APP-003: Settings handlers — đọc/patch/reset + get defaults. Service
 * (settings-service.ts) enforce business rule (GOV-AUTO gating...).
 */
import { ipcMain, type IpcMainInvokeEvent } from "electron";
import { z } from "zod";
import { AppError } from "../shared/errors";
import { IpcChannel, type IpcResult } from "../shared/ipc";
import {
  applySettingsPatch,
  DEFAULT_SETTINGS,
} from "../shared/settings";
import type {
  CatalogQuery,
  ProductSummary,
  ProductVariantSummary,
  SyncResult,
} from "../shared/catalog";
import {
  getCachedAuthService,
  getCachedCatalogService,
  getCachedProductRepository,
  getCachedSettingsService,
  getCachedSupabaseAuthClient,
} from "./services/service-locator";

/** Lấy version app đơn giản — không nhận input. */
const getAppVersionSchema = z.tuple([]);

const settingsGetSchema = z.tuple([]);
const settingsResetSchema = z.tuple([]);
const settingsGetDefaultsSchema = z.tuple([]);
const settingsPatchSchema = z.tuple(
  z.record(z.string(), z.unknown()), // patch object — SettingsPatchSchema sẽ validate trong service.
);
const authGetStatusSchema = z.tuple([]);
const authLogoutSchema = z.tuple([]);

// APP-005: login bang email + password qua SupabaseAuthClient.
const authLoginSchema = z.tuple(
  z.object({
    email: z.string().email("Email không hợp lệ").max(254),
    password: z.string().min(1, "Mật khẩu không được để trống").max(256),
  }),
);
const authRefreshSchema = z.tuple([]);

// CAT-001 — catalog sync + cache read
const catalogQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
const catalogSyncAllSchema = z.object({
  q: z.string().trim().max(200).optional(),
  pageSize: z.number().int().min(1).max(100).default(50),
});
const catalogListSchema = catalogQuerySchema;
const catalogGetSchema = z.tuple(z.string().uuid());
const catalogVariantsSchema = z.tuple(z.string().uuid());
const catalogLastSyncSchema = z.tuple([]);

/** Validate payload theo schema; throw AppError nếu fail. */
function parse<T>(schema: z.ZodType<T>, payload: unknown, channel: string): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid payload for ${channel}: ${result.error.issues.map((i) => i.path.join(".") || "(root)").join(", ")}`,
    );
  }
  return result.data;
}

/** Wrapper chuẩn để đăng ký handler — convert throw → IpcResult. */
function handle<TArgs extends unknown[], TData>(
  channel: string,
  schema: z.ZodType<TArgs>,
  fn: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TData> | TData,
): void {
  ipcMain.handle(channel, async (event, ...rawArgs) => {
    try {
      const args = parse(schema, rawArgs, channel);
      const data = await fn(event, ...args);
      return { ok: true, data } satisfies IpcResult<TData>;
    } catch (err) {
      if (err instanceof AppError) {
        return { ok: false, error: { code: err.code, message: err.message } } satisfies IpcResult<never>;
      }
      if (err instanceof z.ZodError) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "),
          },
        } satisfies IpcResult<never>;
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[ipc:${channel}]`, err);
      return {
        ok: false,
        error: { code: "INTERNAL_ERROR", message },
      } satisfies IpcResult<never>;
    }
  });
}

export function registerIpcHandlers(): void {
  // --- App ---
  handle(IpcChannel.AppGetVersion, getAppVersionSchema, () => process.versions.electron);

  // --- Settings ---
  handle(IpcChannel.SettingsGet, settingsGetSchema, () => getCachedSettingsService().get());
  handle(IpcChannel.SettingsGetDefaults, settingsGetDefaultsSchema, () => applySettingsPatch(DEFAULT_SETTINGS, {}));
  handle(IpcChannel.SettingsReset, settingsResetSchema, () => getCachedSettingsService().reset());
  handle(IpcChannel.SettingsPatch, settingsPatchSchema, ([patch]) =>
    getCachedSettingsService().patch(patch),
  );

  // --- Auth ---
  handle(IpcChannel.AuthGetStatus, authGetStatusSchema, async () => {
    const svc = getCachedAuthService();
    return svc.loadFromDisk();
  });
  handle(IpcChannel.AuthLogout, authLogoutSchema, async () => {
    const svc = getCachedAuthService();
    await svc.logout();
    return { ok: true } as const;
  });
  handle(IpcChannel.AuthLogin, authLoginSchema, async ([{ email, password }]) => {
    const svc = getCachedAuthService();
    return svc.login({
      supabase: getCachedSupabaseAuthClient(),
      email,
      password,
    });
  });
  handle(IpcChannel.AuthRefresh, authRefreshSchema, async () => {
    // Refresh chỉ có nghĩa khi đã login — nếu không, loadFromDisk trả
    // anonymous (UI dùng để hiển thị "đăng nhập lại").
    const svc = getCachedAuthService();
    try {
      await svc.refreshAccessToken({ supabase: getCachedSupabaseAuthClient() });
    } catch {
      // Refresh fail → đã được logout() bên trong svc. Tiếp tục trả status mới.
    }
    return svc.loadFromDisk();
  });

  // CAT-001 — catalog sync + cache read
  handle(IpcChannel.CatalogSyncPage, z.tuple(catalogQuerySchema), async ([query]) => {
    const orgId = getCurrentOrgId();
    return getCachedCatalogService().syncPage(orgId, query);
  });
  handle(IpcChannel.CatalogSyncAll, z.tuple(catalogSyncAllSchema), async ([query]) => {
    const orgId = getCurrentOrgId();
    return getCachedCatalogService().syncAll(orgId, query);
  });
  handle(IpcChannel.CatalogList, z.tuple(catalogListSchema), async ([query]) => {
    const repo = getCachedProductRepository();
    const orgId = getCurrentOrgId();
    const items = query.q
      ? repo.searchByOrg(orgId, query.q, query.pageSize, (query.page - 1) * query.pageSize)
      : repo.listByOrg(orgId, query.pageSize, (query.page - 1) * query.pageSize);
    const total = repo.countActive(orgId);
    return { items: items.map(adaptProductSummary), total };
  });
  handle(IpcChannel.CatalogGet, catalogGetSchema, async ([productId]) => {
    const repo = getCachedProductRepository();
    const row = repo.findById(productId);
    if (!row) return null;
    // Đếm variants để UI hiển thị.
    const variants = repo.listVariants(productId);
    return { ...adaptProductSummary(row), variantsCount: variants.length };
  });
  handle(IpcChannel.CatalogVariants, catalogVariantsSchema, async ([productId]) => {
    const repo = getCachedProductRepository();
    return repo.listVariants(productId).map(adaptVariantSummary);
  });
  handle(IpcChannel.CatalogLastSync, catalogLastSyncSchema, async () => {
    const repo = getCachedProductRepository();
    return repo.lastSyncedAt(getCurrentOrgId());
  });
}

/** Lấy orgId từ authService user — ở đây dùng placeholder. */
function getCurrentOrgId(): string {
  // TODO: AuthService cần truyền orgId từ Supabase user. Tạm thời hard-code
  // qua settings hoặc auth-status metadata; CAT-001 chấp nhận hard-code
  // 'default-org' cho dev. Production sẽ lấy từ user_profiles.
  return "default-org";
}

function adaptProductSummary(row: import("../shared/db-types").ProductCacheRow): ProductSummary {
  return {
    productId: row.product_id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.short_description,
    thumbnailUrl: row.thumbnail_url,
    status: row.status,
    productUrl: row.product_url,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at,
    variantsCount: 0, // CatalogService đếm khi detail.
    inStock: false,
  };
}

function adaptVariantSummary(row: import("../shared/db-types").VariantCacheRow): ProductVariantSummary {
  let attributes: unknown = row.attributes_json;
  let specs: unknown = row.specs_json;
  try {
    if (row.attributes_json) attributes = JSON.parse(row.attributes_json);
  } catch { /* leave as string */ }
  try {
    if (row.specs_json) specs = JSON.parse(row.specs_json);
  } catch { /* leave as string */ }
  return {
    variantId: row.variant_id,
    productId: row.product_id,
    sku: row.sku,
    name: row.name,
    attributes,
    specs,
    sellingPrice: row.selling_price,
    isActive: row.is_active !== 0,
    availableQty: row.available_qty,
    syncedAt: row.synced_at,
  };
}
