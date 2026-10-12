"use client";

import { Award, Crown, Sparkles, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const TIERS = [
  { key: "bronze", label: "Đồng", min: 0, gradient: "from-amber-700 via-amber-600 to-yellow-700", text: "text-amber-700" },
  { key: "silver", label: "Bạc", min: 1000, gradient: "from-slate-400 via-slate-300 to-slate-500", text: "text-slate-700" },
  { key: "gold", label: "Vàng", min: 5000, gradient: "from-yellow-500 via-amber-400 to-orange-500", text: "text-yellow-700" },
  { key: "platinum", label: "Bạch kim", min: 15000, gradient: "from-indigo-500 via-violet-500 to-fuchsia-500", text: "text-violet-700" },
];

const TIER_BENEFITS: Record<string, string[]> = {
  bronze: ["Tích 1 điểm / 10.000đ chi tiêu", "Voucher sinh nhật 100K"],
  silver: ["Tích 1.5 điểm / 10.000đ", "Voucher sinh nhật 200K", "Hỗ trợ ưu tiên"],
  gold: ["Tích 2 điểm / 10.000đ", "Voucher sinh nhật 500K", "Free ship 1 lần/tháng", "Đặt lịch sửa ưu tiên"],
  platinum: ["Tích 3 điểm / 10.000đ", "Voucher sinh nhật 1 triệu", "Free ship không giới hạn", "CSKH riêng 24/7"],
};

const TYPE_MAP: Record<string, { label: string; color: string; sign: 1 | -1 }> = {
  earn: { label: "Tích điểm", color: "text-emerald-600", sign: 1 },
  redeem: { label: "Đổi điểm", color: "text-rose-600", sign: -1 },
  bonus: { label: "Thưởng", color: "text-emerald-600", sign: 1 },
  expire: { label: "Hết hạn", color: "text-zinc-500", sign: -1 },
  adjust: { label: "Điều chỉnh", color: "text-blue-600", sign: 1 },
};

export function LoyaltyView({
  points,
  tier,
  transactions,
}: {
  points: number;
  tier: string;
  transactions: Array<{
    id: string;
    points: number;
    type: string | null;
    order_id: string | null;
    created_at: string;
    order: { id: string; order_number: string } | null;
  }>;
}) {
  const current = TIERS.find((t) => t.key === tier) ?? TIERS[0];
  const currentIdx = TIERS.indexOf(current);
  const next = TIERS[currentIdx + 1];
  const progressPct = next
    ? Math.min(100, Math.max(0, ((points - current.min) / (next.min - current.min)) * 100))
    : 100;

  return (
    <div className="space-y-5">
      {/* Tier card */}
      <Card className="overflow-hidden rounded-2xl border-border/60">
        <div
          className={cn("h-24 bg-gradient-to-br", current.gradient)}
          aria-hidden
        >
          <div className="flex h-full items-end justify-between p-4">
            <div className="rounded-full bg-black/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              Hạng hiện tại
            </div>
            {currentIdx >= 2 ? (
              <Crown className="h-6 w-6 text-white/80" />
            ) : (
              <Award className="h-6 w-6 text-white/80" />
            )}
          </div>
        </div>
        <CardContent className="-mt-8 p-5">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className={cn("text-2xl font-bold", current.text)}>
                  Hạng {current.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {next
                    ? `Còn ${(next.min - points).toLocaleString("vi-VN")} điểm để lên ${next.label}`
                    : "Bạn đã đạt hạng cao nhất"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold tabular-nums leading-none">
                  {points.toLocaleString("vi-VN")}
                </p>
                <p className="text-[10px] text-muted-foreground">điểm hiện có</p>
              </div>
            </div>
            {next && (
              <div className="mt-3">
                <Progress value={progressPct} className="h-2" />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>{current.label} · {current.min.toLocaleString("vi-VN")}</span>
                  <span>{next.label} · {next.min.toLocaleString("vi-VN")}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tier ladder */}
      <Card className="rounded-2xl border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Các hạng thành viên</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {TIERS.map((t, i) => {
              const isCurrent = t.key === tier;
              const reached = points >= t.min;
              return (
                <div
                  key={t.key}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3",
                    isCurrent
                      ? "border-primary bg-primary/5"
                      : reached
                        ? "border-border/60"
                        : "border-border/40 opacity-60",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white",
                      t.gradient,
                    )}
                  >
                    {i >= 2 ? (
                      <Crown className="h-5 w-5" />
                    ) : (
                      <Award className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Từ {t.min.toLocaleString("vi-VN")} điểm
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                      Hiện tại
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card className="rounded-2xl border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quyền lợi hạng {current.label}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5">
            {(TIER_BENEFITS[current.key] ?? []).map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="rounded-2xl border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lịch sử điểm</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
              Chưa có giao dịch điểm nào.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {transactions.map((t) => {
                const info = TYPE_MAP[t.type ?? ""] ?? {
                  label: t.type ?? "—",
                  color: "text-muted-foreground",
                  sign: 1 as 1 | -1,
                };
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        info.sign === 1 ? "bg-emerald-50" : "bg-rose-50",
                      )}
                    >
                      {info.sign === 1 ? (
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{info.label}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(t.created_at).toLocaleString("vi-VN")}
                        {t.order && (
                          <span className="font-mono">· #{t.order.order_number}</span>
                        )}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "font-semibold tabular-nums",
                        info.sign === 1 ? "text-emerald-600" : "text-rose-600",
                      )}
                    >
                      {info.sign === 1 ? "+" : ""}
                      {t.points.toLocaleString("vi-VN")}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
