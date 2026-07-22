"use client";

import { useState } from "react";
import {
  CheckCircle2, Upload, Cpu, MemoryStick, MonitorDot,
  HardDrive, Battery, Zap, StickyNote, User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ── Types ────────────────────────────────────────────────────────────

type SubmitPayload = {
  device_id: string;
  device_name: string;
  cpu_name?: string;
  cpu_cores?: number;
  cpu_threads?: number;
  cpu_base_ghz?: number;
  ram_gb?: number;
  ram_brand?: string;
  ram_speed_mhz?: number;
  ram_type?: string;
  ram_slots?: number;
  gpu_name?: string;
  gpu_vendor?: string;
  gpu_vram_gb?: number;
  gpu_power_watts?: number;
  mainboard?: string;
  storage_brand?: string;
  storage_type?: string;
  storage_gb?: number;
  battery_design_mwh?: number;
  battery_full_mwh?: number;
  battery_health?: number;
  battery_cycles?: number;
  os_name?: string;
  os_version?: string;
  gpu_score?: number;
  fps_avg?: number;
  fps_min?: number;
  fps_max?: number;
  test_duration_seconds?: number;
  note?: string;
  condition?: "new" | "good" | "fair" | "poor";
  tech_name?: string;
};

type SubmitResult = {
  laptop_id: string;
  benchmark_id: string | null;
  gpu_rank: string | null;
  percentile: number;
  message: string;
};

// ── GPU Rank badge ────────────────────────────────────────────────────

const RANK_STYLE: Record<string, string> = {
  Excellent: "bg-violet-100 text-violet-700 border-violet-200",
  Good:      "bg-blue-100 text-blue-700 border-blue-200",
  Fair:      "bg-amber-100 text-amber-700 border-amber-200",
  Poor:      "bg-red-100 text-red-700 border-red-200",
};

function calcGpuRank(score: number) {
  if (score >= 8000) return "Excellent";
  if (score >= 6000) return "Good";
  if (score >= 4000) return "Fair";
  return "Poor";
}

// ── Section wrapper ───────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100">
          <Icon className="h-3.5 w-3.5 text-zinc-600" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function SubmitPage() {
  const [form, setForm] = useState<Partial<SubmitPayload>>({
    condition: "good",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof SubmitPayload, value: string | number | undefined) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function numVal(v: string) {
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }
  function intVal(v: string) {
    const n = parseInt(v);
    return isNaN(n) ? undefined : n;
  }

  const gpuRankPreview = form.gpu_score && form.gpu_score > 0
    ? calcGpuRank(form.gpu_score)
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.device_id || !form.device_name) {
      setError("Device ID và Tên thiết bị là bắt buộc");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/laptops/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Lỗi server");
      setResult(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  // ── Success state ──
  if (result) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center sm:p-8">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
          <h2 className="text-xl font-bold text-zinc-900">Lưu thành công!</h2>
          <p className="mt-1 text-sm text-muted-foreground">Thông tin đã được ghi lên server</p>

          <div className="mt-6 grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
            {result.gpu_rank && (
              <div className="rounded-xl border bg-white p-3">
                <p className="text-xs text-muted-foreground">Xếp loại GPU</p>
                <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${RANK_STYLE[result.gpu_rank] ?? ""}`}>
                  {result.gpu_rank}
                </span>
              </div>
            )}
            {result.percentile > 0 && (
              <div className="rounded-xl border bg-white p-3">
                <p className="text-xs text-muted-foreground">Percentile</p>
                <p className="mt-1 text-lg font-bold text-zinc-900">Top {100 - result.percentile}%</p>
              </div>
            )}
            <div className="rounded-xl border bg-white p-3">
              <p className="text-xs text-muted-foreground">Laptop ID</p>
              <p className="mt-1 truncate text-xs font-mono text-zinc-500">{result.laptop_id.slice(0, 16)}…</p>
            </div>
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => { setResult(null); setForm({ condition: "good" }); }}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Nhập máy khác
            </button>
            <a
              href="/test-laptop"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Xem bảng xếp hạng
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Upload className="h-5 w-5 shrink-0 text-zinc-700" />
          <h2 className="text-lg font-bold text-zinc-900 sm:text-xl">Lưu kết quả lên server</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Điền thông tin sau khi quét &amp; benchmark xong. Dữ liệu sẽ vào bảng xếp hạng.
        </p>
      </div>

      {/* Workflow steps */}
      <div className="mb-6 flex items-center gap-0 overflow-x-auto">
        {["Quét hệ thống", "Test phần cứng", "Benchmark GPU", "Lưu kết quả ✓"].map((s, i, arr) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${
              i === 3 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"
            }`}>
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">{i + 1}</span>
              {s}
            </div>
            {i < arr.length - 1 && <div className="mx-1 h-px w-4 bg-zinc-200 shrink-0" />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Device identity */}
        <Section icon={MonitorDot} title="Thiết bị">
          <Field label="Device ID *">
            <Input
              placeholder="Mã định danh máy (MAC / UUID)"
              value={form.device_id ?? ""}
              onChange={(e) => set("device_id", e.target.value)}
              required
            />
          </Field>
          <Field label="Tên thiết bị *">
            <Input
              placeholder="vd: ASUS TUF Gaming F15"
              value={form.device_name ?? ""}
              onChange={(e) => set("device_name", e.target.value)}
              required
            />
          </Field>
        </Section>

        {/* CPU */}
        <Section icon={Cpu} title="CPU">
          <Field label="Tên CPU">
            <Input placeholder="vd: Intel Core i7-12700H"
              value={form.cpu_name ?? ""} onChange={(e) => set("cpu_name", e.target.value)} />
          </Field>
          <Field label="Số nhân / Luồng">
            <div className="flex gap-2">
              <Input type="number" min={0} placeholder="Nhân"
                value={form.cpu_cores ?? ""} onChange={(e) => set("cpu_cores", intVal(e.target.value))} />
              <Input type="number" min={0} placeholder="Luồng"
                value={form.cpu_threads ?? ""} onChange={(e) => set("cpu_threads", intVal(e.target.value))} />
            </div>
          </Field>
          <Field label="Xung nhịp base (GHz)">
            <Input type="number" step="0.1" min={0} placeholder="vd: 2.3"
              value={form.cpu_base_ghz ?? ""} onChange={(e) => set("cpu_base_ghz", numVal(e.target.value))} />
          </Field>
        </Section>

        {/* RAM */}
        <Section icon={MemoryStick} title="RAM">
          <Field label="Dung lượng (GB)">
            <Input type="number" min={0} placeholder="vd: 16"
              value={form.ram_gb ?? ""} onChange={(e) => set("ram_gb", intVal(e.target.value))} />
          </Field>
          <Field label="Hãng RAM">
            <Input placeholder="vd: Samsung, SK Hynix"
              value={form.ram_brand ?? ""} onChange={(e) => set("ram_brand", e.target.value)} />
          </Field>
          <Field label="Tốc độ RAM (MHz)">
            <Input type="number" min={0} placeholder="vd: 3200"
              value={form.ram_speed_mhz ?? ""} onChange={(e) => set("ram_speed_mhz", intVal(e.target.value))} />
          </Field>
          <Field label="Loại RAM">
            <Select value={form.ram_type ?? ""} onValueChange={(v) => set("ram_type", v)}>
              <SelectTrigger><SelectValue placeholder="Chọn loại" /></SelectTrigger>
              <SelectContent>
                {["DDR3", "DDR4", "DDR5", "LPDDR4", "LPDDR4X", "LPDDR5"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Số slot RAM">
            <Input type="number" min={0} placeholder="vd: 2"
              value={form.ram_slots ?? ""} onChange={(e) => set("ram_slots", intVal(e.target.value))} />
          </Field>
        </Section>

        {/* GPU */}
        <Section icon={Zap} title="GPU">
          <Field label="Tên GPU">
            <Input placeholder="vd: NVIDIA GeForce RTX 3050"
              value={form.gpu_name ?? ""} onChange={(e) => set("gpu_name", e.target.value)} />
          </Field>
          <Field label="Hãng GPU">
            <Input placeholder="vd: NVIDIA, AMD, Intel"
              value={form.gpu_vendor ?? ""} onChange={(e) => set("gpu_vendor", e.target.value)} />
          </Field>
          <Field label="VRAM (GB)">
            <Input type="number" min={0} placeholder="vd: 4"
              value={form.gpu_vram_gb ?? ""} onChange={(e) => set("gpu_vram_gb", intVal(e.target.value))} />
          </Field>
          <Field label="Công suất tối đa GPU (W)">
            <Input type="number" min={0} placeholder="vd: 75"
              value={form.gpu_power_watts ?? ""} onChange={(e) => set("gpu_power_watts", intVal(e.target.value))} />
          </Field>
        </Section>

        {/* Bo mạch + SSD */}
        <Section icon={HardDrive} title="Bo mạch & Ổ đĩa">
          <Field label="Bo mạch chủ">
            <Input placeholder="vd: ASUS B560M"
              value={form.mainboard ?? ""} onChange={(e) => set("mainboard", e.target.value)} />
          </Field>
          <Field label="Hãng ổ đĩa">
            <Input placeholder="vd: Samsung, Western Digital"
              value={form.storage_brand ?? ""} onChange={(e) => set("storage_brand", e.target.value)} />
          </Field>
          <Field label="Loại ổ đĩa">
            <Select value={form.storage_type ?? ""} onValueChange={(v) => set("storage_type", v)}>
              <SelectTrigger><SelectValue placeholder="Chọn loại" /></SelectTrigger>
              <SelectContent>
                {["NVMe SSD", "SATA SSD", "HDD", "eMMC"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Dung lượng ổ đĩa (GB)">
            <Input type="number" min={0} placeholder="vd: 512"
              value={form.storage_gb ?? ""} onChange={(e) => set("storage_gb", intVal(e.target.value))} />
          </Field>
        </Section>

        {/* Pin */}
        <Section icon={Battery} title="Pin">
          <Field label="Dung lượng thiết kế (mWh)">
            <Input type="number" min={0} placeholder="vd: 56000"
              value={form.battery_design_mwh ?? ""} onChange={(e) => set("battery_design_mwh", intVal(e.target.value))} />
          </Field>
          <Field label="Dung lượng sạc tối đa (mWh)">
            <Input type="number" min={0} placeholder="vd: 52000"
              value={form.battery_full_mwh ?? ""} onChange={(e) => set("battery_full_mwh", intVal(e.target.value))} />
          </Field>
          <Field label="Sức khoẻ pin (%)">
            <Input type="number" min={0} max={100} placeholder="vd: 85"
              value={form.battery_health ?? ""} onChange={(e) => set("battery_health", numVal(e.target.value))} />
          </Field>
          <Field label="Số chu kỳ sạc">
            <Input type="number" min={0} placeholder="vd: 120"
              value={form.battery_cycles ?? ""} onChange={(e) => set("battery_cycles", intVal(e.target.value))} />
          </Field>
        </Section>

        {/* Benchmark */}
        <Section icon={Zap} title="Kết quả Benchmark GPU">
          <Field label="Điểm GPU (Unigine)">
            <div className="flex items-center gap-2">
              <Input type="number" min={0} max={10000} placeholder="vd: 5109"
                value={form.gpu_score ?? ""} onChange={(e) => set("gpu_score", intVal(e.target.value))} />
              {gpuRankPreview && (
                <Badge className={`shrink-0 border text-xs ${RANK_STYLE[gpuRankPreview]}`}>
                  {gpuRankPreview}
                </Badge>
              )}
            </div>
          </Field>
          <Field label="FPS trung bình">
            <Input type="number" min={0} placeholder="vd: 43.5"
              value={form.fps_avg ?? ""} onChange={(e) => set("fps_avg", numVal(e.target.value))} />
          </Field>
          <Field label="FPS min / max">
            <div className="flex gap-2">
              <Input type="number" min={0} placeholder="Min"
                value={form.fps_min ?? ""} onChange={(e) => set("fps_min", numVal(e.target.value))} />
              <Input type="number" min={0} placeholder="Max"
                value={form.fps_max ?? ""} onChange={(e) => set("fps_max", numVal(e.target.value))} />
            </div>
          </Field>
          <Field label="Thời gian test (giây)">
            <Input type="number" min={0} placeholder="vd: 60"
              value={form.test_duration_seconds ?? ""} onChange={(e) => set("test_duration_seconds", intVal(e.target.value))} />
          </Field>
        </Section>

        {/* Notes */}
        <Section icon={StickyNote} title="Ghi chú & Tình trạng">
          <Field label="Tình trạng máy">
            <Select value={form.condition ?? "good"} onValueChange={(v) => set("condition", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Mới / Như mới</SelectItem>
                <SelectItem value="good">Còn tốt</SelectItem>
                <SelectItem value="fair">Bình thường</SelectItem>
                <SelectItem value="poor">Cần sửa chữa</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Kỹ thuật viên">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input placeholder="Tên KTV kiểm tra"
                value={form.tech_name ?? ""} onChange={(e) => set("tech_name", e.target.value)} />
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Ghi chú lỗi / tình trạng chi tiết">
              <Textarea
                rows={3}
                placeholder="vd: Màn hình bị dead pixel góc trên bên phải, bàn phím kẹt phím Q, pin phồng..."
                value={form.note ?? ""}
                onChange={(e) => set("note", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setForm({ condition: "good" })}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Xóa form
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {loading ? "Đang lưu..." : "Lưu lên server"}
          </button>
        </div>
      </form>
    </div>
  );
}
