// BenchmarkTab.tsx — GPU (FurMark) + CPU (built-in) benchmarks
import * as React from "react";
import {
  Gauge,
  Play,
  Save,
  FolderOpen,
  CheckCircle2,
  Cpu,
  Zap,
  Loader2,
  Trophy,
  Settings2,
  Timer,
  MonitorSmartphone,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSessionStore } from "@/store";
import { cn } from "@/lib/utils";

type PresetId = "720p" | "900p" | "1080p" | "1440p" | "4K" | "custom";

interface PresetDef {
  id: PresetId;
  label: string;
  width: number;
  height: number;
}

const PRESETS: PresetDef[] = [
  { id: "720p", label: "720p (1280×720)", width: 1280, height: 720 },
  { id: "900p", label: "900p (1600×900)", width: 1600, height: 900 },
  { id: "1080p", label: "1080p (1920×1080)", width: 1920, height: 1080 },
  { id: "1440p", label: "1440p (2560×1440)", width: 2560, height: 1440 },
  { id: "4K", label: "4K (3840×2160)", width: 3840, height: 2160 },
];

const DURATION_PRESETS = [
  { id: 10, label: "10s (nhanh)" },
  { id: 30, label: "30s" },
  { id: 60, label: "1 phút" },
  { id: 120, label: "2 phút" },
  { id: 300, label: "5 phút" },
];

interface CpuBenchmarkResult {
  iterations: number;
  elapsedMs: number;
  opsPerSec: number;
  cpuName: string;
  cores: number;
  threads: number;
}

interface FurmarkScoreRow {
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

/**
 * Đường dẫn FurMark mặc định — bỏ trống để IPC `furmarkDetect` tự điền khi mount.
 * IPC sẽ tìm theo thứ tự: env FURMARK_PATH → where.exe → bundled (packaged/repo).
 */
function defaultFurmarkPath(): string {
  return "";
}

/** Hiển thị label dễ hiểu cho nguồn FurMark được phát hiện. */
function sourceLabel(source: string | null | undefined): string {
  switch (source) {
    case "packaged":
      return "đi kèm trong app (portable)";
    case "repo":
      return "trong thư mục repo";
    case "env":
      return "biến môi trường FURMARK_PATH";
    case "where":
      return "trong PATH";
    default:
      return "không rõ";
  }
}

export function BenchmarkTab() {
  const { benchmark, setBenchmark } = useSessionStore();
  const [furmarkPath, setFurmarkPath] = React.useState(defaultFurmarkPath());
  const [preset, setPreset] = React.useState<PresetId>("1080p");
  const [customW, setCustomW] = React.useState(1920);
  const [customH, setCustomH] = React.useState(1080);
  const [durationSec, setDurationSec] = React.useState(60);
  const [api, setApi] = React.useState<"gl" | "vk">("gl");
  const [detectedPath, setDetectedPath] = React.useState<string | null>(null);
  const [detectedSource, setDetectedSource] = React.useState<string | null>(null);
  const [detectError, setDetectError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [polling, setPolling] = React.useState(false);
  const [lastRow, setLastRow] = React.useState<FurmarkScoreRow | null>(null);
  const [csvPath, setCsvPath] = React.useState<string | null>(null);
  const [score, setScore] = React.useState<string>(
    benchmark?.score ? String(benchmark.score) : "",
  );
  const [fps, setFps] = React.useState<string>(benchmark?.fps ? String(benchmark.fps) : "");

  // CPU benchmark state
  const [cpuBusy, setCpuBusy] = React.useState(false);
  const [cpuDuration, setCpuDuration] = React.useState(10);
  const [cpuResult, setCpuResult] = React.useState<CpuBenchmarkResult | null>(null);

  const [width, height] = React.useMemo(() => {
    if (preset === "custom") return [customW, customH] as const;
    const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[2]!;
    return [p.width, p.height] as const;
  }, [preset, customW, customH]);

  React.useEffect(() => {
    void window.lap.bench.furmarkDetect().then((res) => {
      if (res.ok && res.data?.found && res.data.path) {
        setDetectedPath(res.data.path);
        setDetectedSource(res.data.source ?? null);
        setFurmarkPath(res.data.path);
        toast.info(`Đã phát hiện FurMark (${sourceLabel(res.data.source)}).`);
      } else {
        setDetectError(res.error ?? res.data?.error ?? "Không tìm thấy FurMark");
      }
    });
  }, []);

  const handlePickFile = async () => {
    const res = await window.lap.dialog.pickFile([{ name: "Executable", extensions: ["exe"] }]);
    if (res.ok && res.data && !res.data.canceled && res.data.filePaths[0]) {
      setFurmarkPath(res.data.filePaths[0]);
    }
  };

  /**
   * Poll file _scores.csv mỗi 3 giây để chờ FurMark ghi điểm mới.
   * Khi nhận ra dòng mới (so với `lastRow` trước đó), dừng poll và trả về.
   */
  const pollUntilNewScore = React.useCallback(
    async (csv: string): Promise<FurmarkScoreRow | null> => {
      const startTime = Date.now();
      const baselineDate = lastRow?.date ?? "";
      const maxWaitMs = (durationSec + 60) * 1000; // đợi tối đa duration + 60s
      for (;;) {
        const res = await window.lap.bench.furmarkReadScore(csv);
        if (res.ok && res.data?.found && res.data.row) {
          const row = res.data.row;
          if (!baselineDate || row.date > baselineDate) {
            return row;
          }
        }
        if (Date.now() - startTime > maxWaitMs) {
          toast.warning("Hết thời gian chờ FurMark ghi điểm. Kiểm tra cửa sổ FurMark đã đóng chưa.");
          return null;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    },
    [durationSec, lastRow],
  );

  const handleRunBenchmark = async () => {
    if (!furmarkPath) {
      toast.error("Chưa có đường dẫn FurMark");
      return;
    }
    if (preset === "custom") {
      if (customW < 320 || customH < 240) {
        toast.error("Độ phân giải tối thiểu 320×240");
        return;
      }
    }
    if (durationSec < 1) {
      toast.error("Thời gian test tối thiểu 1 giây");
      return;
    }
    setBusy(true);
    setPolling(false);
    try {
      const res = await window.lap.bench.furmarkRun({
        exePath: furmarkPath,
        width,
        height,
        durationSec,
        api,
      });
      if (!res.ok) {
        // Hiển thị error rõ ràng (FurMark crash trong grace period, file không tồn tại, v.v.)
        const msg = res.error ?? "Không chạy được FurMark";
        toast.error(msg, { duration: 12000 });
        return;
      }
      if (!res.data) {
        toast.error("Không có phản hồi từ main process");
        return;
      }
      const runData = res.data;
      setCsvPath(runData.csvPath);
      toast.success(
        `FurMark đang chạy ${width}×${height} trong ${durationSec}s. Vào cửa sổ FurMark để xem.`,
        { duration: 8000 },
      );
      setPolling(true);
      const row = await pollUntilNewScore(runData.csvPath);
      setPolling(false);
      if (row) {
        setLastRow(row);
        setScore(String(row.score));
        setFps(String(row.avgFps));
        toast.success(
          `Điểm FurMark: ${row.score} · FPS ${row.avgFps.toFixed(1)} · Max ${row.maxGpuTemp}°C`,
        );
      }
    } catch (err) {
      toast.error((err as Error).message, { duration: 12000 });
    } finally {
      setBusy(false);
      setPolling(false);
    }
  };

  /** Đọc lại điểm từ CSV (chạy thủ công). */
  const handleRefreshScore = async () => {
    if (!csvPath) {
      toast.error("Chưa có đường dẫn CSV. Hãy chạy benchmark trước.");
      return;
    }
    const res = await window.lap.bench.furmarkReadScore(csvPath);
    if (!res.ok) { toast.error(res.error ?? "Không đọc được điểm"); return; }
    if (res.data?.found && res.data.row) {
      setLastRow(res.data.row);
      setScore(String(res.data.row.score));
      setFps(String(res.data.row.avgFps));
      toast.success("Đã cập nhật điểm");
    } else {
      toast.info("Chưa có dòng điểm nào trong CSV");
    }
  };

  const handleSave = () => {
    const scoreNum = Number(score);
    const fpsNum = fps ? Number(fps) : undefined;
    if (!Number.isFinite(scoreNum) || scoreNum <= 0) { toast.error("Điểm không hợp lệ"); return; }
    if (fpsNum !== undefined && !Number.isFinite(fpsNum)) { toast.error("FPS không hợp lệ"); return; }
    const presetLabel =
      preset === "custom"
        ? `Custom ${width}×${height}`
        : PRESETS.find((p) => p.id === preset)?.label ?? preset;
    const fullPreset = `${presetLabel} · ${durationSec}s · ${api.toUpperCase()}`;
    setBenchmark({
      tool: "FurMark",
      score: Math.round(scoreNum),
      fps: fpsNum,
      preset: fullPreset,
      capturedAt: new Date().toISOString(),
    });
    toast.success("Đã lưu điểm GPU benchmark");
  };

  // CPU Benchmark
  const handleCpuBenchmark = async () => {
    setCpuBusy(true);
    setCpuResult(null);
    try {
      const res = await window.lap.bench.cpuBenchmark(cpuDuration);
      if (!res.ok) { toast.error(res.error ?? "Benchmark thất bại"); return; }
      const stdout = res.data?.stdout ?? "";
      try {
        const parsed = JSON.parse(stdout.trim()) as CpuBenchmarkResult;
        setCpuResult(parsed);
        toast.success(`CPU benchmark hoàn tất: ${(parsed.opsPerSec / 1_000_000).toFixed(1)} M ops/s`);
      } catch {
        toast.error("Không parse được kết quả benchmark");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCpuBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── GPU Benchmark ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" /> FurMark GPU Benchmark
          </CardTitle>
          <CardDescription>
            Chọn độ phân giải và thời gian test, sau đó bấm <b>Chạy benchmark</b>. App sẽ tự mở FurMark
            fullscreen và <b>tự đọc điểm từ file _scores.csv</b> khi FurMark ghi xong.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Đường dẫn FurMark */}
          <div className="space-y-2">
            <Label htmlFor="furmark-path">Đường dẫn furmark.exe</Label>
            <div className="flex gap-2">
              <Input
                id="furmark-path"
                value={furmarkPath}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFurmarkPath(e.target.value)}
                className="font-mono text-xs"
                spellCheck={false}
              />
              <Button variant="outline" size="icon" onClick={handlePickFile} title="Duyệt file…">
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            {detectedPath ? (
              <p className="text-xs text-emerald-500">
                Đã phát hiện FurMark ({sourceLabel(detectedSource)}):{" "}
                <span className="font-mono">{detectedPath}</span>
              </p>
            ) : detectError ? (
              <p className="text-xs text-amber-500">
                {detectError}. Hãy đặt FURMARK_PATH hoặc cài FurMark vào{" "}
                <span className="font-mono">APP_TEST\FurMark_win64\</span>, hoặc bấm 📂 chọn file thủ công.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Đang quét: env <code>FURMARK_PATH</code>, PATH, thư mục <code>APP_TEST\FurMark_win64\</code>…
              </p>
            )}
          </div>

          {/* Preset độ phân giải */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MonitorSmartphone className="h-3.5 w-3.5" /> Độ phân giải
              </Label>
              <div className="inline-flex flex-wrap rounded-lg border border-border/60 bg-muted p-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                      preset === p.id
                        ? "bg-background text-foreground shadow"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p.id}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPreset("custom")}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                    preset === "custom"
                      ? "bg-background text-foreground shadow"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Custom
                </button>
              </div>
              {preset === "custom" && (
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    type="number"
                    min={320}
                    value={customW}
                    onChange={(e) => setCustomW(Number(e.target.value))}
                    className="w-24 font-mono text-xs"
                    placeholder="Width"
                  />
                  <span className="text-muted-foreground">×</span>
                  <Input
                    type="number"
                    min={240}
                    value={customH}
                    onChange={(e) => setCustomH(Number(e.target.value))}
                    className="w-24 font-mono text-xs"
                    placeholder="Height"
                  />
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                Đang chọn: <span className="font-mono">{width}×{height}</span>
              </p>
            </div>

            {/* Thời gian test */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5" /> Thời gian test
              </Label>
              <div className="inline-flex flex-wrap rounded-lg border border-border/60 bg-muted p-1">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDurationSec(d.id)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                      durationSec === d.id
                        ? "bg-background text-foreground shadow"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  min={1}
                  max={3600}
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  className="w-24 font-mono text-xs"
                />
                <span className="text-xs text-muted-foreground">giây</span>
              </div>

              {/* API */}
              <div className="pt-2">
                <Label className="flex items-center gap-1.5">
                  <Settings2 className="h-3.5 w-3.5" /> API
                </Label>
                <div className="mt-1 inline-flex rounded-lg border border-border/60 bg-muted p-1">
                  <button
                    type="button"
                    onClick={() => setApi("gl")}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium transition-all",
                      api === "gl"
                        ? "bg-background text-foreground shadow"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    OpenGL
                  </button>
                  <button
                    type="button"
                    onClick={() => setApi("vk")}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium transition-all",
                      api === "vk"
                        ? "bg-background text-foreground shadow"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Vulkan
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Nút chạy */}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleRunBenchmark} disabled={busy || polling}>
              {busy || polling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {busy
                ? "Đang khởi động FurMark…"
                : polling
                  ? "Đang chờ FurMark ghi điểm…"
                  : `Chạy benchmark ${width}×${height} · ${durationSec}s`}
            </Button>
            {csvPath && (
              <Button variant="ghost" size="sm" onClick={handleRefreshScore} disabled={polling}>
                <RefreshCcw className="h-3.5 w-3.5" /> Đọc lại điểm
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              FurMark sẽ chạy fullscreen. Đừng tắt cửa sổ FurMark giữa chừng.
            </p>
          </div>

          {/* Hiển thị điểm tự động đọc */}
          {lastRow && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-300">Điểm FurMark mới nhất</span>
                <Badge variant="secondary" className="ml-auto font-mono text-[10px]">
                  {lastRow.date}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ScoreCell label="Score" value={lastRow.score.toLocaleString()} highlight />
                <ScoreCell label="FPS trung bình" value={lastRow.avgFps.toFixed(1)} />
                <ScoreCell
                  label="FPS min / max"
                  value={`${lastRow.minFps} / ${lastRow.maxFps}`}
                />
                <ScoreCell
                  label="Nhiệt độ max"
                  value={`${lastRow.maxGpuTemp}°C`}
                />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                <p><span className="text-foreground/70">GPU:</span> {lastRow.renderer}</p>
                <p><span className="text-foreground/70">API:</span> {lastRow.apiVersion}</p>
                <p><span className="text-foreground/70">Độ phân giải:</span> {lastRow.width}×{lastRow.height}</p>
                <p><span className="text-foreground/70">Thời lượng:</span> {lastRow.duration} ms</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Cho phép sửa tay score / fps trước khi lưu */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="score">Score (điểm GPU)</Label>
              <Input
                id="score"
                type="number"
                inputMode="numeric"
                value={score}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScore(e.target.value)}
                placeholder="5109"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fps">FPS trung bình</Label>
              <Input
                id="fps"
                type="number"
                inputMode="decimal"
                value={fps}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFps(e.target.value)}
                placeholder="43.5"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleSave}>
              <Save className="h-4 w-4" /> Lưu điểm
            </Button>
            {benchmark ? (
              <Badge variant="secondary">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Đã lưu: {benchmark.score} điểm{benchmark.fps ? ` · ${benchmark.fps} fps` : ""}
                {benchmark.preset ? ` · ${benchmark.preset}` : ""}
              </Badge>
            ) : null}
          </div>

          {csvPath && (
            <p className="text-[10px] text-muted-foreground">
              Điểm đang được đọc từ <span className="font-mono">{csvPath}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── CPU Benchmark ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" /> CPU Benchmark (tích hợp)
          </CardTitle>
          <CardDescription>
            Benchmark CPU tích hợp sẵn — không cần cài thêm phần mềm. Đo tốc độ tính toán số học.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="cpu-dur" className="whitespace-nowrap">Thời gian test:</Label>
              <select
                id="cpu-dur"
                value={cpuDuration}
                onChange={(e) => setCpuDuration(Number(e.target.value))}
                className="rounded-md border border-border/60 bg-card px-2 py-1 text-sm"
              >
                <option value={5}>5 giây</option>
                <option value={10}>10 giây</option>
                <option value={20}>20 giây</option>
                <option value={30}>30 giây</option>
              </select>
            </div>
            <Button onClick={handleCpuBenchmark} disabled={cpuBusy}>
              {cpuBusy ? (
                <Zap className="mr-1 h-4 w-4 animate-pulse" />
              ) : (
                <Play className="mr-1 h-4 w-4" />
              )}
              {cpuBusy ? "Đang benchmark..." : "Chạy CPU Benchmark"}
            </Button>
          </div>

          {cpuResult ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <CpuStat
                  label="CPU"
                  value={cpuResult.cpuName?.split(" ").slice(0, 4).join(" ") ?? "—"}
                />
                <CpuStat
                  label="Nhân / Luồng"
                  value={`${cpuResult.cores} / ${cpuResult.threads}`}
                />
                <CpuStat
                  label="Thời gian"
                  value={`${(cpuResult.elapsedMs / 1000).toFixed(1)}s`}
                />
                <CpuStat
                  label="Tốc độ"
                  value={`${(cpuResult.opsPerSec / 1_000_000).toFixed(1)} M/s`}
                  highlight
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBenchmark({
                      tool: `CPU: ${cpuResult.cpuName?.split(" ").slice(0, 3).join(" ") ?? "CPU"}`,
                      score: Math.round(cpuResult.opsPerSec / 1_000_000 * 100),
                      fps: undefined,
                      preset: `${cpuDuration}s`,
                      capturedAt: new Date().toISOString(),
                    });
                    toast.success("Đã lưu CPU benchmark");
                  }}
                >
                  <Save className="mr-1 h-3.5 w-3.5" /> Lưu CPU benchmark
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      `CPU: ${cpuResult.cpuName} | ${cpuResult.cores}C/${cpuResult.threads}T | ${(cpuResult.opsPerSec / 1_000_000).toFixed(1)} M ops/s`
                    );
                    toast.success("Đã copy");
                  }}
                >
                  <Zap className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Benchmark đo số phép tính số học dấu phẩy động mỗi giây (FLOPS approximation).
            Kết quả phụ thuộc workload — chỉ dùng để so sánh tương đối giữa các máy.
          </p>
        </CardContent>
      </Card>

      {/* ── UserBenchmark ── */}
      <Card>
        <CardHeader>
          <CardTitle>UserBenchmark / Khác</CardTitle>
          <CardDescription>
            Chạy thủ công rồi nhập điểm vào tab Upload.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function ScoreCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-black/20 p-2 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-base font-bold",
          highlight ? "text-emerald-400" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CpuStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-0.5 font-mono text-sm font-semibold",
        highlight ? "text-emerald-400" : "text-foreground"
      )}>
        {value}
      </p>
    </div>
  );
}
