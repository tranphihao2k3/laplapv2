import { spawn, type ChildProcess } from "node:child_process";
import * as path from "node:path";
import { promises as fs, existsSync } from "node:fs";
import { app } from "electron";

export interface FurmarkDetectResult {
  found: boolean;
  path: string | null;
  source: "env" | "where" | "appdata" | "packaged" | "repo" | null;
  version: string | null;
  error?: string;
}

export interface FurmarkBenchmarkArgs {
  exePath: string;
  width: number;
  height: number;
  durationSec: number;
  /** OpenGL hay Vulkan (mặc định OpenGL). */
  api?: "gl" | "vk";
  /** Đợi process FurMark còn sống tối đa (ms) trước khi cho là "đang chạy". */
  startupGraceMs?: number;
}

export interface FurmarkBenchmarkResult {
  ok: true;
  csvPath: string;
  pid: number;
  exited: boolean;
  exitCode: number | null;
  pending: boolean;
}

export interface FurmarkScoreRow {
  date: string;
  demo: string;
  platform: string;
  vendor: string;
  renderer: string;
  apiVersion: string;
  width: number;
  height: number;
  fullscreen: string;
  antialiasing: string;
  duration: number;
  maxGpuTemp: number;
  score: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
}

export interface FurmarkLatestResult {
  found: boolean;
  row: FurmarkScoreRow | null;
  csvPath: string | null;
  error?: string;
}

const COMMON_NAMES = ["furmark.exe", "FurMark.exe", "FurMark_2.exe"];

function runWhere(): Promise<string[]> {
  return new Promise((resolve) => {
    const child = spawn("where.exe", COMMON_NAMES, { windowsHide: true });
    let out = "";
    child.stdout.on("data", (c: Buffer) => {
      out += c.toString("utf8");
    });
    child.on("close", () => {
      resolve(
        out
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
    });
    child.on("error", () => resolve([]));
  });
}

/**
 * Đường dẫn tới thư mục `APP_TEST/FurMark_win64/` ở nhiều vị trí có thể có.
 *
 * Thứ tự ưu tiên:
 *  1. env FURMARK_PATH (đường dẫn tới file .exe)
 *  2. Đường dẫn bundled trong packaged app: process.resourcesPath/APP_TEST/FurMark_win64/furmark.exe
 *  3. Đường dẫn cạnh app.asar khi unpack: dist/main/../../APP_TEST/FurMark_win64/furmark.exe
 *  4. Đường dẫn từ cwd hiện tại (khi `npm run dev` IDE chạy từ apps/mini-tool)
 */
export function findBundledFurmarkExe(): string | null {
  const candidates: { path: string; source: NonNullable<FurmarkDetectResult["source"]> }[] = [];

  // 1. Packaged: extraResources nằm cạnh executable (process.resourcesPath)
  try {
    const packaged = path.join(
      process.resourcesPath,
      "APP_TEST",
      "FurMark_win64",
      "furmark.exe",
    );
    if (existsSync(packaged)) candidates.push({ path: packaged, source: "packaged" });
  } catch {
    // app chưa ready, bỏ qua
  }

  // 2. Dev: từ __dirname đi ngược ra repo root và các vị trí lân cận
  try {
    const devPaths = [
      // apps/mini-tool/dist/main/benchmark.cjs → ../../APP_TEST/FurMark_win64/furmark.exe
      path.join(__dirname, "..", "..", "APP_TEST", "FurMark_win64", "furmark.exe"),
      // apps/mini-tool/dist/main/benchmark.cjs → ../../../../APP_TEST/FurMark_win64/furmark.exe
      path.join(__dirname, "..", "..", "..", "..", "APP_TEST", "FurMark_win64", "furmark.exe"),
      // cwd fallback
      path.join(process.cwd(), "APP_TEST", "FurMark_win64", "furmark.exe"),
      // cwd/.. fallback (khi chạy từ apps/mini-tool/dist)
      path.join(process.cwd(), "..", "APP_TEST", "FurMark_win64", "furmark.exe"),
      // workspace root fallback
      path.join(process.cwd(), "..", "..", "..", "apps", "mini-tool", "APP_TEST", "FurMark_win64", "furmark.exe"),
    ];
    for (const p of devPaths) {
      if (existsSync(p)) candidates.push({ path: p, source: "repo" });
    }
  } catch {
    // ignore
  }

  return candidates[0]?.path ?? null;
}

export async function detectFurmark(): Promise<FurmarkDetectResult> {
  // 1. env var
  const env = process.env["FURMARK_PATH"];
  if (env && env.toLowerCase().endsWith(".exe")) {
    if (existsSync(env)) {
      return { found: true, path: env, source: "env", version: null };
    }
  }

  // 2. where.exe trên PATH
  try {
    const where = await runWhere();
    if (where.length > 0 && where[0]) {
      if (existsSync(where[0])) {
        return { found: true, path: where[0], source: "where", version: null };
      }
    }
  } catch {
    // ignore
  }

  // 3. bundled / repo
  const bundled = findBundledFurmarkExe();
  if (bundled) {
    // Phân biệt packaged vs repo
    const isPackaged = bundled.includes(path.join("resources", "APP_TEST"));
    return {
      found: true,
      path: bundled,
      source: isPackaged ? "packaged" : "repo",
      version: null,
    };
  }

  return {
    found: false,
    path: null,
    source: null,
    version: null,
    error:
      "Không tìm thấy furmark.exe. Cài FurMark vào APP_TEST/FurMark_win64/ hoặc đặt biến môi trường FURMARK_PATH.",
  };
}

/**
 * Trả về đường dẫn thư mục chứa furmark.exe (để truy cập _scores.csv).
 */
export function furmarkDirFromExe(exePath: string): string {
  return path.dirname(exePath);
}

/**
 * Sinh dòng header CSV nếu file _scores.csv chưa tồn tại.
 */
async function ensureScoresCsvHeader(csvPath: string): Promise<void> {
  try {
    await fs.stat(csvPath);
    return;
  } catch {
    const header =
      "date,demo,platform,vendor,renderer,api_version,width,height,fullscreen,antialiasing,duration,max_gpu_temp,score,avg_fps,min_fps,max_fps\n";
    await fs.writeFile(csvPath, header, "utf8");
  }
}

/**
 * Map width/height sang FurMark preset flag (nếu khớp). FurMark có 3 preset
 * built-in: 1080p, 1440p, 4K; các kích thước khác phải dùng --width/--height
 * (nhưng theo quan sát FurMark hay bỏ qua flag này nên ưu tiên preset).
 */
function resolutionFlag(width: number, height: number): string | null {
  if (width === 1920 && height === 1080) return "--p1080";
  if (width === 2560 && height === 1440) return "--p1440";
  if (width === 3840 && height === 2160) return "--p2160";
  return null;
}

/**
 * Chạy FurMark ở chế độ benchmark với width/height/duration truyền vào.
 *
 * Flow:
 *  - Tạo _scores.csv nếu chưa có
 *  - Spawn furmark.exe detached
 *  - Đợi tối đa `startupGraceMs` (mặc định 8s) để xác nhận FurMark đã sống.
 *    Nếu process thoát sớm với exit code ≠ 0 → throw ngay để user biết lỗi
 *    thay vì phải đợi hết timeout poll CSV.
 *  - Trả về csvPath + pid để UI poll điểm.
 */
export async function runFurmarkBenchmark(
  args: FurmarkBenchmarkArgs,
): Promise<FurmarkBenchmarkResult> {
  // Sanity check: file exe có tồn tại không?
  if (!existsSync(args.exePath)) {
    throw new Error(
      `Không tìm thấy furmark.exe tại: ${args.exePath}\nKiểm tra đường dẫn hoặc cài FurMark.`,
    );
  }

  const dir = furmarkDirFromExe(args.exePath);
  const csvPath = path.join(dir, "_scores.csv");
  await ensureScoresCsvHeader(csvPath);

  const api = args.api ?? "gl";
  const demo = api === "vk" ? "furmark-vk" : "furmark-gl";

  const w = Math.max(320, Math.floor(args.width));
  const h = Math.max(240, Math.floor(args.height));
  const duration = Math.max(1, Math.floor(args.durationSec));

  // FurMark yêu cầu duration flag khác nhau theo mode:
  //  - Preset (--p1080/--p1440/--p2160): KHÔNG dùng --duration-ms; dùng --max-time để giới hạn.
  //  - Custom (--width/--height): BẮT BUỘC dùng --duration-ms (tính bằng ms) cho benchmark.
  const presetFlag = resolutionFlag(w, h);
  const argv: string[] = [
    `--demo=${demo}`,
    "--benchmark",
    "--fullscreen",
    "--gpu-index=0",
    ...(presetFlag
      ? [presetFlag, `--max-time=${duration}`]
      : [`--width=${w}`, `--height=${h}`, `--duration-ms=${duration * 1000}`]),
    "--no-osi",
    "--no-score-box",
    "--no-gpumon", // giảm I/O overhead khi poll CSV
    "--disable-demo-options", // ẩn panel cài đặt FurMark
  ];

  console.log(`[furmark] cwd=${dir}`);
  console.log(`[furmark] argv=${argv.join(" ")}`);

  const grace = args.startupGraceMs ?? 12000;
  const child: ChildProcess = spawn(args.exePath, argv, {
    cwd: dir,
    windowsHide: false,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr?.on("data", (c: Buffer) => {
    stderr += c.toString("utf8");
  });
  child.stdout?.on("data", (c: Buffer) => {
    stderr += c.toString("utf8");
  });

  // Promise kết thúc khi:
  // (a) process thoát trong grace → có exit code → báo lỗi chi tiết
  // (b) process còn sống sau grace → coi như "đang chạy", resolve ngay
  return new Promise<FurmarkBenchmarkResult>((resolve, reject) => {
    let resolved = false;
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(graceTimer);
      const tail = stderr.trim().split(/\r?\n/).slice(-8).join("\n");
      reject(
        new Error(
          `FurMark đã thoát ngay (exit code=${code ?? "?"}${
            signal ? `, signal=${signal}` : ""
          }). Có thể thiếu GPU/driver OpenGL/Vulkan hoặc FurMark không tương thích máy này.${
            tail ? `\n\nLog FurMark:\n${tail}` : ""
          }`,
        ),
      );
    };

    child.on("exit", onExit);
    child.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(graceTimer);
      reject(
        new Error(
          `Không khởi động được FurMark: ${err.message}. Kiểm tra file exe và quyền admin.`,
        ),
      );
    });

    const graceTimer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      child.removeListener("exit", onExit);
      // FurMark đã sống qua grace → cho là đang chạy
      try {
        child.unref();
      } catch {
        // ignore
      }
      resolve({
        ok: true,
        csvPath,
        pid: child.pid ?? -1,
        exited: false,
        exitCode: null,
        pending: true,
      });
    }, grace);
  });
}

/**
 * Parse nội dung _scores.csv, trả về dòng mới nhất.
 */
export async function readLatestFurmarkScore(
  csvPath: string,
): Promise<FurmarkLatestResult> {
  try {
    const exists = await fs.stat(csvPath).then(
      () => true,
      () => false,
    );
    if (!exists) {
      return { found: false, row: null, csvPath };
    }
    const text = await fs.readFile(csvPath, "utf8");
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      return { found: false, row: null, csvPath };
    }
    const header = lines[0]!.split(",").map((s) => s.trim());
    const last = lines[lines.length - 1]!.split(",").map((s) => s.trim());
    const get = (name: string): string => {
      const idx = header.indexOf(name);
      return idx >= 0 && idx < last.length ? last[idx] ?? "" : "";
    };
    const row: FurmarkScoreRow = {
      date: get("date"),
      demo: get("demo"),
      platform: get("platform"),
      vendor: get("vendor"),
      renderer: get("renderer"),
      apiVersion: get("api_version"),
      width: Number(get("width")),
      height: Number(get("height")),
      fullscreen: get("fullscreen"),
      antialiasing: get("antialiasing"),
      duration: Number(get("duration")),
      maxGpuTemp: Number(get("max_gpu_temp")),
      score: Number(get("score")),
      avgFps: Number(get("avg_fps")),
      minFps: Number(get("min_fps")),
      maxFps: Number(get("max_fps")),
    };
    return { found: true, row, csvPath };
  } catch (err) {
    return {
      found: false,
      row: null,
      csvPath,
      error: (err as Error).message,
    };
  }
}