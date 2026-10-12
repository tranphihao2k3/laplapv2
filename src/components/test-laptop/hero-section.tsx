/**
 * HeroSection — banner đầu trang /test-laptop.
 * 2 CTA: Tải Mini Tool (1 file .exe) + Bắt đầu quét nhanh (web).
 * Stats inline: Tổng laptop + Test trong 24h.
 */
import Link from "next/link";
import { Download, Play, Cpu, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function HeroSection({
  totalLaptops,
  uploadsLast24h,
}: {
  totalLaptops: number;
  uploadsLast24h: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 via-white to-violet-50/40 px-5 py-10 sm:px-8 sm:py-12">
      {/* Decorative gradient blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-200/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-amber-200/20 blur-3xl"
      />

      <div className="relative">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-violet-700 backdrop-blur">
          <Zap className="h-3 w-3" />
          Laptop Test Suite
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl md:text-4xl">
          Kiểm tra & Benchmark laptop
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Quét phần cứng, chạy FurMark 5 phút, đẩy thẳng điểm lên bảng xếp hạng —
          tất cả trong 1 file .exe portable. Không cần cài đặt.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href="/scripts/laplap-mini-tool.zip"
            download="laplap-mini-tool.zip"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700"
            title="Tải 1 file ZIP gồm .bat + .ps1 + README. Giai nen, double-click .bat de chay."
          >
            <Download className="h-4 w-4" />
            Tải Mini Tool (1 file ZIP)
          </a>
          <Link
            href="/test-laptop/benchmark"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            <Play className="h-4 w-4" />
            Bắt đầu quét nhanh (web)
          </Link>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2 text-zinc-600">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100">
              <Cpu className="h-3.5 w-3.5 text-zinc-500" />
            </span>
            <span>
              <span className="font-semibold text-zinc-900 tabular-nums">
                {totalLaptops.toLocaleString("vi-VN")}
              </span>{" "}
              laptop đã test
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-600">
            <span
              className={cn(
                "flex h-2 w-2 rounded-full",
                uploadsLast24h > 0 ? "bg-emerald-500" : "bg-zinc-300",
              )}
            />
            <span>
              <span className="font-semibold text-zinc-900 tabular-nums">
                {uploadsLast24h.toLocaleString("vi-VN")}
              </span>{" "}
              lượt test trong 24h
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
