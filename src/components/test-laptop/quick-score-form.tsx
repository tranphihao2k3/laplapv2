"use client";

/**
 * QuickScoreForm — Form inline cho phép user nhập score FurMark + device name
 * rồi submit thẳng lên bảng xếp hạng. Dành cho user không muốn cài FurMark
 * hoặc chạy Mini Tool.
 *
 * Flow: device_id + device_name + gpu_score + gpu_name (optional) → POST
 * /api/v1/laptops/submit → toast success → router.refresh() để bảng xếp hạng
 * highlight row mới (nếu server trả về laptop_id).
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Loader2, Zap, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function calcGpuRank(score: number): string {
  if (score >= 8000) return "Excellent";
  if (score >= 6000) return "Good";
  if (score >= 4000) return "Fair";
  return "Poor";
}

const RANK_STYLE: Record<string, string> = {
  Excellent: "bg-violet-100 text-violet-700 border-violet-300",
  Good: "bg-blue-100 text-blue-700 border-blue-300",
  Fair: "bg-amber-100 text-amber-700 border-amber-300",
  Poor: "bg-red-100 text-red-700 border-red-300",
};

export function QuickScoreForm() {
  const router = useRouter();
  const [deviceName, setDeviceName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [score, setScore] = useState("");
  const [gpuName, setGpuName] = useState("");
  const [fpsAvg, setFpsAvg] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        device_id: deviceId.trim() || `quick-${Date.now()}`,
        device_name: deviceName.trim(),
        gpu_score: parseInt(score, 10),
        test_duration_seconds: 300,
        test_preset: "quick",
      };
      if (gpuName) payload.gpu_name = gpuName.trim();
      if (fpsAvg) payload.fps_avg = parseFloat(fpsAvg);
      const res = await fetch("/api/v1/laptops/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Lỗi server");
      return json.data as { laptop_id: string; gpu_rank: string | null };
    },
    onSuccess: (data) => {
      toast.success(
        `Đã lưu lên bảng xếp hạng! GPU rank: ${data.gpu_rank ?? "—"}`,
      );
      // Reset form
      setScore("");
      setFpsAvg("");
      setGpuName("");
      // Redirect sang ranking voi highlight de user thay dong moi
      if (data.laptop_id) {
        router.push(`/test-laptop?highlight=${data.laptop_id}`);
      } else {
        router.refresh();
      }
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Upload thất bại");
    },
  });

  const scoreNum = parseInt(score, 10) || 0;
  const rank = scoreNum > 0 ? calcGpuRank(scoreNum) : null;
  const canSubmit = deviceName.trim() && scoreNum > 0 && !submit.isPending;

  return (
    <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white">
          <Zap className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">
          Đã có điểm FurMark? Submit nhanh
        </h2>
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
          HOẠT ĐỘNG NGAY
        </span>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Không cần cài FurMark, không cần tải tool. Nhập điểm bạn đã chạy ở máy khác
        (hoặc dùng FurMark standalone) và đẩy lên bảng xếp hạng trong 10 giây.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) submit.mutate();
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Tên thiết bị *</Label>
          <Input
            placeholder="vd: ASUS TUF Gaming F15"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Điểm GPU (FurMark Score) *</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={20000}
              placeholder="vd: 5109"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              required
            />
            {rank && (
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold",
                  RANK_STYLE[rank],
                )}
              >
                {rank}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tên GPU (tùy chọn)</Label>
          <Input
            placeholder="vd: NVIDIA RTX 3050"
            value={gpuName}
            onChange={(e) => setGpuName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">FPS trung bình (tùy chọn)</Label>
          <Input
            type="number"
            step="0.1"
            min={0}
            placeholder="vd: 43.5"
            value={fpsAvg}
            onChange={(e) => setFpsAvg(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Device ID (tùy chọn)</Label>
          <Input
            placeholder="Mã định danh, để trống sẽ tự tạo"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          />
        </div>
        <div className="flex items-end sm:col-span-2">
          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full gap-2 bg-amber-500 hover:bg-amber-600 sm:w-auto"
          >
            {submit.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang upload...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Lên bảng xếp hạng
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">
        Muốn đầy đủ thông số (CPU, RAM, SSD, pin)?{" "}
        <Link href="/test-laptop/benchmark" className="font-medium text-violet-700 hover:underline">
          Dùng form benchmark 4 bước
        </Link>
        {" "}hoặc{" "}
        <Link href="/test-laptop/system-scan" className="font-medium text-violet-700 hover:underline">
          quét máy tự động
        </Link>
        .
      </p>
    </section>
  );
}
