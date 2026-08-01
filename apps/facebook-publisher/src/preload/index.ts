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
import type { AppSettings, IpcResult, PublisherApi } from "../shared/publisher-api";

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
    invokeOneArg<import("../shared/auth").AuthStatus>(
      IpcChannel.AuthLogin,
      z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256) }),
      input,
    ),
  authRefresh: () => invoke(IpcChannel.AuthRefresh, z.tuple()),
};

try {
  contextBridge.exposeInMainWorld("publisherApi", api);
} catch (err) {
  // contextBridge throw nếu contextIsolation=false (cấu hình sai).
  // APP-002 enforce contextIsolation=true trong main — log để debug.
  console.error("[preload] failed to expose publisherApi:", err);
}

// Đảm bảo type được dùng (kể cả khi Build tree-shake).
export type { AppSettings };
