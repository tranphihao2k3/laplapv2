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
import type { GroupRecord, GroupSetRecord, GroupUpsert } from "../shared/groups";
import type {
  TemplateInput,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
  TemplateRecord,
} from "../shared/templates";
import type {
  CampaignInput,
  CampaignJobSummary,
  CampaignRecord,
  EnqueueRequest,
  EnqueueResult,
} from "../shared/campaigns";
import type {
  CampaignRow,
  FacebookGroupRow,
  GroupSetRow,
  PostJobRow,
  TemplateRow,
} from "../shared/db-types";
import {
  getCachedAuthService,
  getCachedCampaignRepository,
  getCachedCampaignService,
  getCachedCatalogService,
  getCachedGroupRepository,
  getCachedGroupService,
  getCachedGroupSetRepository,
  getCachedGroupSetService,
  getCachedImageService,
  getCachedPostJobRepository,
  getCachedProductRepository,
  getCachedSettingsService,
  getCachedSupabaseAuthClient,
  getCachedTemplateRepository,
  getCachedTemplateService,
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

// MED-001 — media download / cleanup / list
const mediaDownloadSchema = z.tuple(z.string().url().max(2048));
const mediaCleanupSchema = z.tuple([]);
const mediaListSchema = z.tuple([]);

// GRP-001
const groupsListSchema = z.tuple([]);
const groupsGetSchema = z.tuple(z.string().uuid());
const groupsDeleteSchema = z.tuple(z.string().uuid());
const groupUpsertSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().url().max(2048),
  enabled: z.boolean().optional(),
  locale: z.string().max(8).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  maxImages: z.number().int().min(0).max(50).optional(),
  allowLink: z.boolean().optional(),
  postingMode: z.enum(["assisted", "auto"]).optional(),
});
const groupsCreateSchema = z.tuple(groupUpsertSchema);
const groupsUpdateSchema = z.tuple(z.string().uuid(), groupUpsertSchema);

// GRP-002
const groupSetsListSchema = z.tuple([]);
const groupSetsCreateSchema = z.tuple(z.string().trim().min(1).max(200));
const groupSetsDeleteSchema = z.tuple(z.string().uuid());
const groupSetsMembersSchema = z.tuple(z.string().uuid());
const groupSetsAddMemberSchema = z.tuple(z.string().uuid(), z.string().uuid());
const groupSetsRemoveMemberSchema = z.tuple(z.string().uuid(), z.string().uuid());

// TPL-001 + TPL-002
const templatesListSchema = z.tuple([]);
const templatesGetSchema = z.tuple(z.string().uuid());
const templatesDeleteSchema = z.tuple(z.string().uuid());
const templateInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  body: z.string().min(1).max(20_000),
  allowlistedVariables: z.array(z.string().max(200)).max(50).default([]),
  previewContext: z.record(z.string(), z.unknown()).optional(),
  previewLocale: z.string().max(8).optional(),
});
const templatesCreateSchema = z.tuple(templateInputSchema);
const templatesUpdateSchema = z.tuple(z.string().uuid(), templateInputSchema);
const templatesPreviewSchema = z.tuple(
  z.object({
    body: z.string().min(1).max(20_000),
    context: z.record(z.string(), z.unknown()),
    locale: z.string().max(8).optional(),
  }),
);

// CMP-001/002/003
const campaignsListSchema = z.tuple([]);
const campaignsGetSchema = z.tuple(z.string().uuid());
const campaignsDeleteSchema = z.tuple(z.string().uuid());
const campaignInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  templateId: z.string().uuid(),
  groupSetId: z.string().uuid().nullable().optional(),
  imagePaths: z.array(z.string().max(2048)).max(20).optional(),
  status: z.enum(["draft", "ready", "archived"]).optional(),
});
const campaignsCreateSchema = z.tuple(campaignInputSchema);
const campaignsUpdateSchema = z.tuple(z.string().uuid(), campaignInputSchema);
const enqueueRequestSchema = z.object({
  campaignId: z.string().uuid(),
  imageUrls: z.array(z.string().url().max(2048)).max(20).optional(),
  imageSha256s: z.array(z.string().length(64)).max(20).optional(),
});
const campaignsEnqueueSchema = z.tuple(enqueueRequestSchema);
const campaignsJobsSchema = z.tuple(z.string().uuid());

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

  // MED-001 — media
  handle(IpcChannel.MediaDownload, mediaDownloadSchema, async ([url]) => {
    return getCachedImageService().download({ url });
  });
  handle(IpcChannel.MediaCleanup, mediaCleanupSchema, async () => {
    return getCachedImageService().cleanupExpired();
  });
  handle(IpcChannel.MediaList, mediaListSchema, async () => {
    // List file trong mediaDir. Service giữ path; ở đây ta quét đơn giản.
    const dir = getCachedImageService().mediaDir();
    return readMediaList(dir);
  });

  // GRP-001
  handle(IpcChannel.GroupsList, groupsListSchema, async () => {
    return getCachedGroupRepository().listAll().map(adaptGroup);
  });
  handle(IpcChannel.GroupsGet, groupsGetSchema, async ([id]) => {
    const row = getCachedGroupRepository().findById(id);
    return row ? adaptGroup(row) : null;
  });
  handle(IpcChannel.GroupsCreate, groupsCreateSchema, async ([input]) => {
    return adaptGroup(getCachedGroupService().create(input));
  });
  handle(IpcChannel.GroupsUpdate, groupsUpdateSchema, async ([id, patch]) => {
    return adaptGroup(getCachedGroupService().update(id, patch));
  });
  handle(IpcChannel.GroupsDelete, groupsDeleteSchema, async ([id]) => {
    getCachedGroupService().delete(id);
    return null;
  });

  // GRP-002
  handle(IpcChannel.GroupSetsList, groupSetsListSchema, async () => {
    return getCachedGroupSetRepository().listSets().map(adaptGroupSet);
  });
  handle(IpcChannel.GroupSetsCreate, groupSetsCreateSchema, async ([name]) => {
    return adaptGroupSet(getCachedGroupSetService().create(name));
  });
  handle(IpcChannel.GroupSetsDelete, groupSetsDeleteSchema, async ([id]) => {
    getCachedGroupSetService().delete(id);
    return null;
  });
  handle(IpcChannel.GroupSetsMembers, groupSetsMembersSchema, async ([id]) => {
    return getCachedGroupSetRepository().listMembers(id).map(adaptGroup);
  });
  handle(IpcChannel.GroupSetsAddMember, groupSetsAddMemberSchema, async ([setId, groupId]) => {
    getCachedGroupSetService().addMember(setId, groupId);
    return null;
  });
  handle(IpcChannel.GroupSetsRemoveMember, groupSetsRemoveMemberSchema, async ([setId, groupId]) => {
    getCachedGroupSetService().removeMember(setId, groupId);
    return null;
  });

  // TPL-001 + TPL-002
  handle(IpcChannel.TemplatesList, templatesListSchema, async () => {
    return getCachedTemplateRepository().listAll().map(adaptTemplate);
  });
  handle(IpcChannel.TemplatesGet, templatesGetSchema, async ([id]) => {
    const row = getCachedTemplateRepository().findById(id);
    return row ? adaptTemplate(row) : null;
  });
  handle(IpcChannel.TemplatesCreate, templatesCreateSchema, async ([input]) => {
    return adaptTemplate(getCachedTemplateService().create(input));
  });
  handle(IpcChannel.TemplatesUpdate, templatesUpdateSchema, async ([id, patch]) => {
    return adaptTemplate(getCachedTemplateService().update(id, patch));
  });
  handle(IpcChannel.TemplatesDelete, templatesDeleteSchema, async ([id]) => {
    getCachedTemplateService().delete(id);
    return null;
  });
  handle(IpcChannel.TemplatesPreview, templatesPreviewSchema, async ([req]) => {
    return { text: getCachedTemplateService().renderPreview(req.body, req.context, req.locale) };
  });

  // CMP-001/002/003
  handle(IpcChannel.CampaignsList, campaignsListSchema, async () => {
    return getCachedCampaignRepository().listAll().map(adaptCampaign);
  });
  handle(IpcChannel.CampaignsGet, campaignsGetSchema, async ([id]) => {
    const row = getCachedCampaignRepository().findById(id);
    return row ? adaptCampaign(row) : null;
  });
  handle(IpcChannel.CampaignsCreate, campaignsCreateSchema, async ([input]) => {
    const created = getCachedCampaignService().createCampaign(input);
    const row = getCachedCampaignRepository().findById(created.id);
    return adaptCampaign(row as CampaignRow);
  });
  handle(IpcChannel.CampaignsUpdate, campaignsUpdateSchema, async ([id, patch]) => {
    getCachedCampaignService().updateCampaign(id, patch);
    const row = getCachedCampaignRepository().findById(id);
    return adaptCampaign(row as CampaignRow);
  });
  handle(IpcChannel.CampaignsDelete, campaignsDeleteSchema, async ([id]) => {
    getCachedCampaignService().deleteCampaign(id);
    return null;
  });
  handle(IpcChannel.CampaignsEnqueue, campaignsEnqueueSchema, async ([req]) => {
    return getCachedCampaignService().enqueue(req);
  });
  handle(IpcChannel.CampaignsJobs, campaignsJobsSchema, async ([campaignId]) => {
    return getCachedPostJobRepository().listByCampaign(campaignId).map(adaptJob);
  });
}

function adaptCampaign(row: CampaignRow): CampaignRecord {
  let imagePaths: string[] = [];
  try {
    const parsed = JSON.parse(row.image_paths_json);
    if (Array.isArray(parsed)) {
      imagePaths = parsed.filter((p): p is string => typeof p === "string");
    }
  } catch { /* empty */ }
  return {
    id: row.id,
    name: row.name,
    productId: row.product_id,
    variantId: row.variant_id,
    templateId: row.template_id,
    groupSetId: row.group_set_id,
    imagePaths,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function adaptJob(row: PostJobRow): CampaignJobSummary {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    groupId: row.group_id,
    state: row.state,
    fingerprint: row.fingerprint,
    submitClickedAt: row.submit_clicked_at,
    postUrl: row.post_url,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readMediaList(dir: string): Promise<import("../shared/media").DownloadedImage[]> {
  const fs = await import("node:fs/promises");
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: import("../shared/media").DownloadedImage[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith(".tmp")) continue;
    const full = `${dir}/${entry.name}`;
    const stat = await fs.stat(full);
    // Không lưu url trong cache — để UI show "chưa có url gốc" khi list.
    out.push({
      url: "",
      filePath: full,
      mime: "image/" + (entry.name.split(".").pop() || "bin"),
      bytes: stat.size,
      sha256: entry.name.split(".")[0] ?? "",
      downloadedAt: stat.mtime.toISOString(),
    });
  }
  return out.sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt));
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

function adaptGroup(row: FacebookGroupRow): GroupRecord {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    enabled: row.enabled !== 0,
    locale: row.locale,
    notes: row.notes,
    maxImages: row.max_images,
    allowLink: row.allow_link !== 0,
    postingMode: row.posting_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function adaptGroupSet(row: GroupSetRow): GroupSetRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function adaptTemplate(row: TemplateRow): TemplateRecord {
  let allowlisted: string[] = [];
  try {
    const parsed = JSON.parse(row.allowlisted_variables_json);
    if (Array.isArray(parsed)) {
      allowlisted = parsed.filter((x): x is string => typeof x === "string");
    }
  } catch { /* leave empty */ }
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    allowlistedVariables: allowlisted,
    contentText: row.content_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
