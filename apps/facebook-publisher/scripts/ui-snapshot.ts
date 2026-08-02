/**
 * UI snapshot — chạy Electron app, capture renderer ra PNG.
 *
 * Mục đích: verify UI render đúng trên máy không có desktop display
 * (Windows Server / container). Capture trong Electron process thay vì
 * phụ thuộc vào screen capture của OS.
 *
 * Cách dùng:
 *   tsx scripts/ui-snapshot.ts
 *
 * Output: out/snapshot/{login,layout,catalog,groups,templates,settings}.png
 *
 * Cơ chế:
 *   1. Spawn electron.exe trỏ vào out/main/index.js
 *   2. Patch main process qua env flag: SKIP_HW_ACCEL=1 để tránh GPU cache
 *   3. IPC: gọi publisherApi từ main → render UI → capturePage → save PNG
 *   4. Close app
 *
 * Phụ thuộc: electron đã build, out/main/index.js tồn tại.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = resolve(__dirname, "..");
const outMain = resolve(appRoot, "out", "main", "index.js");
const snapshotIndex = resolve(appRoot, "out", "snapshot", "src", "snapshot", "index.html");
const electronExe = resolve(
  appRoot,
  "node_modules",
  "electron",
  "dist",
  process.platform === "win32" ? "electron.exe" : "electron",
);
const snapshotDir = resolve(appRoot, "out", "snapshot");

if (!existsSync(electronExe)) {
  console.error("Không tìm thấy electron tại", electronExe);
  process.exit(1);
}
if (!existsSync(outMain)) {
  console.error("Chưa build main. Chạy `npm run build` trước.");
  process.exit(1);
}
if (!existsSync(snapshotIndex)) {
  console.error(
    "Chưa build snapshot bundle (out/snapshot/index.html). Chạy `npm run build` để electron-vite tạo entry 'snapshot'.",
  );
  process.exit(1);
}
if (!existsSync(snapshotDir)) mkdirSync(snapshotDir, { recursive: true });

console.log(">>> Khởi chạy Electron với snapshot mode ...");
console.log(">>> Output:", snapshotDir);

// Inject snapshot config qua env. Main process sẽ tự xử lý nếu có flag này.
const electron = spawn(
  electronExe,
  [
    outMain,
    "--no-sandbox",
    "--disable-gpu",
    "--disable-software-rasterizer",
  ],
  {
    cwd: appRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_SNAPSHOT_DIR: snapshotDir,
      ELECTRON_SNAPSHOT_BYPASS_AUTH: process.env["ELECTRON_SNAPSHOT_BYPASS_AUTH"] ?? "1",
      ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
    },
  },
);

let stdoutBuf = "";
let stderrBuf = "";
electron.stdout.on("data", (b) => {
  const s = b.toString();
  stdoutBuf += s;
  process.stdout.write(s);
});
electron.stderr.on("data", (b) => {
  const s = b.toString();
  stderrBuf += s;
  process.stderr.write(s);
});

const TIMEOUT_MS = 90_000;
const killer = setTimeout(() => {
  console.log(">>> timeout. Killing electron");
  electron.kill();
}, TIMEOUT_MS);

electron.on("exit", (code, signal) => {
  clearTimeout(killer);
  console.log(`>>> Electron exit code=${code} signal=${signal}`);

  // Check files
  try {
    const files = require("node:fs").readdirSync(snapshotDir);
    console.log(">>> Snapshot files:", files);
    if (files.length === 0) {
      console.error(">>> Không có PNG nào được tạo.");
      console.error(">>> stderr:", stderrBuf.slice(-2000));
      process.exit(1);
    }
    process.exit(0);
  } catch (e) {
    console.error(">>> Lỗi đọc snapshot dir:", e);
    process.exit(1);
  }
});