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
import { getCachedSettingsService } from "./services/service-locator";

/** Lấy version app đơn giản — không nhận input. */
const getAppVersionSchema = z.tuple([]);

const settingsGetSchema = z.tuple([]);
const settingsResetSchema = z.tuple([]);
const settingsGetDefaultsSchema = z.tuple([]);
const settingsPatchSchema = z.tuple(
  z.record(z.string(), z.unknown()), // patch object — SettingsPatchSchema sẽ validate trong service.
);

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
  // Service được lấy qua locator — singleton lazy khi app.whenReady() xong.
  handle(IpcChannel.SettingsGet, settingsGetSchema, () => getCachedSettingsService().get());
  handle(IpcChannel.SettingsGetDefaults, settingsGetDefaultsSchema, () => applySettingsPatch(DEFAULT_SETTINGS, {}));
  handle(IpcChannel.SettingsReset, settingsResetSchema, () => getCachedSettingsService().reset());
  handle(IpcChannel.SettingsPatch, settingsPatchSchema, ([patch]) =>
    getCachedSettingsService().patch(patch),
  );
}
