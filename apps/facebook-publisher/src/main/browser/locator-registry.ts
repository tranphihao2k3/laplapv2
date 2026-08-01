/**
 * LocatorRegistry — PW-003.
 *
 * Tập trung selector theo role/label/text tiếng Việt. KHÔNG dùng XPath
 * dài hoặc CSS chain sâu (docs §12 PW-003).
 *
 * Nếu cần thêm selector khi UI Facebook đổi → thêm vào đây, không
 * rải rác trong adapter.
 */
import type { Locator, Page } from "playwright-core";

export class LocatorRegistry {
  constructor(private readonly page: Page) {}

  /** Nút mở composer trong group. */
  createPostButton(): Locator {
    return this.page.getByRole("button", { name: /viết bài|tạo bài đăng|create post/i }).first();
  }

  /** Ô composer textarea (rich text editor). */
  composerTextbox(): Locator {
    // Facebook dùng contentEditable div với aria-label.
    return this.page.getByRole("textbox", { name: /tạo bài đăng|create a post/i }).first();
  }

  /** Nút "Đăng" submit composer. */
  submitPostButton(): Locator {
    return this.page.getByRole("button", { name: /^\s*(đăng|post)\s*$/i }).first();
  }

  /** Nút "Thêm ảnh/video". */
  addPhotoButton(): Locator {
    return this.page.getByRole("button", { name: /ảnh|photo|video/i }).first();
  }

  /** Indicator "Bài viết của bạn đang được xét duyệt". */
  pendingApprovalText(): Locator {
    return this.page.getByText(/đang được xét duyệt|pending approval|đang chờ duyệt/i).first();
  }

  /** Indicator "Không có quyền đăng". */
  noPermissionText(): Locator {
    return this.page.getByText(/bạn không có quyền|you don.?t have permission/i).first();
  }

  /** Thông báo lỗi chung. */
  genericErrorToast(): Locator {
    return this.page.locator('[role="alert"]').first();
  }
}