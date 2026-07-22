import { cn } from "@/lib/utils";

/**
 * GhostLoader — con ma pixel nhấp nháy (dựa theo mẫu Uiverse by BlackisPlay).
 * Dùng làm loading chính cho cả client và admin.
 *
 * - `fullscreen`: phủ toàn màn hình (dùng trong loading.tsx của route).
 * - `label`: dòng chữ hiển thị dưới con ma.
 */
export function GhostLoader({
  fullscreen = false,
  label = "Đang tải…",
  className,
}: {
  fullscreen?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-10",
        fullscreen ? "min-h-[60vh] w-full py-20" : "py-10",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="ghost-loader">
        <div className="ghost-body">
          <div className="g-pupil" />
          <div className="g-pupil1" />
          <div className="g-eye" />
          <div className="g-eye1" />
          <div className="g-top0" />
          <div className="g-top1" />
          <div className="g-top2" />
          <div className="g-top3" />
          <div className="g-top4" />
          <div className="g-st0" />
          <div className="g-st1" />
          <div className="g-st2" />
          <div className="g-st3" />
          <div className="g-st4" />
          <div className="g-st5" />
          <div className="g-an1" />
          <div className="g-an2" />
          <div className="g-an3" />
          <div className="g-an4" />
          <div className="g-an5" />
          <div className="g-an6" />
          <div className="g-an7" />
          <div className="g-an8" />
          <div className="g-an9" />
          <div className="g-an10" />
          <div className="g-an11" />
          <div className="g-an12" />
          <div className="g-an13" />
          <div className="g-an14" />
          <div className="g-an15" />
          <div className="g-an16" />
          <div className="g-an17" />
          <div className="g-an18" />
        </div>
        <div className="ghost-shadow" />
      </div>

      {label && (
        <p className="animate-pulse text-sm font-medium text-muted-foreground">{label}</p>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}
