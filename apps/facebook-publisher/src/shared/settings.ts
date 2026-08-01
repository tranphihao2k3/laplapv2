/**
 * Settings schema + defaults — APP-003.
 *
 * Mục tiêu (docs §10 APP-003):
 *  - API base URL, locale, posting mode, timeout, diagnostics TTL.
 *  - Validate schema ở main/process boundary trước khi ghi DB.
 *  - Defaults an toàn — assisted mode là default, KHÔNG auto-submit khi
 *    chưa qua GOV-AUTO (docs §4).
 *
 * Schema dùng chung (main + renderer) để 2 phía validate giống nhau.
 */
import { z } from "zod";

/** Locale hiện chỉ có 'vi' — nhưng schema mở để UI-* dễ i18n sau. */
export const LocaleSchema = z.enum(["vi", "en"]);
export type Locale = z.infer<typeof LocaleSchema>;

/**
 * Posting mode cho group: 'assisted' (người xác nhận submit) hoặc 'auto'.
 * 'auto' yêu cầu feature flag GOV-AUTO được chủ dự án phê duyệt
 * (docs §4). Mặc định 'assisted' cho MỌI group mới.
 */
export const PostingModeSchema = z.enum(["assisted", "auto"]);
export type PostingMode = z.infer<typeof PostingModeSchema>;

const TimeoutSchema = z
  .number()
  .int()
  .min(1000, "Timeout tối thiểu 1s")
  .max(120_000, "Timeout tối đa 2 phút");

const DiagnosticsTtlSchema = z
  .number()
  .int()
  .min(60_000, "Diagnostics TTL tối thiểu 1 phút")
  .max(30 * 24 * 60 * 60 * 1000, "Diagnostics TTL tối đa 30 ngày");

/** Schema tổng cho AppSettings — đặt ở shared để main + renderer dùng. */
export const AppSettingsSchema = z.object({
  /** URL API backend (LapLap/Next.js). Production: https://laplap.vn. */
  apiBaseUrl: z
    .string()
    .url()
    .default("http://localhost:3000"),

  /** Locale UI — hiện chỉ 'vi'. */
  locale: LocaleSchema.default("vi"),

  /** Posting mode mặc định cho group mới. KHÔNG set 'auto' cho M2 gate. */
  defaultPostingMode: PostingModeSchema.default("assisted"),

  /** Timeout HTTP/IPC chung. */
  httpTimeoutMs: TimeoutSchema.default(15_000),

  /** Timeout cho Playwright operations (login, fill, submit). */
  playwrightTimeoutMs: TimeoutSchema.default(45_000),

  /** Diagnostics (screenshot/trace) TTL — cleanup tự động. */
  diagnosticsTtlMs: DiagnosticsTtlSchema.default(7 * 24 * 60 * 60 * 1000),

  /**
   * Convenience flag để áp dụng cho MỌI group khi user tạo nhanh. KHÔNG
   * phải runtime override của GOV-AUTO — đó là escalation của chủ dự án
   * (docs §4). Renderer vẫn cho phép toggle per-group trong GRP-001.
   */
  autoSubmitGloballyAllowed: z.boolean().default(false),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

/** Default an toàn — 'assisted' + autoSubmit=false. */
export const DEFAULT_SETTINGS: AppSettings = AppSettingsSchema.parse({});

/**
 * Validate input thô từ renderer (chưa có default). Throw ZodError nếu
 * sai schema — gọi từ main IPC handler để fail-fast thay vì âm thầm dùng
 * default và để user tiếp tục với config sai.
 */
export function parseAppSettings(input: unknown): AppSettings {
  return AppSettingsSchema.parse(input);
}

/**
 * Merge patch vào settings hiện tại (validate cả object). Dùng cho IPC
 * handler save — chỉ field được phép patch, không có key lạ.
 */
export const SettingsPatchSchema = AppSettingsSchema.partial();
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;

export function applySettingsPatch(
  current: AppSettings,
  patch: unknown,
): AppSettings {
  const safePatch = SettingsPatchSchema.parse(patch);
  return AppSettingsSchema.parse({ ...current, ...safePatch });
}
