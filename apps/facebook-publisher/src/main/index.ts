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
import {
  initServices,
  getCachedBrowserProfileManager,
  getCachedSerialWorker,
} from "./services/service-locator";
import { createFbRunner } from "./services/fb-runner";

const isDev = !app.isPackaged;

/** CSP áp dụng cho mọi response render — không để renderer pull script ngoài. */
const CSP_HEADER = [
  "default-src 'self'",
  // Dev mode cần 'unsafe-inline' + 'unsafe-eval' cho Vite HMR (react-refresh inline).
  // Production: bundle self-contained, CSP tighten về 'self'. Phát hiện qua
  // ELECTRON_RENDERER_URL (chỉ set trong dev) — production build không có env này.
  // Snapshot mode: cần 'unsafe-inline' cho script bypass flag inject trong
  // src/snapshot/index.html (xem scripts/ui-snapshot.ts).
  process.env["ELECTRON_SNAPSHOT_DIR"] || process.env["ELECTRON_RENDERER_URL"]
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  // Dev cần ws: cho HMR socket + http://localhost:* cho các dev server.
  process.env["ELECTRON_RENDERER_URL"]
    ? `connect-src 'self' ws: http://localhost:* https://*.supabase.co`
    : "connect-src 'self' https://*.supabase.co",
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
    // Dev bypass: nếu URL có query `?bypass=1` thì inject __SNAPSHOT_BYPASS__ flag
    // vào renderer ngay khi page load. Mục đích: xem UI khi chưa cấu hình Supabase
    // (auth IPC sẽ hang → loading mãi). KHÔNG ảnh hưởng production (không có env này).
    const rendererUrl = process.env["ELECTRON_RENDERER_URL"];
    const bypassMode = process.env["ELECTRON_DEV_BYPASS_AUTH"] === "1";
    const targetUrl = bypassMode
      ? rendererUrl + (rendererUrl.includes("?") ? "&" : "?") + "bypass=1"
      : rendererUrl;
    void win.loadURL(targetUrl);
    if (bypassMode) {
      // Inject flag ngay sau khi DOM ready — renderer sẽ đọc localStorage
      // hoặc window flag để bypass RequireAuth check.
      win.webContents.once("did-finish-load", () => {
        void win.webContents
          .executeJavaScript(
            `try { localStorage.setItem('__SNAPSHOT_BYPASS__', '1'); window.__SNAPSHOT_BYPASS__ = true; } catch (e) {}`,
          )
          .catch(() => undefined);
      });
    }
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
  // Wire Facebook posting runner cho SerialWorker. ServiceLocator tạo
  // SerialWorker với placeholder runner ở initServices(); ở đây ta replace
  // bằng runner thật dùng FacebookGroupAdapter + BrowserProfileManager.
  // Browser session đã launch-on-demand trong runner (headed — cửa sổ
  // Chromium TỰ HIỆN để user xem trực tiếp).
  try {
    getCachedSerialWorker().setRunner(
      createFbRunner(getCachedBrowserProfileManager()),
    );
    console.log("[startup] SerialWorker runner = fb-runner (Playwright headed)");
  } catch (err) {
    console.error("[startup] failed to set fb runner:", err);
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

  // UI snapshot mode (CI/headless verification): capture renderer pages to PNG
  // rồi quit. Trigger bằng env ELECTRON_SNAPSHOT_DIR=<path>.
  if (process.env["ELECTRON_SNAPSHOT_DIR"]) {
    void runSnapshotMode(process.env["ELECTRON_SNAPSHOT_DIR"]);
  }
});

/**
 * Snapshot renderer pages ra PNG files. Dùng cho CI verification khi máy dev
 * không có desktop display (Windows Server / container).
 *
 * Vì renderer gọi bootstrap() → authGetStatus() → status sẽ về "unauthenticated"
 * (chưa login Supabase) → RequireAuth sẽ redirect /login. Capture trang login
 * và layout (sau khi bypass auth qua env) là 2 chế độ:
 *   - default: capture /login
 *   - ELECTRON_SNAPSHOT_BYPASS_AUTH=1: capture /catalog với auth mock
 */
async function runSnapshotMode(dir: string): Promise<void> {
  const { writeFileSync } = await import("node:fs");
  const path = await import("node:path");
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) {
    console.error("[snapshot] no window to capture");
    app.quit();
    return;
  }
  // Wait for renderer ready
  await new Promise<void>((r) => setTimeout(r, 3000));
  const rendererIndex = path.join(__dirname, "../renderer/index.html");
  // Snapshot bundle được Vite build vào out/snapshot/src/snapshot/index.html
  // (root = src/snapshot/index.html được Vite mirror lại).
  const snapshotIndex = path.join(__dirname, "../snapshot/src/snapshot/index.html");
  const targets: Array<{ hash: string; name: string; bypass: boolean }> = [
    { hash: "", name: "01-login", bypass: false },
  ];
  if (process.env["ELECTRON_SNAPSHOT_BYPASS_AUTH"] === "1") {
    targets.push(
      { hash: "/catalog", name: "02-catalog", bypass: true },
      { hash: "/groups", name: "03-groups", bypass: true },
      { hash: "/templates", name: "04-templates", bypass: true },
      { hash: "/campaigns", name: "05-campaigns", bypass: true },
      { hash: "/queue", name: "06-queue", bypass: true },
      { hash: "/history", name: "07-history", bypass: true },
      { hash: "/settings", name: "08-settings", bypass: true },
    );
  }
  for (const t of targets) {
    try {
      const filePath = t.bypass ? snapshotIndex : rendererIndex;
      const url = "file://" + filePath + (t.hash ? `#${t.hash}` : "");
      await win.loadURL(url);
      await new Promise<void>((r) => setTimeout(r, 1500));
      // Mock store với auth + settings giả cho các trang authenticated.
      if (t.bypass) {
        await win.webContents.executeJavaScript(`
          (function() {
            try {
              const useStore = window.__APP_STORE__;
              if (useStore) {
                useStore.setState({
                  status: { kind: "authenticated", user: { id: "snapshot", email: "snapshot@laplap.local" } },
                  data: {
                    apiBaseUrl: "https://api.laplap.vn",
                    locale: "vi-VN",
                    postingMode: "assisted",
                    autoSubmit: false,
                    timeouts: { stepMs: 8000, pageLoadMs: 30000 },
                    diagnosticsTtlDays: 14,
                  },
                  defaults: {
                    apiBaseUrl: "https://api.laplap.vn",
                    locale: "vi-VN",
                    postingMode: "assisted",
                    autoSubmit: false,
                    timeouts: { stepMs: 8000, pageLoadMs: 30000 },
                    diagnosticsTtlDays: 14,
                  },
                });
              }
            } catch (e) { console.error("mock store failed", e); }
          })();
        `);
        await new Promise<void>((r) => setTimeout(r, 2500));
      }
      const img = await win.webContents.capturePage();
      const buf = img.toPNG();
      const outPath = path.join(dir, `${t.name}.png`);
      writeFileSync(outPath, buf);
      console.log(`[snapshot] ${t.name} → ${outPath} (${buf.length} bytes)`);
    } catch (e) {
      console.error(`[snapshot] ${t.name} failed:`, e);
    }
  }
  app.quit();
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  // Đóng DB an toàn — tránh WAL orphan khi user update app.
  closeDb();
});
