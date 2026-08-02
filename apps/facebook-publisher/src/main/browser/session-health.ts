/**
 * SessionHealthChecker — PW-002.
 *
 * Phát hiện trạng thái session Facebook từ cookies + URL sau khi truy
 * cập trang facebook.com:
 *  - logged_in: có c_user cookie + URL không có /login
 *  - logged_out: thiếu c_user
 *  - checkpoint: URL chứa /checkpoint/
 *  - 2fa_required: URL chứa /checkpoint/ và 2FA challenge
 *
 * KHÔNG lưu cookie/password Facebook. Chỉ inspect.
 */
import type { BrowserContext } from "playwright-core";

export type SessionHealth =
  | { kind: "unknown" }
  | { kind: "checking" }
  | {
      kind: "logged_in";
      cookies: string[];
    }
  | { kind: "logged_out" }
  | { kind: "checkpoint"; reason: string }
  | { kind: "two_fa_required" }
  | { kind: "needs_captcha" }
  | { kind: "blocked" }
  | { kind: "page_error"; message: string };

const FB_LOGIN_HOSTS = new Set([
  "www.facebook.com",
  "facebook.com",
  "m.facebook.com",
]);

export async function checkSessionHealth(context: BrowserContext): Promise<SessionHealth> {
  const cookies = await context.cookies();
  const cUser = cookies.find((c: any) => c.name === "c_user");
  const fbCookie = cookies.find((c: any) =>
    FB_LOGIN_HOSTS.has(new URL(c.domain).hostname) || c.domain.endsWith(".facebook.com"),
  );

  // Lấy URL hiện tại qua page (1 tab đầu tiên nếu có).
  const pages = context.pages();
  const currentUrl = pages[0]?.url() ?? "";
  let url = "";
  try {
    url = new URL(currentUrl).toString();
  } catch {
    // ignore
  }

  if (!cUser && !fbCookie) {
    return { kind: "logged_out" };
  }

  if (url.includes("/login")) {
    return { kind: "logged_out" };
  }
  if (url.includes("/checkpoint")) {
    if (url.includes("2fa") || url.includes("/auth/")) {
      return { kind: "two_fa_required" };
    }
    return { kind: "checkpoint", reason: "URL contains /checkpoint/" };
  }
  if (url.includes("/captcha")) {
    return { kind: "needs_captcha" };
  }

  return {
    kind: "logged_in",
    cookies: cookies.filter((c: any) => c.domain.endsWith("facebook.com")).map((c: any) => c.name),
  };
}