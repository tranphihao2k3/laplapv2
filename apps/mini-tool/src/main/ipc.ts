import { ipcMain, dialog, shell, app, BrowserWindow } from "electron";
import path from "node:path";
import { promises as fs } from "node:fs";
import { runPwshCommand, runPwshScript } from "./powershell";
import { sign, getSecretFingerprint } from "./crypto";
import { getStoredSession, setStoredSession, clearStoredSession } from "./session";
import { buildUploadPayload, uploadToServer } from "./upload";
import { readClipboardText } from "./clipboard";
import { detectFurmark, runFurmarkBenchmark, readLatestFurmarkScore } from "./benchmark";
import { streamHardware, fastStreamHardware, debugRamRaw, debugDisksRaw, debugGpusRaw } from "./hardware";
import {
  readBattery,
  readDisplay,
  readSystemInfo,
  readStorageDetail,
  readWifiProfiles,
  findHdSentinel,
  launchHdSentinel,
  type BatterySnapshot,
  type DisplaySnapshot,
  type SystemInfoSnapshot,
  type StorageDisk,
  type WifiSnapshot,
} from "./dashboard";
import {
  listPowerPlans,
  getActivePowerPlan,
  setActivePowerPlan,
  getCpuMaxProcessorState,
  setCpuMaxProcessorState,
  openWindowsPowerPanel,
} from "./power";
import { listStartupApps, toggleStartupApp, type StartupApp } from "./startup";
import {
  BUILTIN_AUDIO,
  listAudioFiles,
  type AudioFileInfo,
} from "./audio";
import { z } from "zod";

let audioDir = "";

export function setAudioDir(dir: string): void {
  audioDir = dir;
}

function getAudioDirOrThrow(): string {
  if (!audioDir) {
    throw new Error("Audio directory not initialized");
  }
  return audioDir;
}

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

  // Fast hardware scan (parallel PowerShell jobs, 2-3 giây)
  ipcMain.handle("lap:hardware:fast-collect", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const webContents = win?.webContents ?? event.sender;
    const channel = "lap:hardware:part";
    const prev = hardwareHandles.get(webContents.id);
    if (prev) prev.stop();
    const handle = fastStreamHardware((part) => {
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

  // ── Debug: trả raw PowerShell output cho disks. Dùng khi user báo "thiếu ổ" /
  // "sai dung lượng" / "sai model". Renderer sẽ in ra console + show "Copy JSON".
  ipcMain.handle("lap:hardware:debug-disks", async () => {
    try {
      const data = await debugDisksRaw();
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }
  });

  // Debug RAM: trả raw JSON Win32_PhysicalMemory + Win32_PhysicalMemoryArray
  // + ComputerSystem.TotalPhysicalMemory. Dùng khi RAM hiển thị sai.
  ipcMain.handle("lap:hardware:debug-ram", async () => {
    try {
      const data = await debugRamRaw();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // Debug GPU: trả raw JSON Win32_VideoController + nvidia-smi (nếu có)
  // + primary screen resolution. Dùng khi tên GPU / VRAM / công suất hiển thị sai.
  ipcMain.handle("lap:hardware:debug-gpus", async () => {
    try {
      const data = await debugGpusRaw();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── Live usage: %CPU + used/free RAM + per-disk used (mỗi 2s gọi từ renderer) ──
  ipcMain.handle("lap:live:read", async () => {
    try {
      const script = [
        "$cpu = (Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Measure-Object -Property LoadPercentage -Average).Average",
        "$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue",
        "$cpuTemp = (Get-CimInstance MSAcpi_ThermalZoneTemperature -Namespace 'root/wmi' -ErrorAction SilentlyContinue | Select-Object -First 1).CurrentTemperature",
        "@{",
        "  cpu = [int]$cpu",
        "  memUsedMb = [int]($os.TotalVisibleMemorySize - $os.FreePhysicalMemory)",
        "  memTotalMb = [int]$os.TotalVisibleMemorySize",
        "  memFreeMb = [int]$os.FreePhysicalMemory",
        "  cpuTempC = if ($cpuTemp) { [int](($cpuTemp - 2732) / 10.0) } else { $null }",
        "} | ConvertTo-Json -Compress",
      ].join("\n");
      const result = await runPwshCommand(script, 5_000);
      const jsonStart = result.stdout.indexOf("{");
      let parsed: {
        cpu: number;
        memUsedMb: number;
        memTotalMb: number;
        memFreeMb: number;
        cpuTempC: number | null;
      } | null = null;
      if (jsonStart >= 0) {
        try {
          parsed = JSON.parse(result.stdout.slice(jsonStart).trim()) as {
            cpu: number;
            memUsedMb: number;
            memTotalMb: number;
            memFreeMb: number;
            cpuTempC: number | null;
          };
        } catch {
          parsed = null;
        }
      }
      return {
        ok: true,
        data: parsed ?? {
          cpu: 0,
          memUsedMb: 0,
          memTotalMb: 0,
          memFreeMb: 0,
          cpuTempC: null,
        },
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
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

  ipcMain.handle(
    "lap:bench:furmark:run",
    async (_evt, rawArgs: unknown) => {
      try {
        const args = rawArgs as {
          exePath?: string;
          width?: number;
          height?: number;
          durationSec?: number;
          api?: "gl" | "vk";
        };
        if (!args || typeof args.exePath !== "string" || !args.exePath) {
          throw new Error("Missing exePath");
        }
        const w = Number(args.width);
        const h = Number(args.height);
        const d = Number(args.durationSec);
        if (!Number.isFinite(w) || w < 320 || w > 16384) {
          throw new Error("Width không hợp lệ");
        }
        if (!Number.isFinite(h) || h < 240 || h > 16384) {
          throw new Error("Height không hợp lệ");
        }
        if (!Number.isFinite(d) || d < 1 || d > 3600) {
          throw new Error("Duration phải từ 1 đến 3600 giây");
        }
        const result = await runFurmarkBenchmark({
          exePath: args.exePath,
          width: w,
          height: h,
          durationSec: d,
          api: args.api === "vk" ? "vk" : "gl",
        });
        return { ok: true, data: result };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    "lap:bench:furmark:readScore",
    async (_evt, csvPath: unknown) => {
      try {
        if (typeof csvPath !== "string" || !csvPath) {
          throw new Error("Missing csvPath");
        }
        const result = await readLatestFurmarkScore(csvPath);
        return { ok: true, data: result };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

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

  // ── WiFi Scan ───────────────────────────────────────────────────────────────
  ipcMain.handle("lap:optimize:scan-wifi", async () => {
    try {
      const script = [
        "$ErrorActionPreference = 'SilentlyContinue'",
        "$adapters = @()",
        "$networks = @()",
        "try {",
        "  $wifiAdapters = Get-CimInstance Win32_NetworkAdapter -ErrorAction SilentlyContinue | Where-Object {",
        "    ($_.NetConnectionID -and ($_.NetConnectionID -match 'wi-fi|wifi|wireless|wlan')) -or ($_.Description -and ($_.Description -match 'wi-fi|wifi|wireless|802'))",
        "  }",
        "  foreach ($a in $wifiAdapters) {",
        "    $cfg = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter ('Index=' + $a.Index) -ErrorAction SilentlyContinue | Select-Object -First 1",
        "    $adapters += @{",
        "      name = [string]$a.NetConnectionID",
        "      description = [string]$a.Description",
        "      mac = [string]$a.MACAddress",
        "      status = if ($a.NetConnectionStatus -eq 2) { 'connected' } else { 'disconnected' }",
        "      speedMbps = if ($a.Speed -and $a.Speed -gt 0) { [int]($a.Speed / 1000000) } else { $null }",
        "      ipAddress = if ($cfg -and $cfg.IPAddress) { [string]$cfg.IPAddress[0] } else { $null }",
        "    }",
        "  }",
        "} catch {}",
        "try {",
        "  $netshOut = & netsh.exe wlan show networks mode=bssid 2>&1 | Out-String",
        "  $lines = $netshOut.Split([char]10)",
        "  $currentSsid = ''",
        "  $currentBssid = ''",
        "  $currentSignal = 0",
        "  $currentFreq = 2.4",
        "  $currentAuth = ''",
        "  foreach ($line in $lines) {",
        "    if ($line -match 'SSID.*:\\s*(.+)') {",
        "      $currentSsid = $matches[1].Trim()",
        "    } elseif ($line -match 'BSSID.*:\\s*([0-9a-f:]+)') {",
        "      $currentBssid = $matches[1].Trim()",
        "    } elseif ($line -match 'Signal.*:\\s*(\\d+)%') {",
        "      $pct = [int]$matches[1]; $currentSignal = [int](-100 + ($pct * 0.8))",
        "    } elseif ($line -match 'Radio type.*:\\s*(.+)') {",
        "      $r = $matches[1].Trim(); if ($r -match '802.11a' -or $r -match '802.11ac' -or $r -match 'ax.*5') { $currentFreq = 5 } else { $currentFreq = 2.4 }",
        "    } elseif ($line -match 'Authentication.*:\\s*(.+)') {",
        "      $currentAuth = $matches[1].Trim()",
        "      if ($currentSsid) {",
        "        $networks += @{",
        "          ssid = $currentSsid",
        "          bssid = $currentBssid",
        "          signalDbm = $currentSignal",
        "          frequencyGhz = $currentFreq",
        "          security = $currentAuth",
        "          connected = $false",
        "        }",
        "        $currentBssid = ''; $currentSignal = 0; $currentFreq = 2.4; $currentAuth = ''",
        "      }",
        "    }",
        "  }",
        "} catch {}",
        "$result = @{ adapters = $adapters; networks = $networks; ok = $true }",
        "$result | ConvertTo-Json -Depth 5 -Compress",
      ].join("\n");
      const result = await runPwshCommand(script, 30_000);
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

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
    const existing = getStoredSession();
    // Only update fields that are explicitly provided; keep existing values otherwise
    setStoredSession({
      sid: parsed.data.sid,
      uploadUrl: parsed.data.uploadUrl !== undefined ? parsed.data.uploadUrl : (existing?.uploadUrl ?? ""),
      webUrl: parsed.data.webUrl !== undefined ? parsed.data.webUrl : (existing?.webUrl ?? ""),
      expiresAt: parsed.data.expiresAt ?? existing?.expiresAt ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
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

  // ── Audio (speaker test files served via lap-audio://) ──────────────────────
  ipcMain.handle("lap:audio:list", async () => {
    try {
      const dir = getAudioDirOrThrow();
      const builtinNames = new Set(BUILTIN_AUDIO.map((b) => b.fileName));
      const items: AudioFileInfo[] = await listAudioFiles(dir, {
        builtinFileNames: builtinNames,
      });
      return { ok: true, data: { dir, items } };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  /**
   * Đọc nội dung file audio thành ArrayBuffer để renderer tạo blob URL.
   * Ổn định hơn custom protocol khi dev/HMR hoặc khi file trong userData cache.
   */
  ipcMain.handle(
    "lap:audio:read",
    async (_evt, fileName: unknown): Promise<{ ok: boolean; data?: { mime: string; buffer: ArrayBuffer }; error?: string }> => {
      try {
        if (typeof fileName !== "string" || !fileName) {
          throw new Error("Missing fileName");
        }
        const dir = getAudioDirOrThrow();
        const decoded = decodeURIComponent(fileName).replace(/^\/+/, "");
        // Chỉ cho phép tên file đơn giản, không có path separator
        if (decoded.includes("..") || /[\\/]/.test(decoded)) {
          throw new Error("Invalid fileName");
        }
        const full = path.join(dir, decoded);
        const stat = await fs.stat(full);
        if (!stat.isFile()) throw new Error("Not a file");
        const buf = await fs.readFile(full);
        const ext = path.extname(full).toLowerCase();
        const mime = (() => {
          switch (ext) {
            case ".wav": return "audio/wav";
            case ".mp3": return "audio/mpeg";
            case ".ogg": return "audio/ogg";
            case ".m4a": return "audio/mp4";
            case ".flac": return "audio/flac";
            default: return "application/octet-stream";
          }
        })();
        // Convert Node Buffer → ArrayBuffer-backed Uint8Array để IPC
        // serialize an toàn (không bị Buffer.toString('latin1') mất bytes).
        const ab = new ArrayBuffer(buf.byteLength);
        new Uint8Array(ab).set(buf);
        return { ok: true, data: { mime, buffer: ab } };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle("lap:audio:reveal", async () => {
    try {
      const dir = getAudioDirOrThrow();
      // Make sure the folder exists before showing it
      await fs.mkdir(dir, { recursive: true });
      shell.showItemInFolder(dir);
      return { ok: true, data: { dir } };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:audio:add", async () => {
    try {
      const dir = getAudioDirOrThrow();
      const win =
        BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      const result = await dialog.showOpenDialog(win!, {
        title: "Thêm file nhạc test (.wav / .mp3 / .ogg / .m4a)",
        properties: ["openFile", "multiSelections"],
        filters: [
          {
            name: "Audio",
            extensions: ["wav", "mp3", "ogg", "m4a", "flac"],
          },
        ],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: true, data: { added: 0 } };
      }
      let added = 0;
      const skipped: string[] = [];
      for (const src of result.filePaths) {
        const ext = path.extname(src).toLowerCase();
        const allowed = [".wav", ".mp3", ".ogg", ".m4a", ".flac"];
        if (!allowed.includes(ext)) {
          skipped.push(src);
          continue;
        }
        const base = path.basename(src);
        const dest = path.join(dir, base);
        if (src.toLowerCase() === dest.toLowerCase()) {
          added++;
          continue;
        }
        await fs.copyFile(src, dest);
        added++;
      }
      return { ok: true, data: { added, skipped } };
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

  // ── Power Plans (Windows powercfg.exe) ──────────────────────────────────────
  ipcMain.handle("lap:power:list", async () => {
    try {
      const data = await listPowerPlans();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:power:get-active", async () => {
    try {
      const data = await getActivePowerPlan();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:power:set-active", async (_evt, guid: unknown) => {
    try {
      await setActivePowerPlan(guid);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:power:get-cpu-max", async () => {
    try {
      const data = await getCpuMaxProcessorState();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:power:open-panel", async () => {
    try {
      openWindowsPowerPanel();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(
    "lap:power:set-cpu-max",
    async (_evt, payload: unknown) => {
      try {
        const obj =
          payload && typeof payload === "object"
            ? (payload as { ac?: unknown; dc?: unknown })
            : {};
        await setCpuMaxProcessorState(obj.ac, obj.dc);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle("lap:power:open-panel", async () => {
    try {
      openWindowsPowerPanel();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── Startup Apps (registry control) ───────────────────────────────────────
  ipcMain.handle("lap:startup:list", async () => {
    try {
      const data = await listStartupApps();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  const ToggleStartupArgs = z.object({
    currentName: z.string().min(1),
    location: z.string().min(1),
    newEnabled: z.boolean(),
  });

  ipcMain.handle("lap:startup:toggle", async (_evt, args: unknown) => {
    const parsed = ToggleStartupArgs.safeParse(args);
    if (!parsed.success) {
      return { ok: false, error: "Invalid arguments" };
    }
    try {
      const result = await toggleStartupApp(
        parsed.data.currentName,
        parsed.data.location,
        parsed.data.newEnabled,
      );
      return result.ok
        ? { ok: true, data: { newName: result.newName, enabled: result.enabled } }
        : { ok: false, error: result.error };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── Quick Optimize: clear working set (RAM) ───────────────────────────────
  // Dùng psapi!EmptyWorkingSet để thật sự ép Windows trả lại RAM cho working
  // set nhỏ nhất có thể. Set MinWorkingSet=1MB như bản cũ KHÔNG ép trim.
  ipcMain.handle("lap:optimize:clear-ram", async () => {
    try {
      const before = await runPwshCommand(
        "$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue; [math]::Round(($os.FreePhysicalMemory / 1024), 0)",
        5_000,
      );
      // Add-Type idempotent (nếu đã có sẽ throw — bỏ qua)
      const script = [
        "$ErrorActionPreference = 'SilentlyContinue'",
        "# P/Invoke EmptyWorkingSet — ép Windows trim working set của process",
        "try {",
        "  if (-not ('Win32.K32' -as [type])) {",
        "    Add-Type -Namespace Win32 -Name K32 -MemberDefinition @'",
        "      [System.Runtime.InteropServices.DllImport(\"psapi.dll\")]",
        "      public static extern bool EmptyWorkingSet(IntPtr hProcess);",
        "      [System.Runtime.InteropServices.DllImport(\"kernel32.dll\")]",
        "      public static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);",
        "      [System.Runtime.InteropServices.DllImport(\"kernel32.dll\")]",
        "      public static extern bool CloseHandle(IntPtr h);",
        "'@ -ErrorAction SilentlyContinue",
        "  }",
        "} catch {}",
        "# Danh sách process cần GIỮ (system critical) — không trim để tránh crash",
        "$protected = '^(svchost|csrss|lsass|winlogon|services|System|explorer|dwm|conhost|audiodg|fontdrvhost|LogonUI|LockApp|shellexperiencehost|StartMenuExperienceHost|TextInputHost|RuntimeBroker|WmiPrvSe|spoolsv|WerFault|MsMpEng)$'",
        "$trimmed = 0",
        "Get-Process | Where-Object {",
        "  $_.WorkingSet64 -gt 80MB -and $_.Name -notmatch $protected",
        "} | ForEach-Object {",
        "  try {",
        "    $h = [Win32.K32]::OpenProcess(0x1F0FFF, $false, [uint32]$_.Id)",
        "    if ($h -ne [IntPtr]::Zero) {",
        "      $ok = [Win32.K32]::EmptyWorkingSet($h)",
        "      [Win32.K32]::CloseHandle($h) | Out-Null",
        "      if ($ok) { $trimmed++ }",
        "    }",
        "  } catch {}",
        "}",
        "# GC cho PowerShell process hiện tại",
        "[System.GC]::Collect() | Out-Null",
        "[System.GC]::WaitForPendingFinalizers() | Out-Null",
        "[System.GC]::Collect() | Out-Null",
        "$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue",
        "$result = @{",
        "  beforeFreeMb = [int]$os.FreePhysicalMemory",
        "  totalMb = [int]$os.TotalVisibleMemorySize",
        "  usedMb = [int]($os.TotalVisibleMemorySize - $os.FreePhysicalMemory)",
        "  trimmed = $trimmed",
        "}",
        "$result | ConvertTo-Json -Compress",
      ].join("\n");
      const result = await runPwshCommand(script, 60_000);
      const freeBefore = parseInt((before.stdout || "0").trim(), 10) || 0;
      const jsonStart = result.stdout.indexOf("{");
      let parsed: { beforeFreeMb: number; totalMb: number; usedMb: number; trimmed?: number } | null = null;
      if (jsonStart >= 0) {
        try {
          parsed = JSON.parse(result.stdout.slice(jsonStart).trim()) as { beforeFreeMb: number; totalMb: number; usedMb: number; trimmed?: number };
        } catch {
          parsed = null;
        }
      }
      // Trả freedMb = (sau) - (trước) — luôn dương nếu thực sự giải phóng
      const freedMb = parsed ? Math.max(0, parsed.beforeFreeMb - freeBefore) : null;
      return {
        ok: true,
        data: {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          beforeFreeMb: freeBefore,
          afterFreeMb: parsed?.beforeFreeMb ?? null,
          freedMb,
          trimmed: parsed?.trimmed ?? null,
        },
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── DNS Optimize (set to Cloudflare 1.1.1.1 + Google 8.8.8.8) ────────────
  ipcMain.handle("lap:optimize:dns", async () => {
    try {
      const script = [
        "$ErrorActionPreference = 'Stop'",
        "$adapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }",
        "$names = @()",
        "foreach ($a in $adapters) {",
        "  $iface = Get-NetIPInterface -InterfaceAlias $a.Name -AddressFamily IPv4 -ErrorAction SilentlyContinue",
        "  if ($iface) {",
        "    try {",
        "      Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ServerAddresses ('1.1.1.1','1.0.0.1','8.8.8.8','8.8.4.4') -ErrorAction Stop",
        "      $names += $a.Name",
        "    } catch {}",
        "  }",
        "}",
        "Clear-DnsClientCache",
        "Write-Output ('OK:' + ($names -join '|'))",
      ].join("\n");
      const result = await runPwshCommand(script, 30_000);
      return {
        ok: true,
        data: {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        },
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── Driver check: ưu tiên Windows Update API, fallback PnP ─────────────
  // Get-WindowsUpdate cần module PSWindowsUpdate (không có sẵn). Nếu chưa cài
  // thì check qua Get-CimInstance Win32_PnPDriver (ổn định, không cần module).
  ipcMain.handle("lap:optimize:check-driver", async () => {
    try {
      const script = [
        "$ErrorActionPreference = 'SilentlyContinue'",
        "$out = @{ source='pnp'; count=0; updates=@(); ok=$true; note=$null }",
        "",
        "# Probe module PSWindowsUpdate trước — nếu có thì dùng WUA",
        "$hasWua = $false",
        "if (Get-Module -ListAvailable -Name PSWindowsUpdate -ErrorAction SilentlyContinue) {",
        "  $hasWua = $true",
        "}",
        "",
        "if ($hasWua) {",
        "  try {",
        "    Import-Module PSWindowsUpdate -ErrorAction Stop",
        "    $updates = Get-WindowsUpdate -MicrosoftUpdate -AcceptEula -ErrorAction SilentlyContinue |",
        "      Where-Object { $_.Title -match 'driver|firmware' }",
        "    $out.source = 'wua'",
        "    $out.count = ($updates | Measure-Object).Count",
        "    $out.updates = @($updates | ForEach-Object { @{",
        "      title = [string]$_.Title",
        "      kb = [string]$_.KB",
        "      size = if ($_.Size) { [int64]$_.Size } else { $null }",
        "    } })",
        "    $out.note = 'Có ' + $out.count + ' bản cập nhật driver từ Microsoft Update'",
        "  } catch {",
        "    $out.note = 'PSWindowsUpdate lỗi: ' + $_.Exception.Message",
        "  }",
        "}",
        "",
        "# Nếu WUA fail / không có → dùng Win32_PnPDriver để liệt kê drivers hiện tại",
        "if ($out.count -eq 0) {",
        "  try {",
        "    $drivers = Get-CimInstance Win32_PnPDriver -ErrorAction SilentlyContinue |",
        "      Where-Object { $_.Name -and $_.Manufacturer } |",
        "      Select-Object -First 20 Name, DriverVersion, Manufacturer, DeviceClass",
        "    $out.source = 'pnp'",
        "    $out.count = ($drivers | Measure-Object).Count",
        "    $out.updates = @($drivers | ForEach-Object { @{",
        "      title = [string]$_.Name",
        "      version = [string]$_.DriverVersion",
        "      manufacturer = [string]$_.Manufacturer",
        "    } })",
        "    $out.note = 'Đang liệt kê ' + $out.count + ' driver đã cài (cài PSWindowsUpdate để check cập nhật)'",
        "  } catch {",
        "    $out.note = 'Không đọc được PnP driver: ' + $_.Exception.Message",
        "  }",
        "}",
        "",
        "$out | ConvertTo-Json -Depth 3 -Compress",
      ].join("\n");
      const result = await runPwshCommand(script, 60_000);
      const jsonStart = result.stdout.indexOf("{");
      let data: unknown = null;
      if (jsonStart >= 0) {
        try {
          data = JSON.parse(result.stdout.slice(jsonStart).trim());
        } catch {
          data = null;
        }
      }
      return {
        ok: true,
        data: {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          parsed: data,
        },
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── Network speed test (simple latency + jitter via Test-Connection) ──────
  ipcMain.handle("lap:optimize:net-speed", async () => {
    try {
      const script = [
        "$hosts = @('1.1.1.1','8.8.8.8','9.9.9.9')",
        "$results = @()",
        "foreach ($h in $hosts) {",
        "  $m = Measure-Command { $null = Test-Connection -ComputerName $h -Count 4 -ErrorAction SilentlyContinue }",
        "  $results += @{ host=$h; ms=[int]$m.TotalMilliseconds }",
        "}",
        "Get-NetAdapterStatistics | ForEach-Object {",
        "  $adapter = $_",
        "  $name = $adapter.Name",
        "  $rx = [int64]$adapter.ReceivedBytes",
        "  $tx = [int64]$adapter.SentBytes",
        "  @{",
        "    adapters = @(@{ name=$name; rxBytes=$rx; txBytes=$tx })",
        "    pings = $results",
        "  }",
        "} | ConvertTo-Json -Depth 5 -Compress",
      ].join("\n");
      const result = await runPwshCommand(script, 30_000);
      const jsonStart = result.stdout.indexOf("{");
      let data: unknown = null;
      if (jsonStart >= 0) {
        try {
          data = JSON.parse(result.stdout.slice(jsonStart).trim());
        } catch {
          data = null;
        }
      }
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
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

  // ── Dashboard info blocks (Battery / Display / System / Storage / WiFi) ──
  // Trả về struct rõ ràng để renderer render trực tiếp; đã handle null/empty.
  ipcMain.handle("lap:dashboard:battery", async () => {
    try {
      const data: BatterySnapshot = await readBattery(8_000);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:dashboard:display", async () => {
    try {
      const data: DisplaySnapshot = await readDisplay(10_000);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:dashboard:system", async () => {
    try {
      const data: SystemInfoSnapshot = await readSystemInfo(12_000);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:dashboard:storage", async () => {
    try {
      const data: StorageDisk[] = await readStorageDetail(15_000);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle("lap:dashboard:wifi-profiles", async () => {
    try {
      const data: WifiSnapshot = await readWifiProfiles(15_000);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // ── HD Sentinel — probe + launch ─────────────────────────────────────────
  ipcMain.handle("lap:dashboard:hd-sentinel:find", async () => {
    try {
      const data = await findHdSentinel();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(
    "lap:dashboard:hd-sentinel:launch",
    async (_evt, exePath: unknown) => {
      try {
        if (typeof exePath !== "string" || !exePath) {
          throw new Error("Missing exePath");
        }
        const result = await launchHdSentinel(exePath);
        return result.ok
          ? { ok: true }
          : { ok: false, error: result.error ?? "Không khởi chạy được HD Sentinel" };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  );
}