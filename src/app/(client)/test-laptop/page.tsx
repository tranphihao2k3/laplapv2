/**
 * /test-laptop — command-center (Tổng quan).
 *
 * Sections:
 *   1. Hero            — 2 CTA + stats
 *   2. Quick Score     — form inline submit điểm FurMark (working, no install)
 *   3. Cách hoạt động  — 4 bước
 *   4. Bảng xếp hạng   — Top 10
 *   5. Tính năng khác  — 6 card grid
 *   6. CTA banner      — Mini Tool
 *   7. FAQ             — Collapsible
 *
 * Hỗ trợ `?highlight=<laptopId>` để highlight row mới trên bảng.
 */

import { Trophy, Cpu, Monitor, Keyboard, Volume2, Camera, Download, Flame, ScanLine, Sparkles } from "lucide-react";
import Link from "next/link";
import { HeroSection } from "@/components/test-laptop/hero-section";
import { QuickScoreForm } from "@/components/test-laptop/quick-score-form";
import { HowItWorks } from "@/components/test-laptop/how-it-works";
import { TopRankingsTable } from "@/components/test-laptop/top-rankings-table";
import { FeatureGrid } from "@/components/test-laptop/feature-grid";
import { MiniToolCtaBanner } from "@/components/test-laptop/mini-tool-cta-banner";
import { FaqSection } from "@/components/test-laptop/faq-section";
import { getDashboardStats } from "@/lib/test-laptop/stats";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ highlight?: string; rank?: string }>;

export default async function TestLaptopOverviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const highlightId = params.highlight ?? null;

  const stats = await getDashboardStats();

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="space-y-5 sm:space-y-6">
        {/* 1. Hero */}
        <HeroSection
          totalLaptops={stats.totalLaptops}
          uploadsLast24h={stats.uploadsLast24h}
        />

        {/* 2. Quick Score form — working ngay, không cần cài gì */}
        <QuickScoreForm />

        {/* 3. Cách hoạt động */}
        <HowItWorks />

        {/* 4. Bảng xếp hạng Top 10 */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 shrink-0 text-amber-500" />
              <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">
                Bảng xếp hạng GPU Benchmark
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Top 10 theo FurMark score
            </span>
          </div>
          <TopRankingsTable limit={10} showFullControls={false} highlightId={highlightId} />
        </section>

        {/* 5. Các công cụ kiểm tra (web, không cần cài đặt) */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">
              Kiểm tra chi tiết (web)
            </h2>
            <span className="text-xs text-muted-foreground">Chạy trực tiếp trên trình duyệt</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WEB_TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="group flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-violet-300 hover:bg-violet-50/40 hover:shadow-sm"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                      tool.bg,
                    )}
                  >
                    <Icon className={cn("h-4 w-4", tool.iconColor)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-zinc-900">{tool.title}</h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {tool.body}
                    </p>
                  </div>
                  <Download className="mt-2 h-3.5 w-3.5 shrink-0 text-zinc-300 transition-colors group-hover:text-violet-600" />
                </Link>
              );
            })}
          </div>
        </section>

        {/* 6. Tính năng nâng cao (cần tải tool) */}
        <section className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">
              Mini Tool — All-in-One (Windows)
            </h2>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
              TỐI ƯU NHẤT
            </span>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            1 file .exe duy nhất, double-click chạy. Tự quét phần cứng, tự cài FurMark (nếu thiếu),
            tự chạy benchmark 5 phút, tự ký HMAC và upload lên bảng xếp hạng. Trình duyệt tự mở kết quả.
          </p>
          <FeatureGrid />
        </section>

        {/* 7. CTA banner */}
        <MiniToolCtaBanner />

        {/* 8. FAQ */}
        <FaqSection />
      </div>
    </div>
  );
}

const WEB_TOOLS = [
  {
    href: "/test-laptop/system-scan",
    icon: ScanLine,
    title: "Quét hệ thống",
    body: "CPU, GPU, RAM, SSD (SMART), pin, màn hình — đầy đủ thông số qua trình duyệt.",
    bg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    href: "/test-laptop/benchmark",
    icon: Flame,
    title: "GPU Benchmark 5 phút",
    body: "FurMark 1080p/1440p + form nhập điểm thủ công. Lên bảng xếp hạng trong 1 click.",
    bg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  {
    href: "/test-laptop/display",
    icon: Monitor,
    title: "Test màn hình",
    body: "Dead-pixel, gradient, brightness zones — kiểm tra panel chi tiết.",
    bg: "bg-violet-100",
    iconColor: "text-violet-600",
  },
  {
    href: "/test-laptop/keyboard",
    icon: Keyboard,
    title: "Test bàn phím",
    body: "Đếm phím bấm/tổng phím, phát hiện phím chết hoặc kẹt.",
    bg: "bg-pink-100",
    iconColor: "text-pink-600",
  },
  {
    href: "/test-laptop/speakers",
    icon: Volume2,
    title: "Test loa",
    body: "Phát test tone L/R, kiểm tra kênh & âm lượng qua bài hát mẫu.",
    bg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  {
    href: "/test-laptop/camera-mic",
    icon: Camera,
    title: "Test Camera & Mic",
    body: "Preview webcam + ghi âm 5s, kiểm tra RMS level & channel.",
    bg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
];
