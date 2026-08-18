import * as React from "react";
import { Gauge, Play, Save, FolderOpen, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSessionStore } from "@/store";

type Preset = "1080p" | "1440p" | "4K";

const PRESETS: { id: Preset; label: string; width: number; height: number }[] = [
  { id: "1080p", label: "1080p (1920×1080)", width: 1920, height: 1080 },
  { id: "1440p", label: "1440p (2560×1440)", width: 2560, height: 1440 },
  { id: "4K", label: "4K (3840×2160)", width: 3840, height: 2160 },
];

export function BenchmarkTab() {
  const { benchmark, setBenchmark } = useSessionStore();
  const [furmarkPath, setFurmarkPath] = React.useState(
    "C:\\Program Files\\Geeks3D\\FurMark\\furmark.exe",
  );
  const [preset, setPreset] = React.useState<Preset>("1080p");
  const [detectedPath, setDetectedPath] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [score, setScore] = React.useState<string>(
    benchmark?.score ? String(benchmark.score) : "",
  );
  const [fps, setFps] = React.useState<string>(benchmark?.fps ? String(benchmark.fps) : "");

  React.useEffect(() => {
    void window.lap.bench.furmarkDetect().then((res) => {
      if (res.ok && res.data?.found && res.data.path) {
        setDetectedPath(res.data.path);
        setFurmarkPath(res.data.path);
        toast.info("Đã phát hiện FurMark");
      }
    });
  }, []);

  const handlePickFile = async () => {
    const res = await window.lap.dialog.pickFile([
      { name: "Executable", extensions: ["exe"] },
    ]);
    if (res.ok && res.data && !res.data.canceled && res.data.filePaths[0]) {
      setFurmarkPath(res.data.filePaths[0]);
    }
  };

  const handleLaunch = async () => {
    if (!furmarkPath) {
      toast.error("Chưa có đường dẫn FurMark");
      return;
    }
    setBusy(true);
    try {
      const res = await window.lap.bench.furmarkLaunch(furmarkPath);
      if (!res.ok) {
        toast.error(res.error ?? "Không chạy được FurMark");
        return;
      }
      toast.success("Đã khởi động FurMark. Chạy benchmark rồi nhập điểm bên dưới.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => {
    const scoreNum = Number(score);
    const fpsNum = fps ? Number(fps) : undefined;
    if (!Number.isFinite(scoreNum) || scoreNum <= 0) {
      toast.error("Điểm không hợp lệ");
      return;
    }
    if (fpsNum !== undefined && !Number.isFinite(fpsNum)) {
      toast.error("FPS không hợp lệ");
      return;
    }
    const presetLabel = PRESETS.find((p) => p.id === preset)?.label ?? preset;
    setBenchmark({
      tool: "FurMark",
      score: Math.round(scoreNum),
      fps: fpsNum,
      preset: presetLabel,
      capturedAt: new Date().toISOString(),
    });
    toast.success("Đã lưu điểm benchmark");
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" /> FurMark GPU Benchmark
          </CardTitle>
          <CardDescription>
            Khởi động FurMark để chạy stress test. Sau khi hoàn tất, nhập điểm và FPS vào bên dưới.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Button variant="outline" size="icon" onClick={handlePickFile} aria-label="Chọn file">
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            {detectedPath ? (
              <p className="text-xs text-emerald-500">
                Đã phát hiện FurMark tại <span className="font-mono">{detectedPath}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Mặc định: <span className="font-mono">C:\Program Files\Geeks3D\FurMark\furmark.exe</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Preset</Label>
            <div className="inline-flex rounded-lg border border-border/60 bg-muted p-1">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    preset === p.id
                      ? "bg-background text-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.id}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleLaunch} disabled={busy || !furmarkPath}>
              <Play className="h-4 w-4" /> {busy ? "Đang khởi động..." : "Chạy FurMark"}
            </Button>
            <p className="text-xs text-muted-foreground">
              FurMark sẽ chạy ở chế độ fullscreen. Sau khi điểm hiển thị, đóng FurMark rồi nhập số điểm vào đây.
            </p>
          </div>

          <Separator />

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
              <Save className="h-4 w-4" /> Lưu & Upload sau
            </Button>
            {benchmark ? (
              <Badge variant="secondary">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Đã lưu: {benchmark.score} điểm{benchmark.fps ? ` · ${benchmark.fps} fps` : ""}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>UserBenchmark / Khác</CardTitle>
          <CardDescription>
            Hiện chưa tích hợp tự động. Có thể chạy thủ công rồi nhập điểm vào tab Upload.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}