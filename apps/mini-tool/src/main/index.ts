import { app, BrowserWindow, shell, session, protocol, net } from "electron";
import path from "node:path";
import { registerIpcHandlers, setAudioDir } from "./ipc";
import {
  ensureTestAudioDir,
  resolveAudioPath,
  BUILTIN_AUDIO,
} from "./audio";

const isDev = !app.isPackaged;

// Register custom scheme as privileged so it can serve audio (and bypass CSP).
protocol.registerSchemesAsPrivileged([
  {
    scheme: "lap-audio",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

async function registerAudioProtocol(audioDir: string): Promise<void> {
  protocol.handle("lap-audio", async (request) => {
    try {
      const url = new URL(request.url);
      const resolved = await resolveAudioPath(audioDir, url.pathname);
      if (!resolved) {
        return new Response("Not found", { status: 404 });
      }
      return net.fetch(`file://${resolved.replace(/\\/g, "/")}`);
    } catch (err) {
      return new Response(`Audio error: ${(err as Error).message}`, {
        status: 500,
      });
    }
  });
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  // Allow microphone and camera requests from the app
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === "media") {
      callback(true);
    } else {
      callback(false);
    }
  });

  win.once("ready-to-show", () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  return win;
}

app.setName("LapLap Mini Tool");

if (process.env["LAPLAP_PORTABLE"] === "1" || !app.isPackaged) {
  app.setPath("userData", path.join(process.cwd(), ".tmp-userdata"));
}

app.whenReady().then(async () => {
  const audioDir = await ensureTestAudioDir(app.getPath("userData"));
  setAudioDir(audioDir);
  await registerAudioProtocol(audioDir);
  console.log(`[audio] test files ready at: ${audioDir}`);

  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});