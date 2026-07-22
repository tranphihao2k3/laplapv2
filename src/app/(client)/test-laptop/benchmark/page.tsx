"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Download, Flame, Play, CheckCircle2, AlertCircle,
  Upload, Copy, RefreshCw, Trophy, ChevronRight,
  Terminal, Clock, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

// ── Types ─────────────────────────────────────────────────────────────
type Step = "download" | "run" | "score" | "submit" | "done";

type SubmitResult = {
  laptop_id: string;
  gpu_rank: string | null;
  percentile: number;
  message: string;
};

// ── Constants ─────────────────────────────────────────────────────────
const DURATION_SECONDS = 300; // 5 phút

const RANK_STYLE: Record<string, string> = {
  Excellent: "bg-violet-100 text-violet-700 border-violet-200",
  Good:      "bg-blue-100 text-blue-700 border-blue-200",
  Fair:      "bg-amber-100 text-amber-700 border-amber-200",
  Poor:      "bg-red-100 text-red-700 border-red-200",
};

function calcGpuRank(score: number): string {
  if (score >= 8000) return "Excellent";
  if (score >= 6000) return "Good";
  if (score >= 4000) return "Fair";
  return "Poor";
}

// ── Shared step indicator ─────────────────────────────────────────────
function StepBubble({
  num, label, active, done,
}: { num: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
        done   ? "bg-green-500 text-white" :
        active ? "bg-zinc-900 text-white"  : "bg-zinc-200 text-zinc-500"
      }`}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : num}
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ${
        active ? "text-zinc-900" : done ? "text-green-600" : "text-zinc-400"
      }`}>{label}</span>
    </div>
  );
}

// ── Countdown Timer ───────────────────────────────────────────────────
function CountdownTimer({
  running, totalSeconds, onFinish,
}: { running: boolean; totalSeconds: number; onFinish: () => void }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!running) { setRemaining(totalSeconds); finishedRef.current = false; return; }
    setRemaining(totalSeconds);
    finishedRef.current = false;
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!finishedRef.current) { finishedRef.current = true; onFinish(); }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, totalSeconds, onFinish]);

  const pct     = ((totalSeconds - remaining) / totalSeconds) * 100;
  const mins    = Math.floor(remaining / 60);
  const secs    = remaining % 60;
  const display = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">Thời gian còn lại</span>
        <span className={`text-2xl font-mono font-bold tabular-nums ${remaining === 0 ? "text-green-600" : "text-zinc-900"}`}>
          {display}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${remaining === 0 ? "bg-green-500" : "bg-orange-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {remaining === 0 ? "✓ Benchmark hoàn tất!" : "Đang chạy FurMark — không tắt cửa sổ benchmark"}
      </p>
    </div>
  );
}

// ── Copy button helper ────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-zinc-900"
    >
      {copied ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Đã copy" : "Copy"}
    </button>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────
function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function BenchmarkPage() {
  const [step, setStep]         = useState<Step>("download");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDone, setTimerDone]       = useState(false);

  // Score entry
  const [score, setScore]       = useState("");
  const [fpsAvg, setFpsAvg]     = useState("");

  // Device info
  const [deviceId, setDeviceId]         = useState("");
  const [deviceName, setDeviceName]     = useState("");
  const [gpuName, setGpuName]           = useState("");
  const [gpuVendor, setGpuVendor]       = useState("");
  const [gpuVramGb, setGpuVramGb]       = useState("");
  const [gpuPowerWatts, setGpuPowerWatts] = useState("");
  const [cpuName, setCpuName]           = useState("");
  const [cpuCores, setCpuCores]         = useState("");
  const [cpuThreads, setCpuThreads]     = useState("");
  const [cpuBaseGhz, setCpuBaseGhz]     = useState("");
  const [ramGb, setRamGb]               = useState("");
  const [ramBrand, setRamBrand]         = useState("");
  const [ramSpeedMhz, setRamSpeedMhz]   = useState("");
  const [ramType, setRamType]           = useState("");
  const [ramSlots, setRamSlots]         = useState("");
  const [storageBrand, setStorageBrand] = useState("");
  const [storageType, setStorageType]   = useState("");
  const [storageGb, setStorageGb]       = useState("");
  const [batteryDesignMwh, setBatteryDesignMwh] = useState("");
  const [batteryFullMwh, setBatteryFullMwh]     = useState("");
  const [techName, setTechName]         = useState("");
  const [note, setNote]                 = useState("");

  // Submit state
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const scoreNum = parseInt(score) || 0;
  const rankPreview = scoreNum > 0 ? calcGpuRank(scoreNum) : null;

  const onTimerFinish = useCallback(() => {
    setTimerDone(true);
    setTimerRunning(false);
  }, []);

  // Auto-advance từ run -> score khi timer xong
  useEffect(() => {
    if (timerDone) setStep("score");
  }, [timerDone]);

  const STEPS: { key: Step; label: string }[] = [
    { key: "download", label: "Tải FurMark" },
    { key: "run",      label: "Chạy Benchmark" },
    { key: "score",    label: "Nhập điểm" },
    { key: "submit",   label: "Lưu kết quả" },
  ];

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  async function handleSubmit() {
    if (!deviceId.trim() || !deviceName.trim()) {
      setSubmitError("Vui lòng nhập Device ID và Tên thiết bị.");
      return;
    }
    if (scoreNum <= 0) {
      setSubmitError("Điểm GPU phải lớn hơn 0.");
      return;
    }
    setLoading(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        device_id:             deviceId.trim(),
        device_name:           deviceName.trim(),
        gpu_score:             scoreNum,
        test_duration_seconds: DURATION_SECONDS,
      };
      if (fpsAvg)    payload.fps_avg   = parseFloat(fpsAvg);
      if (gpuName)   payload.gpu_name  = gpuName.trim();
      if (gpuVendor) payload.gpu_vendor = gpuVendor.trim();
      if (gpuVramGb) payload.gpu_vram_gb = parseInt(gpuVramGb, 10);
      if (gpuPowerWatts) payload.gpu_power_watts = parseInt(gpuPowerWatts, 10);
      if (cpuName)   payload.cpu_name  = cpuName.trim();
      if (cpuCores)  payload.cpu_cores = parseInt(cpuCores, 10);
      if (cpuThreads) payload.cpu_threads = parseInt(cpuThreads, 10);
      if (cpuBaseGhz) payload.cpu_base_ghz = parseFloat(cpuBaseGhz);
      if (ramGb)     payload.ram_gb    = parseInt(ramGb, 10);
      if (ramBrand)  payload.ram_brand = ramBrand.trim();
      if (ramSpeedMhz) payload.ram_speed_mhz = parseInt(ramSpeedMhz, 10);
      if (ramType)   payload.ram_type  = ramType.trim();
      if (ramSlots)  payload.ram_slots = parseInt(ramSlots, 10);
      if (storageBrand) payload.storage_brand = storageBrand.trim();
      if (storageType)  payload.storage_type  = storageType.trim();
      if (storageGb)    payload.storage_gb    = parseInt(storageGb, 10);
      if (batteryDesignMwh) payload.battery_design_mwh = parseInt(batteryDesignMwh, 10);
      if (batteryFullMwh)   payload.battery_full_mwh   = parseInt(batteryFullMwh, 10);
      if (techName)  payload.tech_name = techName.trim();
      if (note)      payload.note      = note.trim();

      const res  = await fetch("/api/v1/laptops/submit", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Lỗi server");
      setResult(json.data as SubmitResult);
      setStep("done");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  // ── Done screen ────────────────────────────────────────────────────
  if (step === "done" && result) {
    const top = 100 - result.percentile;
    return (
      <div className="container mx-auto max-w-xl px-4 py-8 sm:py-12">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center sm:p-8">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
          <h2 className="text-xl font-bold text-zinc-900">Upload thành công!</h2>
          <p className="mt-1 text-sm text-muted-foreground">Điểm benchmark đã được lưu lên bảng xếp hạng</p>

          <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
            <div className="rounded-xl border bg-white p-3">
              <p className="text-xs text-muted-foreground">GPU Score</p>
              <p className="mt-1 text-xl font-bold text-zinc-900">{scoreNum.toLocaleString("vi-VN")}</p>
            </div>
            {result.gpu_rank && (
              <div className="rounded-xl border bg-white p-3">
                <p className="text-xs text-muted-foreground">Xếp loại</p>
                <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${RANK_STYLE[result.gpu_rank] ?? ""}`}>
                  {result.gpu_rank}
                </span>
              </div>
            )}
            {result.percentile > 0 && (
              <div className="rounded-xl border bg-white p-3">
                <p className="text-xs text-muted-foreground">Hạng</p>
                <p className="mt-1 text-lg font-bold text-green-600">Top {top}%</p>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Thông số máy đã gửi</p>
            <div className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
              {cpuName && <div>CPU: {cpuName}{cpuCores ? ` • ${cpuCores} cores${cpuThreads ? ` / ${cpuThreads} threads` : ""}` : ""}{cpuBaseGhz ? ` • ${cpuBaseGhz} GHz` : ""}</div>}
              {ramGb && <div>RAM: {ramGb} GB{ramBrand ? ` • ${ramBrand}` : ""}{ramSpeedMhz ? ` • ${ramSpeedMhz} MHz` : ""}{ramType ? ` • ${ramType}` : ""}{ramSlots ? ` • ${ramSlots} slots` : ""}</div>}
              {storageGb && <div>Storage: {storageGb} GB{storageBrand ? ` • ${storageBrand}` : ""}{storageType ? ` • ${storageType}` : ""}</div>}
              {gpuName && <div>GPU: {gpuName}{gpuVendor ? ` • ${gpuVendor}` : ""}{gpuVramGb ? ` • ${gpuVramGb} GB` : ""}{gpuPowerWatts ? ` • ${gpuPowerWatts} W` : ""}</div>}
              {(batteryDesignMwh || batteryFullMwh) && <div>Pin: {batteryDesignMwh ? `${batteryDesignMwh} mWh design` : ""}{batteryFullMwh ? `${batteryDesignMwh ? " • " : ""}${batteryFullMwh} mWh full charge` : ""}</div>}
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => { setStep("download"); setResult(null); setScore(""); setFpsAvg(""); setGpuName(""); setGpuVendor(""); setGpuVramGb(""); setGpuPowerWatts(""); setCpuName(""); setCpuCores(""); setCpuThreads(""); setCpuBaseGhz(""); setRamGb(""); setRamBrand(""); setRamSpeedMhz(""); setRamType(""); setRamSlots(""); setStorageBrand(""); setStorageType(""); setStorageGb(""); setBatteryDesignMwh(""); setBatteryFullMwh(""); setTechName(""); setNote(""); }}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Test máy khác
            </button>
            <a href="/test-laptop" className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
              <Trophy className="h-4 w-4" /> Xem bảng xếp hạng
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────
  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 sm:py-8">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Flame className="h-5 w-5 shrink-0 text-orange-500" />
          <h2 className="text-lg font-bold text-zinc-900 sm:text-xl">GPU Benchmark (FurMark)</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Chạy FurMark 5 phút rồi upload điểm lên bảng xếp hạng. Làm theo 4 bước bên dưới.
        </p>
      </div>

      {/* Step progress */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <StepBubble
              num={i + 1}
              label={s.label}
              active={step === s.key}
              done={stepIndex > i}
            />
            {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" />}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-5">

        {/* ── STEP 1: Download ───────────────────────────────────────── */}
        <Section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100">
                <Download className="h-4 w-4 text-orange-600" />
              </div>
              <h3 className="font-semibold text-zinc-900">Bước 1 — Tải FurMark 2</h3>
            </div>
            {stepIndex > 0 && <Badge variant="outline" className="text-green-600 border-green-200">✓ Xong</Badge>}
          </div>

          <p className="mb-3 text-sm text-zinc-600">
            FurMark 2 là công cụ stress-test GPU miễn phí. Tải bản mới nhất từ trang chủ chính thức.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => window.open("https://geeks3d.com/furmark/", "_blank")}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Tải FurMark 2 (trang chủ)
            </Button>

            <Button
              variant="outline"
              onClick={() => window.open("https://www.techpowerup.com/download/furmark/", "_blank")}
              className="gap-2 text-muted-foreground"
            >
              Mirror (TechPowerUp)
            </Button>
          </div>

          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
            <p className="font-medium">Lưu ý khi cài đặt:</p>
            <p>• Cài xong, nhớ đường dẫn đến <code className="font-mono bg-amber-100 px-1 rounded">furmark.exe</code></p>
            <p>• Thường nằm tại: <code className="font-mono bg-amber-100 px-1 rounded">C:\Program Files\FurMark2\</code> hoặc trong thư mục giải nén</p>
          </div>

          {step === "download" && (
            <div className="mt-4">
              <Button onClick={() => setStep("run")} className="gap-2">
                Đã tải xong, tiếp theo <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Section>

        {/* ── STEP 2: Run benchmark ──────────────────────────────────── */}
        <Section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${step === "run" ? "bg-orange-100" : "bg-zinc-100"}`}>
                <Play className={`h-4 w-4 ${step === "run" ? "text-orange-600" : "text-zinc-400"}`} />
              </div>
              <h3 className="font-semibold text-zinc-900">Bước 2 — Chạy Benchmark 5 phút</h3>
            </div>
            {timerDone && <Badge variant="outline" className="text-green-600 border-green-200">✓ Xong</Badge>}
          </div>

          {/* Option A: Auto script */}
          <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="h-4 w-4 text-zinc-600" />
              <span className="text-sm font-semibold text-zinc-700">Cách A — Tự động (khuyên dùng)</span>
              <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Script</Badge>
            </div>
            <p className="text-xs text-zinc-600 mb-3">
              Tải 1 file .exe về, chạy — tự cài FurMark (nếu thiếu), lấy cấu hình máy, chọn tùy chọn test.
              Xong xuôi trình duyệt <strong>tự mở trang kết quả</strong> để bạn xem điểm + cấu hình rồi bấm Lưu.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/scripts/furmark-benchmark.exe"
                download="furmark-benchmark.exe"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-900 bg-zinc-900 text-white px-4 py-2 text-sm font-medium hover:bg-zinc-700 transition-colors"
              >
                <Download className="h-4 w-4" /> Tải furmark-benchmark.exe
              </a>
            </div>
            <div className="mt-3 rounded bg-zinc-800 px-3 py-2 font-mono text-xs text-green-400 flex items-center justify-between gap-2">
              <span className="truncate">1. Tải .exe  2. Double-click chạy  3. Chọn tùy chọn test  4. Chờ benchmark  5. Trình duyệt tự mở kết quả → Lưu</span>
              <CopyButton text={"furmark-benchmark.exe"} />
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              Nếu Windows SmartScreen cảnh báo “Unknown publisher”, bấm <strong>More info → Run anyway</strong> (file chưa ký số).
            </p>
          </div>

          {/* Option B: Manual */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="h-4 w-4 text-zinc-600" />
              <span className="text-sm font-semibold text-zinc-700">Cách B — Thủ công</span>
            </div>
            <ol className="text-xs text-zinc-600 space-y-1.5 list-decimal list-inside">
              <li>Mở FurMark 2, chọn <strong>GPU Benchmark</strong></li>
              <li>Chọn preset <strong>1080p</strong>, đặt Duration = <strong>300 giây (5 phút)</strong></li>
              <li>Nhấn <strong>GPU Benchmark</strong> → chờ 5 phút</li>
              <li>Ghi lại số <strong>Score</strong> hiện trên màn hình kết quả</li>
              <li>Nhập điểm vào Bước 3 bên dưới</li>
            </ol>
          </div>

          {/* Timer */}
          {(step === "run" || timerDone) && (
            <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-800">Bộ đếm giờ 5 phút</span>
              </div>
              <CountdownTimer
                running={timerRunning}
                totalSeconds={DURATION_SECONDS}
                onFinish={onTimerFinish}
              />
              <div className="mt-3 flex gap-2">
                {!timerRunning && !timerDone && (
                  <Button size="sm" onClick={() => setTimerRunning(true)} className="gap-1.5 bg-orange-500 hover:bg-orange-600">
                    <Play className="h-3.5 w-3.5" /> Bắt đầu đếm giờ
                  </Button>
                )}
                {timerRunning && (
                  <Button size="sm" variant="outline" onClick={() => { setTimerRunning(false); setTimerDone(false); }}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Đặt lại
                  </Button>
                )}
                {timerDone && (
                  <Button size="sm" onClick={() => setStep("score")} className="gap-1.5">
                    Nhập điểm <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {step === "run" && !timerRunning && !timerDone && (
            <div className="mt-3 text-xs text-muted-foreground">
              Nhấn "Bắt đầu đếm giờ" đồng thời khi nhấn nút benchmark trong FurMark.
            </div>
          )}
        </Section>

        {/* ── STEP 3: Enter score ────────────────────────────────────── */}
        <Section>
          <div className="flex items-center gap-2 mb-4">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${step === "score" ? "bg-blue-100" : "bg-zinc-100"}`}>
              <Trophy className={`h-4 w-4 ${step === "score" ? "text-blue-600" : "text-zinc-400"}`} />
            </div>
            <h3 className="font-semibold text-zinc-900">Bước 3 — Nhập điểm từ FurMark</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Điểm GPU (Score) *</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={20000}
                  placeholder="vd: 5109"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                />
                {rankPreview && (
                  <Badge className={`shrink-0 border text-xs ${RANK_STYLE[rankPreview]}`}>
                    {rankPreview}
                  </Badge>
                )}
              </div>
              {rankPreview && (
                <p className="text-xs text-muted-foreground">
                  {rankPreview === "Excellent" && "🏆 Xuất sắc — GPU rất mạnh"}
                  {rankPreview === "Good"      && "✅ Tốt — GPU ổn định"}
                  {rankPreview === "Fair"      && "⚠️ Trung bình — Đủ dùng"}
                  {rankPreview === "Poor"      && "❌ Yếu — Cần nâng cấp"}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">FPS trung bình (tuỳ chọn)</Label>
              <Input
                type="number"
                min={0}
                step="0.1"
                placeholder="vd: 43.5"
                value={fpsAvg}
                onChange={(e) => setFpsAvg(e.target.value)}
              />
            </div>
          </div>

          {step === "score" && (
            <div className="mt-4">
              <Button
                onClick={() => setStep("submit")}
                disabled={scoreNum <= 0}
                className="gap-2"
              >
                Tiếp theo — Nhập thông tin máy <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </Section>

        {/* ── STEP 4: Submit ─────────────────────────────────────────── */}
        <Section>
          <div className="flex items-center gap-2 mb-4">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${step === "submit" ? "bg-green-100" : "bg-zinc-100"}`}>
              <Upload className={`h-4 w-4 ${step === "submit" ? "text-green-600" : "text-zinc-400"}`} />
            </div>
            <h3 className="font-semibold text-zinc-900">Bước 4 — Lưu lên bảng xếp hạng</h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Device ID * <span className="text-zinc-400">(MAC / hostname / số seri)</span></Label>
              <Input
                placeholder="vd: ASUS-TUF-F15-001"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tên thiết bị *</Label>
              <Input
                placeholder="vd: ASUS TUF Gaming F15"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">Thông số phần cứng (tuỳ chọn)</p>
              <p className="mt-1 text-xs text-zinc-500">Nếu bạn dùng script tự động, hệ thống sẽ thu thập CPU/RAM/SSD/VGA/Pin từ máy. Bạn có thể chỉnh bổ sung nếu cần.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tên CPU</Label>
              <Input
                placeholder="vd: Intel Core i7-12700H"
                value={cpuName}
                onChange={(e) => setCpuName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CPU cores / threads</Label>
              <Input
                placeholder="vd: 14 / 20"
                value={cpuCores && cpuThreads ? `${cpuCores}/${cpuThreads}` : cpuCores ? cpuCores : cpuThreads ? cpuThreads : ""}
                onChange={(e) => {
                  const text = e.target.value;
                  const parts = text.split(/[\/]/).map((p) => p.trim()).filter(Boolean);
                  if (parts.length >= 1) setCpuCores(parts[0]);
                  if (parts.length >= 2) setCpuThreads(parts[1]);
                  if (parts.length === 1) setCpuThreads("");
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CPU base GHz</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="vd: 2.3"
                value={cpuBaseGhz}
                onChange={(e) => setCpuBaseGhz(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">RAM (GB)</Label>
              <Input
                type="number"
                min={0}
                placeholder="vd: 16"
                value={ramGb}
                onChange={(e) => setRamGb(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">RAM hãng</Label>
              <Input
                placeholder="vd: Kingston"
                value={ramBrand}
                onChange={(e) => setRamBrand(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">RAM speed (MHz)</Label>
              <Input
                type="number"
                min={0}
                placeholder="vd: 3200"
                value={ramSpeedMhz}
                onChange={(e) => setRamSpeedMhz(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">RAM type</Label>
              <Input
                placeholder="vd: DDR4"
                value={ramType}
                onChange={(e) => setRamType(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">RAM slots</Label>
              <Input
                type="number"
                min={0}
                placeholder="vd: 2"
                value={ramSlots}
                onChange={(e) => setRamSlots(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">SSD/HDD hãng</Label>
              <Input
                placeholder="vd: WD"
                value={storageBrand}
                onChange={(e) => setStorageBrand(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">SSD/HDD loại</Label>
              <Input
                placeholder="vd: NVMe SSD"
                value={storageType}
                onChange={(e) => setStorageType(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dung lượng storage (GB)</Label>
              <Input
                type="number"
                min={0}
                placeholder="vd: 512"
                value={storageGb}
                onChange={(e) => setStorageGb(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tên GPU</Label>
              <Input
                placeholder="vd: NVIDIA RTX 3050"
                value={gpuName}
                onChange={(e) => setGpuName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Hãng GPU</Label>
              <Input
                placeholder="vd: NVIDIA"
                value={gpuVendor}
                onChange={(e) => setGpuVendor(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">VRAM (GB)</Label>
              <Input
                type="number"
                min={0}
                placeholder="vd: 4"
                value={gpuVramGb}
                onChange={(e) => setGpuVramGb(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">TDP / power (W)</Label>
              <Input
                type="number"
                min={0}
                placeholder="vd: 75"
                value={gpuPowerWatts}
                onChange={(e) => setGpuPowerWatts(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pin design (mWh)</Label>
              <Input
                type="number"
                min={0}
                placeholder="vd: 57000"
                value={batteryDesignMwh}
                onChange={(e) => setBatteryDesignMwh(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pin full charge (mWh)</Label>
              <Input
                type="number"
                min={0}
                placeholder="vd: 52000"
                value={batteryFullMwh}
                onChange={(e) => setBatteryFullMwh(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kỹ thuật viên</Label>
              <Input
                placeholder="Tên KTV kiểm tra"
                value={techName}
                onChange={(e) => setTechName(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ghi chú (tuỳ chọn)</Label>
              <Textarea
                rows={2}
                placeholder="Tình trạng máy, lỗi đặc biệt..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          {submitError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={loading || !deviceId || !deviceName || scoreNum <= 0}
              className="gap-2"
            >
              {loading
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Đang lưu...</>
                : <><Upload className="h-4 w-4" /> Lưu lên bảng xếp hạng</>
              }
            </Button>
            <a
              href="/test-laptop"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <Trophy className="h-4 w-4" /> Xem ranking
            </a>
          </div>
        </Section>

      </div>{/* end flex col */}
    </div>
  );
}
