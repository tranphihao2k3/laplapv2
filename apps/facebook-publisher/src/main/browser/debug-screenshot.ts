/**
 * Debug screenshot helper — lưu screenshot + HTML snapshot khi runner fail
 * để dev có thể inspect DOM thật của Facebook sau khi test.
 *
 * Output path: <userData>/debug/<timestamp>-<label>.png + .html
 */
import path from "node:path";
import fs from "node:fs/promises";
import type { Page } from "playwright-core";
import { app } from "electron";

export async function captureDebugScreenshot(page: Page, label: string): Promise<string | null> {
  try {
    const dir = path.join(app.getPath("userData"), "debug");
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    const fileBase = `${stamp}-${safeLabel}`;
    const pngPath = path.join(dir, `${fileBase}.png`);
    const htmlPath = path.join(dir, `${fileBase}.html`);
    const [buf, html] = await Promise.all([
      page.screenshot({ fullPage: true, path: pngPath }).catch(() => null),
      page.content().catch(() => ""),
    ]);
    if (buf) {
      await fs.writeFile(pngPath, buf).catch(() => {});
    }
    if (html) {
      await fs.writeFile(htmlPath, html, "utf8").catch(() => {});
    }
    console.warn(`[debug] screenshot saved: ${pngPath}`);
    if (html) console.warn(`[debug] html snapshot saved: ${htmlPath}`);
    return pngPath;
  } catch (err) {
    console.error(`[debug] screenshot failed:`, err);
    return null;
  }
}