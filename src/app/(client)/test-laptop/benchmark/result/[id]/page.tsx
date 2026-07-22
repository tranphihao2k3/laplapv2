"use client";

import { useState, useEffect, use } from "react";
import {
  CheckCircle2, AlertCircle, Upload, RefreshCw, Trophy, Flame, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DURATION_SECONDS = 300;

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

type Payload = Record<string, unknown>;
type SubmitResult = { laptop_id: string; gpu_rank: string | null; percentile: number };

export default function BenchmarkResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [payload, setPayload]   = useState<Payload | null>(null);
  const [loadErr, setLoadErr]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  // Editable identity fields
  const [deviceId, setDeviceId]     = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [techName, setTechName]     = useState("");
  const [note, setNote]             = useState("");

  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState<string | null>(null);
  const [result, setResult]     = useState<SubmitResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch(`/api/v1/benchmarks/result/${id}`);
        const json = await res.json();
        if (cancelled) return;
        if (!json.ok) { setLoadErr(json.error?.message ?? "Không tải được kết quả"); return; }
        const p = (json.data.payload ?? {}) as Payload;
        setPayload(p);
        setDeviceId(String(p.device_id ?? ""));
        setDeviceName(String(p.device_name ?? ""));
        setTechName(String(p.tech_name ?? ""));
        setNote(String(p.note ?? ""));
      } catch {
        if (!cancelled) setLoadErr("Không tải được kết quả benchmark");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const num = (k: string) => {
    const v = payload?.[k];
    return v == null || v === "" ? null : Number(v);
  };
  const str = (k: string) => {
    const v = payload?.[k];
    return v == null ? "" : String(v);
  };

  const score = num("gpu_score") ?? 0;
  const rank  = score > 0 ? calcGpuRank(score) : null;

  async function handleSave() {
    if (!deviceId.trim() || !deviceName.trim()) {
      setSaveErr("Vui lòng nhập Device ID và Tên thiết bị.");
      return;
    }
    if (score <= 0) { setSaveErr("Điểm GPU phải lớn hơn 0."); return; }
    setSaving(true);
    setSaveErr(null);
    try {
      const body: Payload = {
        ...(payload ?? {}),
        device_id:   deviceId.trim(),
        device_name: deviceName.trim(),
        test_duration_seconds: num("test_duration_seconds") ?? DURATION_SECONDS,
      };
      if (techName.trim()) body.tech_name = techName.trim(); else delete body.tech_name;
      if (note.trim())     body.note      = note.trim();      else delete body.note;

      const res  = await fetch("/api/v1/laptops/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Lỗi server");
      setResult(json.data as SubmitResult);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setSaving(false);
    }
  }

  // ── Loading / error ──────────────────────────────────────
  if (loading) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center text-muted-foreground">
        <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin" /> Đang tải kết quả…
      </div>
    );
  }
  if (loadErr) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
          <p className="font-semibold text-red-700">{loadErr}</p>
          <a href="/test-laptop/benchmark" className="mt-4 inline-block text-sm underline">← Quay lại trang benchmark</a>
        </div>
      </div>
    );
  }

  // ── Saved success ────────────────────────────────────────
  if (result) {
    const top = 100 - result.percentile;
    return (
      <div className="container mx-auto max-w-xl px-4 py-8 sm:py-12">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center sm:p-8">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
          <h2 className="text-xl font-bold text-zinc-900">Đã lưu lên bảng xếp hạng!</h2>
          <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
            <div className="rounded-xl border bg-white p-3">
              <p className="text-xs text-muted-foreground">GPU Score</p>
              <p className="mt-1 text-xl font-bold text-zinc-900">{score.toLocaleString("vi-VN")}</p>
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
          <a href="/test-laptop" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            <Trophy className="h-4 w-4" /> Xem bảng xếp hạng
          </a>
        </div>
      </div>
    );
  }

  // ── Result preview + Save ────────────────────────────────
  const specRows: { label: string; value: string }[] = [];
  const cpu = str("cpu_name");
  if (cpu) specRows.push({ label: "CPU", value: `${cpu}${num("cpu_cores") ? ` • ${num("cpu_cores")} cores` : ""}${num("cpu_threads") ? ` / ${num("cpu_threads")} threads` : ""}${num("cpu_base_ghz") ? ` • ${num("cpu_base_ghz")} GHz` : ""}` });
  if (num("ram_gb")) specRows.push({ label: "RAM", value: `${num("ram_gb")} GB${str("ram_type") ? ` • ${str("ram_type")}` : ""}${num("ram_speed_mhz") ? ` • ${num("ram_speed_mhz")} MHz` : ""}${str("ram_brand") ? ` • ${str("ram_brand")}` : ""}${num("ram_slots") ? ` • ${num("ram_slots")} slots` : ""}` });
  if (num("storage_gb")) specRows.push({ label: "Ổ cứng", value: `${num("storage_gb")} GB${str("storage_type") ? ` • ${str("storage_type")}` : ""}${str("storage_brand") ? ` • ${str("storage_brand")}` : ""}` });
  const gpu = str("gpu_name");
  if (gpu) specRows.push({ label: "GPU", value: `${gpu}${str("gpu_vendor") ? ` • ${str("gpu_vendor")}` : ""}${num("gpu_vram_gb") ? ` • ${num("gpu_vram_gb")} GB` : ""}${num("gpu_power_watts") ? ` • ${num("gpu_power_watts")} W` : ""}` });
  if (num("battery_design_mwh") || num("battery_full_mwh")) specRows.push({ label: "Pin", value: `${num("battery_design_mwh") ? `${num("battery_design_mwh")} mWh design` : ""}${num("battery_full_mwh") ? `${num("battery_design_mwh") ? " • " : ""}${num("battery_full_mwh")} mWh full` : ""}` });
  if (str("os_name")) specRows.push({ label: "Hệ điều hành", value: `${str("os_name")}${str("os_version") ? ` (${str("os_version")})` : ""}` });
  if (num("test_width") || num("test_height") || str("test_preset")) {
    specRows.push({
      label: "FurMark",
      value: `${str("benchmark_tool") || "FurMark 2"}${num("test_width") && num("test_height") ? ` • ${num("test_width")}x${num("test_height")}` : ""}${str("test_preset") ? ` • preset ${str("test_preset")}` : ""}${num("test_duration_seconds") ? ` • ${num("test_duration_seconds")}s` : ""}`,
    });
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <div className="mb-6 flex items-center gap-2">
        <Flame className="h-5 w-5 shrink-0 text-orange-500" />
        <h2 className="text-lg font-bold text-zinc-900 sm:text-xl">Kết quả Benchmark</h2>
      </div>

      {/* Score */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-center sm:p-6">
        <p className="text-sm text-muted-foreground">Điểm GPU (FurMark)</p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-zinc-900 sm:text-5xl">{score.toLocaleString("vi-VN")}</p>
        {rank && (
          <span className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${RANK_STYLE[rank]}`}>
            {rank}
          </span>
        )}
        {num("fps_avg") != null && (
          <p className="mt-2 text-sm text-muted-foreground">FPS trung bình: {num("fps_avg")}</p>
        )}
      </div>

      {/* Specs */}
      {specRows.length > 0 && (
        <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-zinc-600" />
            <p className="text-sm font-semibold text-zinc-700">Cấu hình máy (tự động thu thập)</p>
          </div>
          <div className="grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
            {specRows.map((r) => (
              <div key={r.label}><span className="text-muted-foreground">{r.label}:</span> {r.value}</div>
            ))}
          </div>
        </div>
      )}

      {/* Save form */}
      <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <Upload className="h-4 w-4 text-green-600" />
          <p className="text-sm font-semibold text-zinc-700">Lưu lên bảng xếp hạng</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Device ID *</Label>
            <Input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="vd: ASUS-TUF-F15-001" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tên thiết bị *</Label>
            <Input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="vd: ASUS TUF Gaming F15" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Kỹ thuật viên</Label>
            <Input value={techName} onChange={(e) => setTechName(e.target.value)} placeholder="Tên KTV" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Ghi chú</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tình trạng máy…" />
          </div>
        </div>

        {saveErr && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{saveErr}</p>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <Button onClick={handleSave} disabled={saving || !deviceId || !deviceName || score <= 0} className="gap-2">
            {saving
              ? <><RefreshCw className="h-4 w-4 animate-spin" /> Đang lưu…</>
              : <><Upload className="h-4 w-4" /> Lưu lên bảng xếp hạng</>}
          </Button>
          <a href="/test-laptop" className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
            <Trophy className="h-4 w-4" /> Xem ranking
          </a>
        </div>
      </div>
    </div>
  );
}
