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

  /**
   * Nút mở composer trong group.
   *
   * Facebook group có 3 kiểu composer trigger (tùy layout):
   *   1. Button có aria-label "Viết bài"/"Write something"/"Create post"
   *   2. Textarea/contenteditable với placeholder "Bạn đang nghĩ gì?"
   *   3. Tab "Discussion" đã active sẵn, composer ở dạng inline
   *
   * Trả về một Locator (gộp nhiều match) — caller chỉ cần click .first().
   * Lý do không dùng .first() ở đây: muốn match ưu tiên (button có label rõ)
   * trước khi rơi xuống textarea placeholder.
   */
  createPostButton(): Locator {
    return this.page
      .locator(":is(button, [role=button], a)")
      .filter({ hasText: /viết bài|write something|create post|create a post|viết bài đăng/i })
      .first();
  }

  /** Composer trigger dạng textbox/textarea (placeholder-based fallback). */
  composerTriggerTextbox(): Locator {
    return this.page
      .getByRole("textbox", {
        name: /bạn đang nghĩ gì|write something|create a post|tạo bài đăng/i,
      })
      .first();
  }

  /** Generic fallback: textarea/contenteditable đầu tiên trong page. */
  anyComposerTextbox(): Locator {
    return this.page
      .locator(
        'textarea:not([readonly]):not([disabled]), [contenteditable="true"][role="textbox"], [contenteditable="true"]',
      )
      .first();
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

  /** Indicator "Bạn không thể đăng (chưa là thành viên)" — group non-member view. */
  notMemberText(): Locator {
    return this.page.getByText(/tham gia nhóm|join group|you must join|bạn cần tham gia/i).first();
  }

  /** Indicator "Không có quyền đăng". */
  noPermissionText(): Locator {
    return this.page.getByText(/bạn không có quyền|you don.?t have permission/i).first();
  }

  /** Generic: bất kỳ composer trigger nào có thể click được (button / textbox / contenteditable). */
  anyComposerTrigger(): Locator {
    return this.page
      .locator(
        '[role=button][aria-label*="iết" i], [role=button][aria-label*="reate" i], [aria-label*="hought" i], textarea:not([readonly]):not([disabled]), [contenteditable="true"][role="textbox"], [contenteditable="true"]',
      )
      .first();
  }

  /** Thông báo lỗi chung. */
  genericErrorToast(): Locator {
    return this.page.locator('[role="alert"]').first();
  }
}