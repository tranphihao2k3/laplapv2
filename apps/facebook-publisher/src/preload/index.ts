/**
 * Electron preload — typed bridge giữa main và renderer.
 *
 * APP-002 hardening:
 *  - Chỉ gọi đúng channel allowlist trong shared/ipc.ts. Channel name
 *    được giấu — renderer không có cách nào tự truyền channel khác.
 *  - Payload được Zod validate ở cả 2 phía: preload (fail-fast khi renderer
 *    gửi sai), main (defense in depth).
 *  - contextBridge.exposeInMainWorld chỉ lộ object `publisherApi` —
 *    KHÔNG để lộ electron, ipcRenderer, require, Buffer.
 *
 * APP-003: Settings methods — get / patch / reset / getDefaults. Patch
 * payload validate qua Zod với schema `SettingsPatchSchema` (shared) để
 * renderer không gửi field lạ (vd `secret: 'foo'`) qua IPC.
 */
import { contextBridge, ipcRenderer } from "electron";
import { z } from "zod";
import { IpcChannel } from "../shared/ipc";
import { SettingsPatchSchema } from "../shared/settings";
import type {
  AppSettings,
  CatalogQuery,
  DownloadedImage,
  IpcResult,
  MediaCleanupResult,
  ProductSummary,
  ProductVariantSummary,
  PublisherApi,
  SyncResult,
} from "../shared/publisher-api";

const getAppVersionInputSchema = z.tuple([]);

function invoke<TArgs extends unknown[], TData>(
  channel: (typeof IpcChannel)[keyof typeof IpcChannel],
  schema: z.ZodType<TArgs>,
  ...args: TArgs
): Promise<IpcResult<TData>> {
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    return Promise.resolve({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: `Invalid payload for ${channel}: ${parsed.error.issues
          .map((i) => i.path.join(".") || "(root)")
          .join(", ")}`,
      },
    });
  }
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<TData>>;
}

function invokeOneArg<TData>(
  channel: (typeof IpcChannel)[keyof typeof IpcChannel],
  schema: z.ZodType<unknown>,
  arg: unknown,
): Promise<IpcResult<TData>> {
  return invoke(channel, z.tuple(schema), arg);
}

function invokeTuple<TData>(
  channel: (typeof IpcChannel)[keyof typeof IpcChannel],
  schema: z.ZodType<unknown[]>,
  args: unknown[],
): Promise<IpcResult<TData>> {
  return invoke(channel, schema, ...args);
}

const api: PublisherApi = {
  getAppVersion: () => invoke(IpcChannel.AppGetVersion, getAppVersionInputSchema),

  settingsGet: () => invoke(IpcChannel.SettingsGet, z.tuple()),
  settingsGetDefaults: () => invoke(IpcChannel.SettingsGetDefaults, z.tuple()),
  settingsReset: () => invoke(IpcChannel.SettingsReset, z.tuple()),
  settingsPatch: (patch: unknown) =>
    invokeOneArg<AppSettings>(IpcChannel.SettingsPatch, SettingsPatchSchema, patch),

  // Auth — renderer KHÔNG BAO GIỜ nhận được access/refresh token.
  // Chỉ authGetStatus (boolean + metadata), authLogin (email+password),
  // authLogout, authRefresh.
  authGetStatus: () => invoke(IpcChannel.AuthGetStatus, z.tuple()),
  authLogout: () => invoke(IpcChannel.AuthLogout, z.tuple()),
  authLogin: (input: unknown) =>
    invokeOneArg<AuthStatus>(
      IpcChannel.AuthLogin,
      z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256) }),
      input,
    ),
  authRefresh: () => invoke(IpcChannel.AuthRefresh, z.tuple()),

  // CAT-001 — catalog sync + cache read
  catalogSyncPage: (q: unknown) =>
    invokeOneArg<SyncResult>(
      IpcChannel.CatalogSyncPage,
      z.object({
        q: z.string().trim().max(200).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
      q,
    ),
  catalogSyncAll: (q: unknown) =>
    invokeOneArg<SyncResult>(
      IpcChannel.CatalogSyncAll,
      z.object({
        q: z.string().trim().max(200).optional(),
        pageSize: z.number().int().min(1).max(100).default(50),
      }),
      q,
    ),
  catalogList: (q: unknown) =>
    invokeOneArg<{ items: ProductSummary[]; total: number }>(
      IpcChannel.CatalogList,
      z.object({
        q: z.string().trim().max(200).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
      q,
    ),
  catalogGet: (id: unknown) =>
    invokeOneArg<ProductSummary | null>(
      IpcChannel.CatalogGet,
      z.string().uuid(),
      id,
    ),
  catalogVariants: (id: unknown) =>
    invokeOneArg<ProductVariantSummary[]>(
      IpcChannel.CatalogVariants,
      z.string().uuid(),
      id,
    ),
  catalogLastSync: () => invoke<string | null>(IpcChannel.CatalogLastSync, z.tuple()),

  // MED-001 — media
  mediaDownload: (url: unknown) =>
    invokeOneArg<DownloadedImage>(IpcChannel.MediaDownload, z.string().url().max(2048), url),
  mediaCleanup: () => invoke<MediaCleanupResult>(IpcChannel.MediaCleanup, z.tuple()),
  mediaList: () => invoke<DownloadedImage[]>(IpcChannel.MediaList, z.tuple()),

  // GRP-001
  groupsList: () => invoke<GroupRecord[]>(IpcChannel.GroupsList, z.tuple()),
  groupsGet: (id: unknown) =>
    invokeOneArg<GroupRecord | null>(IpcChannel.GroupsGet, z.string().uuid(), id),
  groupsCreate: (input: unknown) => invokeOneArg<GroupRecord>(IpcChannel.GroupsCreate, groupUpsertInputSchema, input),
  groupsUpdate: (id: unknown, patch: unknown) => {
    const tuple = z.tuple(z.string().uuid(), groupUpsertInputSchema);
    return invokeTuple<GroupRecord>(IpcChannel.GroupsUpdate, tuple, [id, patch]);
  },
  groupsDelete: (id: unknown) =>
    invokeOneArg<null>(IpcChannel.GroupsDelete, z.string().uuid(), id),

  // GRP-002
  groupSetsList: () => invoke<GroupSetRecord[]>(IpcChannel.GroupSetsList, z.tuple()),
  groupSetsCreate: (name: unknown) =>
    invokeOneArg<GroupSetRecord>(
      IpcChannel.GroupSetsCreate,
      z.string().trim().min(1).max(200),
      name,
    ),
  groupSetsDelete: (id: unknown) =>
    invokeOneArg<null>(IpcChannel.GroupSetsDelete, z.string().uuid(), id),
  groupSetsMembers: (id: unknown) =>
    invokeOneArg<GroupRecord[]>(IpcChannel.GroupSetsMembers, z.string().uuid(), id),
  groupSetsAddMember: (setId: unknown, groupId: unknown) => {
    const tuple = z.tuple(z.string().uuid(), z.string().uuid());
    return invokeTuple<null>(IpcChannel.GroupSetsAddMember, tuple, [setId, groupId]);
  },
  groupSetsRemoveMember: (setId: unknown, groupId: unknown) => {
    const tuple = z.tuple(z.string().uuid(), z.string().uuid());
    return invokeTuple<null>(IpcChannel.GroupSetsRemoveMember, tuple, [setId, groupId]);
  },
};

const groupUpsertInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().url().max(2048),
  enabled: z.boolean().optional(),
  locale: z.string().max(8).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  maxImages: z.number().int().min(0).max(50).optional(),
  allowLink: z.boolean().optional(),
  postingMode: z.enum(["assisted", "auto"]).optional(),
});

try {
  contextBridge.exposeInMainWorld("publisherApi", api);
} catch (err) {
  // contextBridge throw nếu contextIsolation=false (cấu hình sai).
  // APP-002 enforce contextIsolation=true trong main — log để debug.
  console.error("[preload] failed to expose publisherApi:", err);
}

// Đảm bảo type được dùng (kể cả khi Build tree-shake).
export type { AppSettings };
