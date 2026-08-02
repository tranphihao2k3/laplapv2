/**
 * Tạo HTML file tạm với snapshot bypass flag inline ở đầu <head>.
 * Load file này thay vì renderer/index.html để __SNAPSHOT_BYPASS__ được set
 * trước khi React bundle chạy.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync, copyFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

const appRoot = resolve(__dirname, "..");
const rendererDir = resolve(appRoot, "out", "renderer");
const tmpDir = resolve(appRoot, "out", "snapshot");

if (!existsSync(join(rendererDir, "index.html"))) {
  console.error("Chưa build renderer. Chạy `npm run build` trước.");
  process.exit(1);
}
mkdirSync(tmpDir, { recursive: true });

// Copy assets folder next to patched index.html
const rendererAssets = join(rendererDir, "assets");
const tmpAssets = join(tmpDir, "assets");
if (!existsSync(tmpAssets)) mkdirSync(tmpAssets, { recursive: true });
for (const f of readdirSync(rendererAssets)) {
  copyFileSync(join(rendererAssets, f), join(tmpAssets, f));
}

const original = readFileSync(join(rendererDir, "index.html"), "utf8");
const patched = original.replace(
  /<head>/i,
  `<head>
  <script>window.__SNAPSHOT_BYPASS__ = true;</script>
`,
);

const tmpHtml = join(tmpDir, "index.html");
writeFileSync(tmpHtml, patched, "utf8");
console.log("Wrote", tmpHtml);
process.exit(0);