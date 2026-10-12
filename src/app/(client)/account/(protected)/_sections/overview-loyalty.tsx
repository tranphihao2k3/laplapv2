import Link from "next/link";
import { Award, Crown, Sparkles, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Tạm thời hard-code ngưỡng hạng; nên đọc từ settings DB khi triển khai thật.
const TIERS: Array<{ key: string; label: string; min: number; gradient: string; ring: string; bg: string; text: string }> = [
  { key: "bronze", label: "Đồng", min: 0, gradient: "from-amber-700 via-amber-600 to-yellow-700", ring: "ring-amber-300/60", bg: "bg-amber-50", text: "text-amber-700" },
  { key: "silver", label: "Bạc", min: 1000, gradient: "from-slate-400 via-slate-300 to-slate-500", ring: "ring-slate-300/60", bg: "bg-slate-100", text: "text-slate-700" },
  { key: "gold", label: "Vàng", min: 5000, gradient: "from-yellow-500 via-amber-400 to-orange-500", ring: "ring-amber-300/60", bg: "bg-yellow-50", text: "text-yellow-700" },
  { key: "platinum", label: "Bạch kim", min: 15000, gradient: "from-indigo-500 via-violet-500 to-fuchsia-500", ring: "ring-violet-300/60", bg: "bg-violet-50", text: "text-violet-700" },
];

export function OverviewLoyalty({
  points,
  tier,
}: {
  points: number;
  tier: string;
}) {
  const current = TIERS.find((t) => t.key === tier) ?? TIERS[0];
  const currentIdx = TIERS.indexOf(current);
  const next = TIERS[currentIdx + 1];
  const nextMin = next?.min ?? current.min;
  const progressPct = next
    ? Math.min(100, Math.max(0, ((points - current.min) / (nextMin - current.min)) * 100))
    : 100;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
            current.gradient,
          )}
        >
          {currentIdx >= 2 ? (
            <Crown className="h-5 w-5" />
          ) : (
            <Award className="h-5 w-5" />
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Hạng thành viên</p>
          <p className={cn("text-lg font-bold leading-tight", current.text)}>
            {current.label}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold tabular-nums leading-none">
            {points.toLocaleString("vi-VN")}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">điểm</p>
        </div>
      </div>

      {next ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Còn{" "}
              <strong className="text-foreground">
                {(nextMin - points).toLocaleString("vi-VN")}
              </strong>{" "}
              điểm để lên hạng{" "}
              <span className={cn("font-semibold", current.text)}>{next.label}</span>
            </span>
            <span className="text-muted-foreground tabular-nums">
              {Math.round(progressPct)}%
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      ) : (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <Sparkles className="mr-1 inline h-3 w-3" />
          Bạn đã đạt hạng cao nhất! Tận hưởng đặc quyền bạch kim.
        </p>
      )}

      <Button asChild variant="ghost" size="sm" className="mt-3 h-7 w-full text-xs">
        <Link href="/account/loyalty">
          <TrendingUp className="mr-1 h-3 w-3" /> Xem chi tiết điểm thưởng
        </Link>
      </Button>
    </div>
  );
}
