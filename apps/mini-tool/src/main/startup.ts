// startup.ts — Đọc/ghi danh sách ứng dụng khởi động cùng Windows.
//
// Nguồn dữ liệu:
//   - HKCU\Software\Microsoft\Windows\CurrentVersion\Run
//   - HKLM\Software\Microsoft\Windows\CurrentVersion\Run
//   - HKCU\...\RunOnce (chỉ đọc — không toggle)
//   - HKLM\...\RunOnce (chỉ đọc — không toggle)
//
// "Workload" ước lượng theo heuristic:
//   - Cao: app nổi tiếng nặng (Discord, Steam, OneDrive, Spotify, Chrome)
//   - Vừa: chương trình user cài nhưng không nằm whitelist
//   - Thấp: lightweight utility (touchpad, audio service, helper)

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type StartupApp = {
  /** Tên value (registry value name). */
  name: string;
  /** Đường dẫn đầy đủ hoặc command line. */
  command: string;
  /** Registry location. */
  location: "HKCU\\...\\Run" | "HKLM\\...\\Run" | "HKCU\\...\\RunOnce" | "HKLM\\...\\RunOnce";
  /** true = enabled, false = disabled (chỉ áp dụng cho Run, không áp dụng RunOnce). */
  enabled: boolean;
  /** Publisher ước lượng (lấy từ file path) */
  publisher: string | null;
  /** Workload heuristic */
  workload: "Cao" | "Vừa" | "Thấp";
  /** Icon gợi ý (lucide icon name) để UI render */
  iconHint: "discord" | "steam" | "onedrive" | "nvidia" | "spotify" | "chrome" | "edge" | "app";
};

const POWERSHELL_TIMEOUT_MS = 15_000;
const POWERSHELL_MAX_BUFFER = 1024 * 1024 * 4;

function workloadFor(name: string, command: string): "Cao" | "Vừa" | "Thấp" {
  const lc = `${name} ${command}`.toLowerCase();
  if (
    lc.includes("steam") ||
    lc.includes("discord") ||
    lc.includes("onedrive") ||
    lc.includes("spotify") ||
    lc.includes("geforce") ||
    lc.includes("epicgameslauncher") ||
    lc.includes("origin") ||
    lc.includes("battle.net") ||
    lc.includes("riot client")
  ) {
    return "Cao";
  }
  if (
    lc.includes("chrome") ||
    lc.includes("msedge") ||
    lc.includes("firefox") ||
    lc.includes("slack") ||
    lc.includes("zoom") ||
    lc.includes("teams")
  ) {
    return "Cao";
  }
  if (
    lc.includes("helper") ||
    lc.includes("service") ||
    lc.includes("tray") ||
    lc.includes("updater") ||
    lc.includes("agent") ||
    lc.includes("dropbox")
  ) {
    return "Vừa";
  }
  return "Vừa";
}

function iconFor(name: string, command: string): StartupApp["iconHint"] {
  const lc = `${name} ${command}`.toLowerCase();
  if (lc.includes("discord")) return "discord";
  if (lc.includes("steam")) return "steam";
  if (lc.includes("onedrive")) return "onedrive";
  if (lc.includes("geforce") || lc.includes("nvidia")) return "nvidia";
  if (lc.includes("spotify")) return "spotify";
  if (lc.includes("chrome")) return "chrome";
  if (lc.includes("edge") || lc.includes("msedge")) return "edge";
  return "app";
}

function publisherFor(command: string): string | null {
  // Cố gắng trích xuất tên file thực thi đầu tiên
  const m = command.match(/^"([^"]+)"|^([^\s]+)/);
  const exe = (m?.[1] ?? m?.[2] ?? "").toLowerCase();
  if (!exe) return null;
  if (exe.includes("steam")) return "Valve";
  if (exe.includes("discord")) return "Discord Inc.";
  if (exe.includes("onedrive")) return "Microsoft";
  if (exe.includes("spotify")) return "Spotify AB";
  if (exe.includes("geforce") || exe.includes("nvidia")) return "NVIDIA";
  if (exe.includes("chrome")) return "Google";
  if (exe.includes("msedge")) return "Microsoft";
  if (exe.includes("epicgameslauncher")) return "Epic Games";
  if (exe.includes("origin")) return "Electronic Arts";
  if (exe.includes("battle.net") || exe.includes("battlenet")) return "Blizzard";
  if (exe.includes("riot")) return "Riot Games";
  if (exe.includes("dropbox")) return "Dropbox";
  if (exe.includes("slack")) return "Slack";
  if (exe.includes("zoom")) return "Zoom";
  if (exe.includes("teams")) return "Microsoft";
  if (exe.includes("synaptics") || exe.includes("elan")) return "Touchpad driver";
  if (exe.includes("realtek") || exe.includes("nahimic")) return "Audio driver";
  return null;
}

async function runPowerShell(script: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ],
    {
      timeout: POWERSHELL_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: POWERSHELL_MAX_BUFFER,
    },
  );
  return stdout;
}

/** Đọc toàn bộ startup entries từ registry. */
export async function listStartupApps(): Promise<StartupApp[]> {
  const script = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "$keys = @(",
    "  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',",
    "  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',",
    "  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce',",
    "  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce'",
    ")",
    "$items = @()",
    "foreach ($k in $keys) {",
    "  if (Test-Path $k) {",
    "    $loc = $k -replace 'HKCU:', 'HKCU\\...\\' -replace 'HKLM:', 'HKLM\\...\\'",
    "    $loc = $loc + ($k.Split('\\')[-1])",
    "    $props = Get-ItemProperty -Path $k -ErrorAction SilentlyContinue",
    "    foreach ($p in $props.PSObject.Properties) {",
    "      $n = $p.Name; if ($n -match '^PS') { continue }",
    "      $v = [string]$p.Value",
    "      if ([string]::IsNullOrWhiteSpace($v)) { continue }",
    "      $items += @{ name = $n; command = $v; location = $loc; kind = ($k.Split('\\')[-1]) }",
    "    }",
    "  }",
    "}",
    "$items | ConvertTo-Json -Compress -Depth 3",
  ].join("\n");
  const raw = await runPowerShell(script);
  const trimmed = raw.trim();
  if (!trimmed) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }
  const arr: Array<{ name: string; command: string; location: string; kind: string }> = Array.isArray(parsed)
    ? (parsed as Array<{ name: string; command: string; location: string; kind: string }>)
    : [parsed as { name: string; command: string; location: string; kind: string }];
  return arr
    .filter((r) => r && typeof r.name === "string" && typeof r.command === "string")
    .map((r) => {
      const isRun = r.kind === "Run";
      return {
        name: r.name,
        command: r.command,
        location: r.location as StartupApp["location"],
        enabled: isRun, // RunOnce không toggle được
        publisher: publisherFor(r.command),
        workload: workloadFor(r.name, r.command),
        iconHint: iconFor(r.name, r.command),
      };
    });
}

/**
 * Toggle startup app bằng cách đổi tên value: thêm prefix "DISABLED_" (chỉ
 * với Run keys, không touch RunOnce). Khi toggle off → đổi tên thành
 * "DISABLED_<tên cũ>"; khi toggle on → đổi lại tên cũ.
 *
 * Trả về trạng thái mới (true = enabled, false = disabled).
 */
export async function toggleStartupApp(
  currentName: string,
  location: string,
  newEnabled: boolean,
): Promise<{ ok: boolean; newName: string; enabled: boolean; error?: string }> {
  if (!location.endsWith("\\Run")) {
    return { ok: false, newName: currentName, enabled: !newEnabled, error: "Chỉ toggle được Run, không touch RunOnce" };
  }
  // Map lại location (HKCU\...\Run → HKCU:\Software\Microsoft\Windows\CurrentVersion\Run)
  const realPath = location
    .replace(/^HKCU\\\.\.\.\\/, "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\")
    .replace(/^HKLM\\\.\.\.\\/, "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\");
  const disabledPrefix = "DISABLED_";
  const escapedPath = realPath.replace(/'/g, "''");
  const script = newEnabled
    ? [
        // Enable: nếu tên hiện tại bắt đầu bằng DISABLED_ → đổi về tên cũ
        `$ErrorActionPreference = 'Stop'`,
        `if (-not (Test-Path -LiteralPath '${escapedPath}')) { Write-Error 'NOT_FOUND'; exit 1 }`,
        `$cur = Get-Item -LiteralPath '${escapedPath}' -ErrorAction Stop`,
        `$prop = $cur.GetValue('${currentName.replace(/'/g, "''")}', $null)`,
        `if ($prop -eq $null) { Write-Error 'NAME_NOT_FOUND'; exit 1 }`,
        `$newName = '${currentName.replace(/'/g, "''")}'`,
        `if ($newName.StartsWith('${disabledPrefix}')) { $newName = $newName.Substring(${disabledPrefix.length}) }`,
        `if ($newName -ne '${currentName.replace(/'/g, "''")}') {`,
        `  Set-ItemProperty -LiteralPath '${escapedPath}' -Name $newName -Value $prop -Type ExpandString -ErrorAction Stop`,
        `  Remove-ItemProperty -LiteralPath '${escapedPath}' -Name '${currentName.replace(/'/g, "''")}' -ErrorAction Stop`,
        `}`,
        `Write-Output $newName`,
      ].join("\n")
    : [
        // Disable: đổi tên thành DISABLED_<tên cũ>
        `$ErrorActionPreference = 'Stop'`,
        `if (-not (Test-Path -LiteralPath '${escapedPath}')) { Write-Error 'NOT_FOUND'; exit 1 }`,
        `$cur = Get-Item -LiteralPath '${escapedPath}' -ErrorAction Stop`,
        `$prop = $cur.GetValue('${currentName.replace(/'/g, "''")}', $null)`,
        `if ($prop -eq $null) { Write-Error 'NAME_NOT_FOUND'; exit 1 }`,
        `$newName = '${disabledPrefix}${currentName.replace(/'/g, "''")}'`,
        `if (-not $newName.StartsWith('${disabledPrefix}')) {`,
        `  Set-ItemProperty -LiteralPath '${escapedPath}' -Name $newName -Value $prop -Type ExpandString -ErrorAction Stop`,
        `  Remove-ItemProperty -LiteralPath '${escapedPath}' -Name '${currentName.replace(/'/g, "''")}' -ErrorAction Stop`,
        `}`,
        `Write-Output $newName`,
      ].join("\n");

  try {
    const stdout = await runPowerShell(script);
    const newName = stdout.trim();
    return { ok: true, newName, enabled: newEnabled };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    return {
      ok: false,
      newName: currentName,
      enabled: !newEnabled,
      error: msg,
    };
  }
}
