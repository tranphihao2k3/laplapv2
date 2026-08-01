/**
 * AutoSubmitGate — PW-005.
 *
 * Quy tắc:
 *  - Mặc định KHÔNG auto-submit (assisted mode).
 *  - Auto-submit chỉ chạy khi:
 *    + settings.autoSubmitGloballyAllowed === true (feature flag).
 *    + group.postingMode === "auto".
 *    + GOV-AUTO đã pass (ngoài scope code — kiểm tra thủ công).
 *  - Emergency stop: queue.pause + bỏ qua job kế tiếp ngay lập tức.
 */
import { SettingsRepository } from "../db/repositories/settings";

export type AutoSubmitDecision =
  | { kind: "allowed" }
  | { kind: "blocked"; reason: string };

export class AutoSubmitGate {
  constructor(private readonly settings: SettingsRepository) {}

  canAutoSubmit(input: { groupPostingMode: "assisted" | "auto" }): AutoSubmitDecision {
    if (input.groupPostingMode !== "auto") {
      return { kind: "blocked", reason: "group.postingMode !== 'auto'" };
    }
    const settings = this.settings.get();
    if (!settings.autoSubmitGloballyAllowed) {
      return { kind: "blocked", reason: "settings.autoSubmitGloballyAllowed = false" };
    }
    if (settings.defaultPostingMode !== "auto") {
      return { kind: "blocked", reason: "settings.defaultPostingMode !== 'auto'" };
    }
    return { kind: "allowed" };
  }
}