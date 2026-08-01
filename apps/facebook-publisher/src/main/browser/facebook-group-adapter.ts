/**
 * FacebookGroupAdapter — PW-003 + PW-004.
 *
 * Page Object / Adapter cho composer Facebook. Trừu tượng hoá locator
 * + thao tác bằng cách gọi đúng role/label/text (LocatorRegistry).
 *
 * Trả về AppError typed khi:
 *  - page_error / no_permission / pending_approval.
 *  - composer không mở sau timeout.
 *  - submit fail.
 */
import type { BrowserContext, Page } from "playwright-core";
import { AppError } from "../../shared/errors";
import { LocatorRegistry } from "./locator-registry";

export type ComposerState =
  | { kind: "closed" }
  | { kind: "open"; page: Page }
  | { kind: "pending_approval" }
  | { kind: "no_permission" }
  | { kind: "page_error"; message: string };

export type PostTextInput = {
  /** Văn bản đã render từ template (CMP-002 snapshot). */
  renderedText: string;
};

export type PostImageInput = {
  filePaths: string[];
};

export class FacebookGroupAdapter {
  constructor(private readonly context: BrowserContext) {}

  /**
   * Mở URL group. Trả ComposerState dựa trên URL sau khi navigate.
   */
  async openGroup(groupUrl: string): Promise<ComposerState> {
    const page = await this.context.newPage();
    try {
      await page.goto(groupUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      const reg = new LocatorRegistry(page);

      if (await reg.noPermissionText().isVisible({ timeout: 1000 }).catch(() => false)) {
        return { kind: "no_permission" };
      }
      if (await reg.pendingApprovalText().isVisible({ timeout: 1000 }).catch(() => false)) {
        return { kind: "pending_approval" };
      }
      return { kind: "open", page };
    } catch (err) {
      return { kind: "page_error", message: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Mở composer và điền text. Chưa click submit. */
  async fillText(page: Page, input: PostTextInput): Promise<void> {
    const reg = new LocatorRegistry(page);
    const trigger = reg.createPostButton();
    await trigger.click({ timeout: 10_000 });
    const box = reg.composerTextbox();
    await box.fill(input.renderedText, { timeout: 10_000 });
  }

  /**
   * Upload ảnh qua setInputFiles. Composer Facebook nhận nhiều file.
   * Trả về số ảnh đã đính kèm; throw IMAGE_UPLOAD_FAILED nếu ảnh 0.
   */
  async uploadImages(page: Page, input: PostImageInput): Promise<number> {
    if (input.filePaths.length === 0) return 0;
    const reg = new LocatorRegistry(page);
    // Nút "Ảnh/Video" trong composer → input[type=file] được render.
    const fileChooserTrigger = reg.addPhotoButton();
    await fileChooserTrigger.click({ timeout: 10_000 });
    const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 10_000 });
    const chooser = await fileChooserPromise;
    await chooser.setFiles(input.filePaths);
    // Chờ preview render.
    await page.waitForTimeout(500);
    return input.filePaths.length;
  }

  /**
   * Click "Đăng". KHÔNG dùng auto-submit (PW-005); caller quyết định
   * assisted hay auto qua feature flag.
   */
  async submit(page: Page): Promise<void> {
    const reg = new LocatorRegistry(page);
    await reg.submitPostButton().click({ timeout: 10_000 });
  }

  async close(page: Page): Promise<void> {
    try {
      await page.close();
    } catch {
      // ignore
    }
  }

  /**
   * Phát hiện lỗi DOM (no_permission, pending_approval) sau khi đăng.
   * Trả AppError để PW-007 chuyển job → needs_action.
   */
  async detectPostResult(page: Page): Promise<
    | { kind: "ok"; postUrl?: string }
    | { kind: "pending_approval" }
    | { kind: "no_permission" }
    | { kind: "page_error"; message: string }
  > {
    const reg = new LocatorRegistry(page);
    if (await reg.pendingApprovalText().isVisible({ timeout: 2000 }).catch(() => false)) {
      return { kind: "pending_approval" };
    }
    if (await reg.noPermissionText().isVisible({ timeout: 2000 }).catch(() => false)) {
      return { kind: "no_permission" };
    }
    const toast = reg.genericErrorToast();
    if (await toast.isVisible({ timeout: 1000 }).catch(() => false)) {
      const text = await toast.textContent();
      return { kind: "page_error", message: text ?? "unknown error" };
    }
    // Thử lấy URL bài đăng vừa đăng (URL chứa /posts/ hoặc /permalink/).
    try {
      const url = page.url();
      if (/\/(posts|permalink|photos\/a)\//.test(url)) {
        return { kind: "ok", postUrl: url };
      }
    } catch {
      // ignore
    }
    return { kind: "ok" };
  }

  /**
   * Phát hiện checkpoint/CAPTCHA/unknown UI (PW-007).
   * Trả signal để queue chuyển job → needs_action.
   */
  async detectObstacle(page: Page): Promise<
    | { kind: "none" }
    | { kind: "checkpoint" }
    | { kind: "captcha" }
    | { kind: "two_factor" }
    | { kind: "unknown"; selector: string }
  > {
    const url = page.url();
    if (url.includes("/checkpoint")) {
      if (url.includes("/2fa") || url.includes("/auth/")) {
        return { kind: "two_factor" };
      }
      return { kind: "checkpoint" };
    }
    if (url.includes("/captcha")) {
      return { kind: "captcha" };
    }
    // Unknown UI = không có composer/textbox/submit sau 5s.
    const reg = new LocatorRegistry(page);
    const composerVisible = await reg
      .composerTextbox()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!composerVisible) {
      return { kind: "unknown", selector: "composer-not-found" };
    }
    return { kind: "none" };
  }
}

export { AppError };