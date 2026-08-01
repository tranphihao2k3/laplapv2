/**
 * SettingsService — service layer cho IPC.
 *
 * Tách khỏi repo để:
 *  - IPC handler chỉ gọi Service (Service gọi Repo).
 *  - Service enforce rule nghiệp vụ:
 *      + autoSubmitGloballyAllowed = true chỉ OK nếu config gating đạt
 *        yêu cầu (docs §4 GOV-AUTO). Ở M2 chưa có flag → luôn từ chối.
 *
 * Service throw AppError → IPC handler wrap → IpcResult trả về renderer.
 */
import { AppError } from "../../shared/errors";
import { SettingsRepository } from "../db/repositories/settings";
import {
  applySettingsPatch,
  DEFAULT_SETTINGS,
  type AppSettings,
  type SettingsPatch,
} from "../../shared/settings";

export class SettingsService {
  constructor(private readonly repo: SettingsRepository) {}

  /** Đọc settings hiện tại hoặc default. */
  get(): AppSettings {
    return this.repo.get();
  }

  /**
   * Patch settings. Validate schema + enforce nghiệp vụ:
   *   - autoSubmitGloballyAllowed: KHÔNG bật khi chưa có GOV-AUTO.
   */
  patch(patch: SettingsPatch): AppSettings {
    // Enforce rule nghiệp vụ ở đây — không để repo/enum lo.
    if (patch.autoSubmitGloballyAllowed === true) {
      throw new AppError(
        "GOV_AUTO_REQUIRED",
        "Bật auto-submit cần phê duyệt GOV-AUTO của chủ dự án (docs §4). Hiện không khả dụng.",
        409,
      );
    }

    // Sanity check: patch.postingMode 'auto' cũng cần GOV-AUTO.
    if (patch.defaultPostingMode === "auto") {
      throw new AppError(
        "GOV_AUTO_REQUIRED",
        "defaultPostingMode='auto' cần GOV-AUTO. Mặc định 'assisted'.",
        409,
      );
    }

    return this.repo.patch(patch);
  }

  /** Reset toàn bộ về DEFAULT. */
  reset(): AppSettings {
    return this.repo.reset();
  }
}

/**
 * Đọc schema default — dùng cho renderer hiển thị placeholder/form.
 * Không gọi repo → luôn trả về pure default, không phụ thuộc DB state.
 */
export function getDefaultSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS };
}

/** Re-export Zod helper để renderer dùng validate cùng schema. */
export { applySettingsPatch };
