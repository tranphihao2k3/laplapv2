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

  // ── Empty Recycle Bin ────────────────────────────────────────────────────────
  ipcMain.handle("lap:optimize:empty-recycle", async () => {
    try {
      const result = await runPwshCommand(
        `Clear-RecycleBin -Force -ErrorAction SilentlyContinue; Write-Output 'Done'`,
        60_000,
      );
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── Disable Startup Apps ─────────────────────────────────────────────────────
  ipcMain.handle("lap:optimize:disable-startup", async () => {
    try {
      const script = `$disabled = 0; $failed = 0; $items = Get-CimInstance Win32_StartupCommand | Select-Object Name, Command, Location; foreach ($item in $items) { try { if ($item.Location -match 'HKCU') { Remove-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name $item.Name -Force -ErrorAction Stop; $disabled++ } elseif ($item.Location -match 'HKLM') { try { Remove-ItemProperty -Path "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name $item.Name -Force -ErrorAction Stop; $disabled++ } catch { $failed++ } } } catch { $failed++ } }; @{disabled=$disabled;failed=$failed} | ConvertTo-Json -Compress`;
      const result = await runPwshCommand(script, 30_000);
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── Defrag / Optimize Drives ─────────────────────────────────────────────────
  ipcMain.handle("lap:optimize:optimize-drive", async (_evt, driveLetter: string) => {
    try {
      if (typeof driveLetter !== "string" || !driveLetter) {
        throw new Error("Missing driveLetter");
      }
      const letter = driveLetter.replace(/[\\\/]$/, "").toUpperCase();
      const script = `$ErrorActionPreference='SilentlyContinue'; $disk = Get-CimInstance Win32_DiskDrive | Where-Object { $_.Model -match 'ssd|nvme|m\\.2' } | Select-Object -First 1; if ($disk) { Write-Output "SKIP:SSD" } else { $out = & defrag.exe ${letter}: /F /V 2>&1 | Out-String; Write-Output $out }`;
      const result = await runPwshCommand(script, 300_000);
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── CPU Benchmark (built-in, no FurMark needed) ──────────────────────────────
  ipcMain.handle("lap:bench:cpu-benchmark", async (_evt, durationSec: number) => {
    try {
      const duration = typeof durationSec === "number" && durationSec > 0 ? durationSec : 10;
      const script = `$sw = [Diagnostics.Stopwatch]::StartNew(); $iter = 0; $targetMs = ${duration} * 1000; while ($sw.ElapsedMilliseconds -lt $targetMs) { $null = [Math]::Sqrt(123456.789 * [Math]::PI); $iter++ }; $elapsed = $sw.ElapsedMilliseconds; $opsPerSec = [Math]::Round($iter / ($elapsed / 1000.0), 0); $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1; @{iterations=$iter;elapsedMs=$elapsed;opsPerSec=$opsPerSec;cpuName=$cpu.Name;cores=$cpu.NumberOfCores;threads=$cpu.NumberOfLogicalProcessors} | ConvertTo-Json -Compress`;
      const result = await runPwshCommand(script, (duration + 10) * 1000);
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── Get Drive List (for defrag) ─────────────────────────────────────────────
  ipcMain.handle("lap:optimize:get-drives", async () => {
    try {
      const script = `Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID, VolumeName, @{N='freeGb';E={[math]::Round($_.FreeSpace/1GB,1)}}, @{N='totalGb';E={[math]::Round($_.Size/1GB,1)}} | ConvertTo-Json -Compress`;
      const result = await runPwshCommand(script, 15_000);
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

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