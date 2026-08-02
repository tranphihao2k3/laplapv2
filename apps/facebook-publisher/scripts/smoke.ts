/**
 * Smoke script: khởi chạy Electron app ở dev mode.
 *
 * Dùng để verify build pipeline (electron-vite + main + preload + renderer)
 * hoạt động end-to-end trên máy dev mà KHÔNG cần native VS build.
 *
 * Cách dùng: `npm run smoke`
 * - Biên dịch main/preload/renderer với electron-vite.
 * - Khởi chạy Electron headless (xvfb) trong 5s.
 * - Nếu main process không crash → in "OK".
 *
 * KHÔNG đụng Playwright thật (cần Chromium binary thật).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = resolve(__dirname, "..");
const electronExe = resolve(
  appRoot,
  "node_modules",
  "electron",
  "dist",
  process.platform === "win32" ? "electron.exe" : "electron",
);

if (!existsSync(electronExe)) {
  console.error("Không tìm thấy electron binary tại", electronExe);
  process.exit(1);
}

console.log(">>> build electron-vite ...");
const build = spawn("npm", ["run", "build"], {
  cwd: appRoot,
  stdio: "inherit",
  shell: true,
});

build.on("exit", (code) => {
  if (code !== 0) {
    console.error("Build failed với code", code);
    process.exit(code ?? 1);
  }
  console.log(">>> build OK. Khởi chạy Electron trong 5s ...");
  const electron = spawn(
    electronExe,
    [resolve(appRoot, "out", "main", "index.js"), "--no-sandbox"],
    {
      cwd: appRoot,
      stdio: "inherit",
      windowsHide: true,
      env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: "1" },
    },
  );

  const timer = setTimeout(() => {
    console.log(">>> 5s elapsed. Killing Electron (headless smoke).");
    electron.kill();
  }, 5000);

  electron.on("exit", (eCode) => {
    clearTimeout(timer);
    if (eCode === 0 || eCode === null) {
      console.log(">>> SMOKE OK (Electron main process did not crash).");
      process.exit(0);
    } else {
      console.error(">>> Electron exited với code", eCode);
      process.exit(eCode ?? 1);
    }
  });
});
