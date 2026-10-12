"use client";

import { ShoppingBag, ShieldCheck, Wrench, Star, Award, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Stat = {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  hint?: string;
};

export function OverviewStats({
  orderCount,
  totalSpent,
  warrantyCount,
  repairCount,
  reviewCount,
  loyaltyPoints,
  tier,
  completedCount,
}: {
  orderCount: number;
  totalSpent: number;
  warrantyCount: number;
  repairCount: number;
  reviewCount: number;
  loyaltyPoints: number;
  tier: string;
  completedCount: number;
}) {
  const stats: Stat[] = [
    {
      key: "orders",
      label: "Đơn hàng",
      value: String(orderCount),
      icon: ShoppingBag,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      hint: completedCount > 0 ? `${completedCount} hoàn tất gần đây` : undefined,
    },
    {
      key: "spent",
      label: "Tổng chi tiêu",
      value: formatCurrency(totalSpent),
      icon: Award,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      key: "warranties",
      label: "Bảo hành",
      value: String(warrantyCount),
      icon: ShieldCheck,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      key: "repairs",
      label: "Phiếu sửa đang mở",
      value: String(repairCount),
      icon: Wrench,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
    },
    {
      key: "reviews",
      label: "Đánh giá",
      value: String(reviewCount),
      icon: Star,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
    },
    {
      key: "loyalty",
      label: "Điểm thưởng",
      value: loyaltyPoints.toLocaleString("vi-VN"),
      icon: Award,
      iconBg: "bg-pink-50",
      iconColor: "text-pink-600",
      hint: `Hạng ${tier}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {stats.map((s) => (
        <StatCard key={s.key} stat={s} />
      ))}
    </div>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  const Icon = stat.icon;
  return (
    <Card className="rounded-2xl border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              stat.iconBg,
              stat.iconColor,
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{stat.label}</p>
            <p className="truncate text-lg font-bold leading-tight">{stat.value}</p>
            {stat.hint && (
              <p className="truncate text-[10px] text-muted-foreground">{stat.hint}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
