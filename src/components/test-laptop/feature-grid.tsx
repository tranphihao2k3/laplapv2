/**
 * FeatureGrid — 6 card link tới 6 sub-tab test laptop.
 * Mobile 1 cột, tablet 2 cột, desktop 3 cột.
 */
import Link from "next/link";
import {
  Cpu,
  Camera,
  Volume2,
  Monitor,
  Keyboard,
  Download,
  ArrowRight,
} from "lucide-react";

const FEATURES = [
  {
    href: "/test-laptop/system-scan",
    icon: Cpu,
    title: "Quét hệ thống",
    body: "CPU, GPU, RAM, SSD (SMART), pin, màn hình — đầy đủ thông số qua WMI.",
  },
  {
    href: "/test-laptop/benchmark",
    icon: Download, // reuses download icon to represent 'start test'
    title: "GPU Benchmark",
    body: "FurMark 2 preset 1080p/1440p, tự động tải FurMark nếu chưa có.",
  },
  {
    href: "/test-laptop/display",
    icon: Monitor,
    title: "Màn hình",
    body: "Dead-pixel, gradient, brightness zones — kiểm tra panel chi tiết.",
  },
  {
    href: "/test-laptop/keyboard",
    icon: Keyboard,
    title: "Bàn phím",
    body: "Đếm phím bấm/tổng phím, phát hiện phím chết hoặc kẹt.",
  },
  {
    href: "/test-laptop/speakers",
    icon: Volume2,
    title: "Loa",
    body: "Phát test tone L/R, kiểm tra kênh & âm lượng qua bài hát mẫu.",
  },
  {
    href: "/test-laptop/camera-mic",
    icon: Camera,
    title: "Camera & Mic",
    body: "Preview webcam + ghi âm 5s, kiểm tra RMS level & channel.",
  },
];

export function FeatureGrid() {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">Các tính năng khác</h2>
        <span className="text-xs text-muted-foreground">Test trực tiếp trên web</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <Link
              key={f.href}
              href={f.href}
              className="group flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-violet-300 hover:bg-violet-50/40 hover:shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition-colors group-hover:bg-violet-100 group-hover:text-violet-700">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-zinc-900">{f.title}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
              <ArrowRight className="mt-2 h-3.5 w-3.5 shrink-0 text-zinc-300 transition-colors group-hover:text-violet-600" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
