/**
 * MiniToolCtaBanner — banner gradient violet kêu gọi tải Mini Tool.
 * Dùng ở section 5 của landing page. Copy ngắn, CTA chính là nút tải .exe.
 */
import Link from "next/link";
import { Download, ArrowRight, Plug } from "lucide-react";

export function MiniToolCtaBanner() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-600 to-violet-700 p-6 text-white sm:p-8">
      {/* Subtle pattern overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl"
      />

      <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Plug className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold sm:text-xl">Bạn có máy muốn test?</h2>
            <p className="mt-1 text-sm text-violet-100">
              Mini Tool gộp scan + benchmark + upload vào 1 file .exe. Double-click,
              chờ 5 phút, tự lên bảng xếp hạng.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <a
            href="/scripts/laplap-mini-tool.zip"
            download="laplap-mini-tool.zip"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50"
            title="1 file ZIP gồm .bat + .ps1 + README. Giai nen, double-click .bat."
          >
            <Download className="h-4 w-4" />
            Tải ZIP
          </a>
          <Link
            href="/test-laptop/benchmark"
            className="inline-flex items-center gap-1 rounded-lg border border-white/30 bg-white/10 px-3 py-2.5 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            Dùng web thay thế
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
