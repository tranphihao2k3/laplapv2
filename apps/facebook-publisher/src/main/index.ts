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
 * IPC handlers được đăng ký qua `registerIpcHandlers()` ở main/ipc.ts —
 * mọi payload đều validate qua Zod trước khi chạm logic (xem ipc.ts).
 */
import { app, BrowserWindow, shell, session } from "electron";
import path from "node:path";
import { registerIpcHandlers } from "./ipc";

const isDev = !app.isPackaged;

/** CSP áp dụng cho mọi response render — không để renderer pull script ngoài. */
const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self'",
  // 'unsafe-inline' cho style vì React/Vite dev inject inline style; production
  // sẽ bundle ra file tách. khi review có thể thu hẹp thêm.
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

function createMainWindow(): BrowserWindow {
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
      // Tắt các tính năng không cần → giảm attack surface.
      webviewTag: false,
      spellcheck: false,
      // Không cho phép renderer mở DevTools ở production.
      devTools: isDev,
    },
  });

  win.once("ready-to-show", () => win.show());

  // Chặn navigation tới origin ngoài allowlist — mở bằng shell.openExternal
  // thay vì navigate để không phá flow.
  win.webContents.on("will-navigate", (event, url) => {
    if (!isRendererAllowedUrl(url)) {
      event.preventDefault();
      console.warn(`[main] blocked navigation to ${url}`);
      if (url.startsWith("https://")) {
        void shell.openExternal(url).catch(() => undefined);
      }
    }
  });

  // Chặn window.open (target=_blank) — mọi popup đều phải qua IPC.
  win.webContents.setWindowOpenHandler(({ url }) => {
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
  // CSP áp dụng cho mọi response của session mặc định.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [CSP_HEADER],
      },
    });
  });
}

app.whenReady().then(() => {
  configureSession();
  registerIpcHandlers();
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
