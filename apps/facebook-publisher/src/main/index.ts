/**
 * Electron main process entry.
 *
 * APP-002 hardening:
 *  - contextIsolation: true, nodeIntegration: false, sandbox: true.
 *  - CSP header trong mọi response (default-src 'self').
 *  - Navigation allowlist: chặn navigate tới origin khác (chỉ cho file:// hoặc dev server).
 *  - window.open bị chặn bừa — chỉ cho phép khi đi qua IPC handler allowlist.
 *  - Không DevTools mở ở production.
 *
 * APP-003 wiring:
 *  - Open SQLite DB ngay khi app ready (chạy migrations), init services.
 *  - Worker / queue sẽ wire ở các task APP-* sau — chưa khởi động ở đây
 *    để giữ scope APP-003 chỉ về settings.
 */
import { app, BrowserWindow, shell, session } from "electron";
import path from "node:path";
import { registerIpcHandlers } from "./ipc";
import { openDb, closeDb } from "./db/connection";
import { runMigrations } from "./db/migrations";
import { initServices } from "./services/service-locator";

const isDev = !app.isPackaged;

/** CSP áp dụng cho mọi response render — không để renderer pull script ngoài. */
const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Origin renderer được phép load — tất cả origin khác bị chặn. */
function isRendererAllowedUrl(url: string): boolean {
  if (url.startsWith("file://")) return true;
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    const devUrl = new URL(process.env["ELECTRON_RENDERER_URL"]);
    return url.startsWith(`${devUrl.protocol}//${devUrl.host}`);
  }
  return false;
}

function createMainWindow(): InstanceType<typeof BrowserWindow> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: "LapLap Facebook Publisher",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      spellcheck: false,
      devTools: isDev,
    },
  });

  win.once("ready-to-show", () => win.show());

  win.webContents.on("will-navigate", (event: any, url: string) => {
    if (!isRendererAllowedUrl(url)) {
      event.preventDefault();
      console.warn(`[main] blocked navigation to ${url}`);
      if (url.startsWith("https://")) {
        void shell.openExternal(url).catch(() => undefined);
      }
    }
  });

  win.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    console.warn(`[main] blocked window.open for ${url}`);
    if (url.startsWith("https://")) {
      void shell.openExternal(url).catch(() => undefined);
    }
    return { action: "deny" };
  });

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    void win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  return win;
}

function configureSession(): void {
  session.defaultSession.webRequest.onHeadersReceived((details: any, callback: (response: any) => void) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [CSP_HEADER],
      },
    });
  });
}

/**
 * Lifecycle: open DB → migrate (idempotent) → init services → register IPC
 * → tạo window. Nếu DB lỗi, app không tạo window để tránh chạy với state
 * không xác định.
 */
function startup(): void {
  try {
    const db = openDb();
    // Migration chạy idempotent mỗi lần startup để đảm bảo schema up-to-date
    // khi user upgrade app (REL-001 + DB-002 upgrade test).
    runMigrations(db);
    initServices(db);
  } catch (err) {
    console.error("[startup] failed to init DB/services:", err);
    // Quit cứng — không cho chạy app với DB hỏng.
    app.quit();
    return;
  }
  configureSession();
  registerIpcHandlers();
  createMainWindow();
}

app.whenReady().then(() => {
  startup();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  // Đóng DB an toàn — tránh WAL orphan khi user update app.
  closeDb();
});
