/**
 * Electron main process entry.
 *
 * Milestone 2 / APP-001 — chỉ scaffold app shell để desktop typecheck/build pass
 * và mở được ở dev. Security hardening (contextIsolation, IPC allowlist, CSP)
 * thuộc APP-002. Đừng thêm tính năng ngoài scope ở đây — theo tài liệu
 * docs/FB-PUBLISHER-TASKS.md §10.
 */
import { app, BrowserWindow } from "electron";
import path from "node:path";

const isDev = !app.isPackaged;

/**
 * Tạo cửa sổ chính. Stub — APP-002 sẽ thay bằng cấu hình secure:
 *   contextIsolation: true, nodeIntegration: false, sandbox: true,
 *   CSP, navigation allowlist, preload IPC allowlist.
 */
function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: "LapLap Facebook Publisher",
    // APP-002 sẽ thay bằng preload + contextIsolation đúng chuẩn.
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
    },
    show: false,
  });

  // Hiện cửa sổ sau khi renderer load xong → tránh flash trắng (FART).
  win.once("ready-to-show", () => {
    win.show();
  });

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    void win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  return win;
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // macOS convention: app vẫn chạy khi đóng hết window.
  if (process.platform !== "darwin") app.quit();
});
