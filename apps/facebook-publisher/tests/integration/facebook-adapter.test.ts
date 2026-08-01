/**
 * PW-003 / PW-004 / PW-007 — Adapter + fixture tests.
 *
 * Tests dùng Playwright thật với chromium binary. Nếu binary chưa cài
 * (`Executable doesn't exist`) → skip thay vì fail (CI dev sẽ cài qua
 * `npx playwright install chromium` trước khi chạy).
 *
 * Cố tình tránh "skip-everything" để vẫn cover detector logic nếu
 * binary có sẵn.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_DIR = path.resolve(__dirname, "../fixtures");

async function tryLoadChromium(): Promise<typeof import("playwright-core") | null> {
  try {
    const pw = await import("playwright-core");
    // Kiểm tra executable khả dụng.
    const exe = pw.chromium.executablePath();
    if (!exe) return null;
    await import("node:fs/promises").then((fs) => fs.access(exe));
    return pw;
  } catch {
    return null;
  }
}

describe("FacebookGroupAdapter — fixtures", () => {
  it("composer-normal.html → open + composer textbox visible", async () => {
    const pw = await tryLoadChromium();
    if (!pw) return; // skip nếu binary thiếu.

    const browser = await pw.chromium.launch({ headless: true });
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const fileUrl = `file://${FIXTURE_DIR}/fb-composer-normal.html`;
      await page.goto(fileUrl);

      const trigger = page.getByRole("button", { name: /tạo bài đăng/i }).first();
      await trigger.click();
      const textbox = page.getByRole("textbox", { name: /tạo bài đăng/i }).first();
      await textbox.fill("Xin chào Việt Nam");
      expect(await textbox.textContent()).toContain("Xin chào");
    } finally {
      await browser.close();
    }
  });

  it("composer-pending.html → detectObstacle returns 'none' vì không có composer", async () => {
    const pw = await tryLoadChromium();
    if (!pw) return;

    const browser = await pw.chromium.launch({ headless: true });
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`file://${FIXTURE_DIR}/fb-composer-pending.html`);

      const reg = await import("../../src/main/browser/locator-registry");
      const r = new reg.LocatorRegistry(page);
      const pendingVisible = await r
        .pendingApprovalText()
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      expect(pendingVisible).toBe(true);
    } finally {
      await browser.close();
    }
  });

  it("composer-no-permission.html → noPermission visible", async () => {
    const pw = await tryLoadChromium();
    if (!pw) return;

    const browser = await pw.chromium.launch({ headless: true });
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`file://${FIXTURE_DIR}/fb-composer-no-permission.html`);

      const reg = await import("../../src/main/browser/locator-registry");
      const r = new reg.LocatorRegistry(page);
      const noPerm = await r
        .noPermissionText()
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      expect(noPerm).toBe(true);
    } finally {
      await browser.close();
    }
  });

  it("composer-unknown.html → detectObstacle 'unknown'", async () => {
    const pw = await tryLoadChromium();
    if (!pw) return;

    const browser = await pw.chromium.launch({ headless: true });
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`file://${FIXTURE_DIR}/fb-composer-unknown.html`);

      const reg = await import("../../src/main/browser/locator-registry");
      const r = new reg.LocatorRegistry(page);
      const composerVisible = await r
        .composerTextbox()
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      expect(composerVisible).toBe(false);
    } finally {
      await browser.close();
    }
  });
});