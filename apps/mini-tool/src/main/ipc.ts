import { ipcMain, dialog, shell, app, BrowserWindow } from "electron";
import path from "node:path";
import { runPwshCommand, runPwshScript } from "./powershell";
import { sign, getSecretFingerprint } from "./crypto";
import { getStoredSession, setStoredSession, clearStoredSession } from "./session";
import { buildUploadPayload, uploadToServer } from "./upload";
import { readClipboardText } from "./clipboard";
import { detectFurmark } from "./benchmark";
import { streamHardware } from "./hardware";
import { z } from "zod";

const OptimizeArgs = z.object({
  kind: z.enum([
    "clean-temp",
    "disable-bitlocker",
    "rename-pc",
    "set-wallpaper",
  ]),
  newName: z.string().min(1).optional(),
  wallpaperPath: z.string().min(1).optional(),
});

const UploadArgs = z.object({
  hardware: z.unknown().optional(),
  benchmark: z.unknown().optional(),
  tests: z.unknown().optional(),
});

const SessionImportArgs = z.object({
  sid: z.string().min(8),
  uploadUrl: z.string().url().optional(),
  webUrl: z.string().url().optional(),
  expiresAt: z.string().optional(),
});

// Hardware streaming: start → main process gọi PowerShell stream → mỗi phần xong
// sẽ `webContents.send("lap:hardware:part", part)`. Renderer subscribe qua preload.
// Track handle để có thể stop (chưa dùng ngoài UI refresh).
const hardwareHandles = new Map<number, { stop: () => void }>();

export function registerIpcHandlers(): void {
  ipcMain.handle("lap:hardware:collect", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const webContents = win?.webContents ?? event.sender;
    const channel = "lap:hardware:part";
    // Stop stream cũ nếu có (refresh liên tục).
    const prev = hardwareHandles.get(webContents.id);
    if (prev) prev.stop();
    const handle = streamHardware((part) => {
      if (webContents.isDestroyed()) return;
      webContents.send(channel, part);
      if (part.key === "__done__" || (part.key === "__error__" && !part.ok)) {
        hardwareHandles.delete(webContents.id);
      }
    });
    hardwareHandles.set(webContents.id, handle);
    return { ok: true, data: { started: true } };
  });

  ipcMain.handle("lap:hardware:cancel", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const webContents = win?.webContents ?? event.sender;
    const prev = hardwareHandles.get(webContents.id);
    if (prev) {
      prev.stop();
      hardwareHandles.delete(webContents.id);
    }
    return { ok: true };
  });

  ipcMain.handle("lap:bench:furmark:detect", async () => {
    try {
      const found = await detectFurmark();
      return { ok: true, data: found };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:bench:furmark:launch", async (_evt, exePath: string) => {
    try {
      if (typeof exePath !== "string" || !exePath) {
        throw new Error("Missing exePath");
      }
      const escaped = exePath.replace(/'/g, "''");
      const result = await runPwshCommand(
        `Start-Process '${escaped}' -Verb RunAs`,
        5000,
      );
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:optimize:run", async (_evt, args: unknown) => {
    const parsed = OptimizeArgs.safeParse(args);
    if (!parsed.success) {
      return { ok: false, error: "Invalid arguments" };
    }
    try {
      const scriptMap: Record<string, string> = {
        "clean-temp": "clean-temp.ps1",
        "disable-bitlocker": "disable-bitlocker.ps1",
        "rename-pc": "rename-pc.ps1",
        "set-wallpaper": "set-wallpaper.ps1",
      };
      const script = scriptMap[parsed.data.kind];
      const psArgs: string[] = [];
      if (parsed.data.newName) psArgs.push(parsed.data.newName);
      if (parsed.data.wallpaperPath) psArgs.push(parsed.data.wallpaperPath);
      const result = await runPwshScript(
        path.join(process.resourcesPath, "scripts", script),
        psArgs,
        30_000,
      );
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:optimize:clean-temp", async () => {
    try {
      const result = await runPwshScript(
        path.join(process.resourcesPath, "scripts", "clean-temp.ps1"),
        [],
        30_000,
      );
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:optimize:disable-bitlocker", async () => {
    try {
      const result = await runPwshScript(
        path.join(process.resourcesPath, "scripts", "disable-bitlocker.ps1"),
        [],
        30_000,
      );
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:optimize:rename-pc", async (_evt, newName: string) => {
    try {
      if (typeof newName !== "string" || !newName) {
        throw new Error("Missing newName");
      }
      const result = await runPwshScript(
        path.join(process.resourcesPath, "scripts", "rename-pc.ps1"),
        [newName],
        30_000,
      );
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(
    "lap:optimize:set-wallpaper",
    async (_evt, filePath: string) => {
      try {
        if (typeof filePath !== "string" || !filePath) {
          throw new Error("Missing filePath");
        }
        const result = await runPwshScript(
          path.join(process.resourcesPath, "scripts", "set-wallpaper.ps1"),
          [filePath],
          15_000,
        );
        return { ok: true, data: result };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle("lap:upload:status", async () => {
    const session = getStoredSession();
    return {
      ok: true,
      data: {
        hasSession: Boolean(session?.sid),
        session,
        secretFingerprint: getSecretFingerprint(),
        appVersion: app.getVersion(),
      },
    };
  });

  ipcMain.handle("lap:session:get", async () => {
    return { ok: true, data: getStoredSession() };
  });

  ipcMain.handle("lap:session:import", async (_evt, args: unknown) => {
    const parsed = SessionImportArgs.safeParse(args);
    if (!parsed.success) {
      return { ok: false, error: "Invalid session import arguments" };
    }
    setStoredSession({
      sid: parsed.data.sid,
      uploadUrl: parsed.data.uploadUrl ?? "",
      webUrl: parsed.data.webUrl ?? "",
      expiresAt: parsed.data.expiresAt ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      importedAt: new Date().toISOString(),
    });
    return { ok: true, data: getStoredSession() };
  });

  ipcMain.handle("lap:session:clear", async () => {
    clearStoredSession();
    return { ok: true };
  });

  ipcMain.handle("lap:clipboard:read", async () => {
    try {
      return { ok: true, data: readClipboardText() };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:shell:open-external", async (_evt, url: string) => {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
      return { ok: false, error: "Invalid URL" };
    }
    await shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle("lap:dialog:pick-file", async (_evt, opts?: { filters?: Electron.FileFilter[] }) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(win!, {
      properties: ["openFile"],
      filters: opts?.filters,
    });
    return { ok: true, data: result };
  });

  ipcMain.handle("lap:upload:build", async (_evt, args: unknown) => {
    const parsed = UploadArgs.safeParse(args);
    if (!parsed.success) {
      return { ok: false, error: "Invalid upload arguments" };
    }
    const payload = buildUploadPayload({
      hardware: parsed.data.hardware as never,
      benchmark: parsed.data.benchmark as never,
      tests: parsed.data.tests as never,
    });
    return { ok: true, data: payload };
  });

  ipcMain.handle("lap:upload:send", async (_evt, args: { payload: unknown }) => {
    const session = getStoredSession();
    if (!session?.sid || !session.uploadUrl) {
      return { ok: false, error: "No active session" };
    }
    try {
      const payload = args?.payload as Record<string, unknown>;
      const signature = sign(payload);
      const body = { ...payload, signature };
      const result = await uploadToServer({
        sid: session.sid,
        uploadUrl: session.uploadUrl,
        body,
      });
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });
}