"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { httpGet } from "@/lib/api/http";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Line, Legend,
  ComposedChart, ScatterChart, Scatter, ZAxis,
} from "recharts";
import {
  TrendingUpIcon, BanknoteIcon, ShoppingCartIcon,
  UsersIcon, PackageIcon, AlertTriangleIcon, TruckIcon, AwardIcon,
  WrenchIcon, DollarSignIcon, PercentIcon, ArrowUpRightIcon, ArrowDownRightIcon,
  ActivityIcon, ZapIcon, TargetIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

// ==================== Types ====================
type DailyRevenue = { date: string; revenue: number; orders: number; cancelled: number };
type TopSelling = { id: string; qty: number; revenue: number; name: string };
type TopStaff = { id: string; orders: number; revenue: number; name: string };
type TopCustomer = { id: string; name: string; tier: string; orders: number; total: number };
type MonthRepair = { key: string; label: string; repairCount: number; avgHours: number };

type DashboardData = {
  kpi: {
    revenueTotal: number; revenueToday: number; revenueThisWeek: number; revenueThisMonth: number;
    totalOrders: number; ordersToday: number; ordersThisWeek: number; ordersThisMonth: number;
    completedOrders: number; cancelledOrders: number; aov: number; cancellationRate: number;
    totalCustomers: number; newCustomersToday: number; newCustomersThisWeek: number; newCustomersThisMonth: number;
  };
  revenue: {
    dailyRevenue: DailyRevenue[];
    last14Daily: DailyRevenue[];
    last30Daily: DailyRevenue[];
    orderStatusDist: Record<string, number>;
    paymentStatusDist: Record<string, number>;
    cancellationRate: number; aov: number;
  };
  payment: {
    paymentMethodDist: Record<string, { count: number; amount: number }>;
    channelDist: Record<string, number>;
    posRevenue: number; onlineRevenue: number;
    methodDaily: { date: string; cash: number; transfer: number; card: number; ewallet: number }[];
    channelDaily: { date: string; pos: number; online: number }[];
  };
  product: {
    topSelling: TopSelling[];
    lowStockCount: number;
    totalProducts: number; totalVariants: number;
    productStatus: Record<string, number>;
  };
  inventory: {
    importToday: number; exportToday: number; transferToday: number;
    pendingPOCount: number; monthlyImportValue: number; monthlyPurchaseValue: number;
    totalWarehouses: number; totalSuppliers: number; totalStockLevels: number; totalSerials: number;
    inventoryFlow: { date: string; inbound: number; outbound: number; transfer: number }[];
  };
  customer: {
    tierDist: Record<string, number>;
    totalCustomers: number; returningCustomers: number;
    totalPoints: number; earnedPoints: number; redeemedPoints: number;
    topCustomers: TopCustomer[];
  };
  afterSale: {
    openRepairs: number; repairStatusDist: Record<string, number>; totalRepairTickets: number;
    expiringWarranties: number; warrantyStatusDist: Record<string, number>; totalWarranties: number;
    pendingTradeIns: number; tradeInStatusDist: Record<string, number>; totalTradeIns: number;
    repairMonths: MonthRepair[];
  };
  pos: {
    openSessions: number; totalSessions: number;
    topStaff: TopStaff[]; diffCashSessions: number; totalDiffCash: number;
  };
  advanced: {
    last7Revenue: number[]; last7Orders: number[]; last7Customers: number[]; last7Aov: number[];
    heatmap30: { date: string; revenue: number; orders: number }[];
    weeklyCompare: {
      thisWeek: { revenue: number; orders: number };
      prevWeek: { revenue: number; orders: number };
    };
    funnel: { placed: number; confirmed: number; paid: number; fulfilled: number; completed: number };
    statusByDay: { date: string; pending: number; confirmed: number; processing: number; completed: number; cancelled: number }[];
  };
};

// ==================== Color tokens ====================
const COLORS = {
  primary: "hsl(var(--chart-1))",
  secondary: "hsl(var(--chart-2))",
  tertiary: "hsl(var(--chart-3))",
  quaternary: "hsl(var(--chart-4))",
  danger: "hsl(var(--chart-5))",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  violet: "#8b5cf6",
  sky: "#0ea5e9",
};
const PIE_COLORS = [COLORS.primary, COLORS.secondary, COLORS.tertiary, COLORS.quaternary, COLORS.danger, COLORS.amber, COLORS.violet, COLORS.rose];
const STATUS_COLORS: Record<string, string> = {
  pending: COLORS.amber,
  confirmed: COLORS.sky,
  processing: COLORS.violet,
  completed: COLORS.emerald,
  fulfilled: COLORS.emerald,
  cancelled: COLORS.rose,
  paid: COLORS.emerald,
  unpaid: COLORS.amber,
  partial: COLORS.amber,
  refunded: COLORS.rose,
};

const formatMoney = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
const formatMoneyShort = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + " tỷ";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(0) + "tr";
  if (abs >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return String(Math.round(n));
};
const formatNum = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
const formatPct = (n: number) => n.toFixed(1) + "%";

const labelPaymentMethod = (m: string) =>
  m === "cash" ? "Tiền mặt"
  : m === "card" ? "Quẹt thẻ"
  : m === "transfer" ? "Chuyển khoản"
  : m === "ewallet" ? "Ví điện tử"
  : m === "cod" ? "COD"
  : m;
const labelTier = (t: string) =>
  t === "bronze" ? "Đồng"
  : t === "silver" ? "Bạc"
  : t === "gold" ? "Vàng"
  : t === "platinum" ? "Bạch kim"
  : t === "diamond" ? "Kim cương"
  : t;
const tierColor = (t: string) =>
  t === "diamond" ? COLORS.violet
  : t === "platinum" ? "#94a3b8"
  : t === "gold" ? COLORS.amber
  : t === "silver" ? "#cbd5e1"
  : "#d97706";

// ==================== Tooltip & UI helpers ====================
function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; fill?: string }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background/95 p-2.5 text-xs shadow-lg backdrop-blur">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? p.fill }} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color ?? p.fill }} />
          <span className="font-medium">{p.name}:</span>
          <span className="tabular-nums">{formatter ? formatter(Number(p.value), p.name) : formatNum(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

function EmptyChart({ message = "Không có dữ liệu" }: { message?: string }) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ==================== Sparkline ====================
function Sparkline({
  data,
  color = COLORS.primary,
  height = 36,
  filled = true,
}: { data: number[]; color?: string; height?: number; filled?: boolean }) {
  if (!data || data.length === 0) return null;
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={filled ? `url(#spark-${color.replace(/[^a-z0-9]/gi, "")})` : "transparent"}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ==================== KPI Card ====================
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  sparkline,
  sparklineColor,
  gradient,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ElementType;
  trend?: "up" | "down";
  trendLabel?: string;
  sparkline?: number[];
  sparklineColor?: string;
  gradient?: string;
}) {
  return (
    <Card className="relative overflow-hidden hover-lift">
      {gradient && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ background: gradient }}
        />
      )}
      <CardHeader className="relative flex flex-row items-center justify-between gap-1 p-3 pb-1 sm:p-5 sm:pb-2">
        <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">{title}</CardTitle>
        {Icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/60 sm:h-8 sm:w-8">
            <Icon className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />
          </div>
        )}
      </CardHeader>
      <CardContent className="relative p-3 pt-0 sm:p-5 sm:pt-0">
        <div className="text-base font-bold leading-tight tabular-nums sm:text-2xl">{value}</div>
        {(subtitle || trendLabel) && (
          <p className="mt-0.5 flex items-center gap-1 text-[10px] leading-tight text-muted-foreground sm:mt-1 sm:text-xs">
            {trend === "up" && <ArrowUpRightIcon className="h-3 w-3 shrink-0 text-emerald-500" />}
            {trend === "down" && <ArrowDownRightIcon className="h-3 w-3 shrink-0 text-rose-500" />}
            <span className="truncate">{trendLabel}{subtitle && ` · ${subtitle}`}</span>
          </p>
        )}
        {sparkline && sparkline.length > 0 && (
          <div className="-mx-1 mt-2">
            <Sparkline data={sparkline} color={sparklineColor ?? COLORS.primary} height={32} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== Section title ====================
function SectionTitle({ number, title, description, accent }: { number: number; title: string; description: string; accent?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2 sm:mb-4 sm:gap-3">
      <Badge
        variant="default"
        className="shrink-0 rounded-full px-2 py-0.5 text-[11px] sm:px-2.5 sm:py-1 sm:text-xs"
        style={accent ? { backgroundColor: accent } : undefined}
      >
        {String(number).padStart(2, "0")}
      </Badge>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight sm:text-xl">{title}</h2>
        <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
      </div>
    </div>
  );
}

// ==================== Donut with legend ====================
function DonutChart({
  data,
  centerLabel,
  centerValue,
}: {
  data: Record<string, number>;
  centerLabel?: string;
  centerValue?: string;
}) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  if (entries.length === 0) return <EmptyChart />;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const chartData = entries.map(([k, v]) => ({ name: k, value: v }));
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="relative h-[170px] w-full max-w-[220px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={78}
              dataKey="value"
              paddingAngle={2}
              isAnimationActive
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {centerValue && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold tabular-nums">{centerValue}</span>
            {centerLabel && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{centerLabel}</span>}
          </div>
        )}
      </div>
      <div className="grid w-full grid-cols-1 gap-1.5 text-xs sm:flex-1">
        {chartData.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="truncate capitalize">{labelPaymentMethod(d.name)}</span>
            <span className="ml-auto font-medium tabular-nums">{formatPct((d.value / total) * 100)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== Calendar Heatmap (30 days) ====================
function CalendarHeatmap({ data }: { data: { date: string; revenue: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.revenue));
  const maxDate = new Date(Math.max(...data.map(d => new Date(d.date).getTime())));
  // Pad to 6 rows x 7 cols (last 42 days) for grid
  const start = new Date(maxDate);
  start.setDate(start.getDate() - 41);
  const days: { date: string; revenue: number }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const found = data.find(x => x.date === key);
    days.push({ date: key, revenue: found?.revenue ?? 0 });
  }
  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const intensity = (v: number) => {
    if (v <= 0) return "bg-muted";
    const ratio = v / max;
    if (ratio < 0.15) return "bg-emerald-500/15";
    if (ratio < 0.35) return "bg-emerald-500/30";
    if (ratio < 0.6) return "bg-emerald-500/55";
    if (ratio < 0.85) return "bg-emerald-500/80";
    return "bg-emerald-500";
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(d => (
          <div key={d} className="text-center text-[10px] font-medium uppercase text-muted-foreground">{d}</div>
        ))}
        {weeks.flat().map((d) => (
          <div
            key={d.date}
            className={`aspect-square rounded-sm ${intensity(d.revenue)} transition-all hover:ring-2 hover:ring-emerald-500/40`}
            title={`${d.date}: ${formatMoney(d.revenue)}`}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>Ít</span>
        <span className="h-2.5 w-3 rounded-sm bg-muted" />
        <span className="h-2.5 w-3 rounded-sm bg-emerald-500/15" />
        <span className="h-2.5 w-3 rounded-sm bg-emerald-500/30" />
        <span className="h-2.5 w-3 rounded-sm bg-emerald-500/55" />
        <span className="h-2.5 w-3 rounded-sm bg-emerald-500/80" />
        <span className="h-2.5 w-3 rounded-sm bg-emerald-500" />
        <span>Nhiều</span>
      </div>
    </div>
  );
}

// ==================== Funnel Chart ====================
function FunnelChart({ data }: { data: DashboardData["advanced"]["funnel"] }) {
  const stages = [
    { key: "placed", label: "Tạo đơn", color: COLORS.sky },
    { key: "confirmed", label: "Xác nhận", color: COLORS.violet },
    { key: "paid", label: "Đã thanh toán", color: COLORS.primary },
    { key: "fulfilled", label: "Giao hàng", color: COLORS.amber },
    { key: "completed", label: "Hoàn tất", color: COLORS.emerald },
  ] as const;
  const max = Math.max(...stages.map(s => data[s.key]), 1);
  return (
    <div className="space-y-2">
      {stages.map((s) => {
        const v = data[s.key];
        const pct = (v / max) * 100;
        const convFromPrev = (() => {
          const idx = stages.findIndex(x => x.key === s.key);
          if (idx === 0) return null;
          const prev = stages[idx - 1];
          const prevVal = data[prev.key];
          if (prevVal === 0) return null;
          return ((v / prevVal) * 100).toFixed(0) + "%";
        })();
        return (
          <div key={s.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="font-medium">{s.label}</span>
              </span>
              <span className="flex items-center gap-2 tabular-nums">
                <span className="font-semibold">{formatNum(v)}</span>
                {convFromPrev && <span className="text-muted-foreground">({convFromPrev} từ bước trước)</span>}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: s.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==================== Loading & Error ====================
function LoadingState() {
  return (
    <div className="space-y-8">
      {[1, 2, 3].map(s => (
        <section key={s}>
          <div className="mb-4 flex items-baseline gap-3">
            <Skeleton className="h-6 w-12 rounded-full" />
            <div>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="mt-1 h-4 w-64" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="mb-2 h-4 w-24" />
                  <Skeleton className="mb-2 h-8 w-20" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-destructive">Không thể tải dữ liệu thống kê.</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

// ==================== Period selector hook ====================
type Period = 7 | 14 | 30;
function usePeriod(defaultPeriod: Period = 14) {
  const [p, setP] = useState<Period>(defaultPeriod);
  return { period: p, setPeriod: setP };
}

// ==================== GROUP 1: KPI tổng quan ====================
function GroupKPI({ data }: { data: DashboardData }) {
  const { kpi, advanced } = data;
  return (
    <section>
      <SectionTitle number={1} title="KPI tổng quan" description="Doanh thu, đơn hàng, khách hàng mới — kèm xu hướng 7 ngày" accent={COLORS.primary} />
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Doanh thu tổng"
          value={formatMoney(kpi.revenueTotal)}
          subtitle="Lũy kế"
          icon={BanknoteIcon}
          sparkline={advanced.last7Revenue}
          sparklineColor={COLORS.emerald}
          gradient={`linear-gradient(135deg, ${COLORS.emerald}, transparent)`}
        />
        <StatCard
          title="Hôm nay"
          value={formatMoney(kpi.revenueToday)}
          subtitle={`Tuần: ${formatMoneyShort(kpi.revenueThisWeek)}`}
          icon={TrendingUpIcon}
          sparkline={advanced.last7Revenue}
          sparklineColor={COLORS.primary}
        />
        <StatCard
          title="Tổng đơn hàng"
          value={formatNum(kpi.totalOrders)}
          subtitle={`Hôm nay: ${kpi.ordersToday} · TB/đơn ${formatMoneyShort(kpi.aov)}`}
          icon={ShoppingCartIcon}
          sparkline={advanced.last7Orders}
          sparklineColor={COLORS.sky}
          gradient={`linear-gradient(135deg, ${COLORS.sky}, transparent)`}
        />
        <StatCard
          title="Giá trị đơn TB"
          value={formatMoney(kpi.aov)}
          subtitle="AOV"
          icon={TargetIcon}
          sparkline={advanced.last7Aov}
          sparklineColor={COLORS.amber}
        />
        <StatCard
          title="Khách hàng mới"
          value={formatNum(kpi.newCustomersThisMonth)}
          subtitle={`Hôm nay: ${kpi.newCustomersToday} · Tuần: ${kpi.newCustomersThisWeek}`}
          icon={UsersIcon}
          sparkline={advanced.last7Customers}
          sparklineColor={COLORS.violet}
          gradient={`linear-gradient(135deg, ${COLORS.violet}, transparent)`}
        />
        <StatCard
          title="Tỉ lệ hủy"
          value={formatPct(kpi.cancellationRate)}
          subtitle={`${formatNum(kpi.cancelledOrders)} đơn`}
          trend={kpi.cancellationRate > 5 ? "down" : "up"}
          icon={PercentIcon}
          sparkline={advanced.last7Orders.map((o) => -((o * (kpi.cancellationRate / 100)) || 0))}
          sparklineColor={kpi.cancellationRate > 5 ? COLORS.rose : COLORS.emerald}
        />
      </div>
    </section>
  );
}

// ==================== GROUP 2: Doanh thu & đơn hàng ====================
function GroupRevenue({ data }: { data: DashboardData["revenue"] }) {
  const { period, setPeriod } = usePeriod(14);
  const series = period === 30 ? data.last30Daily : period === 7 ? data.last14Daily.slice(-7) : data.last14Daily;

  return (
    <section>
      <SectionTitle number={2} title="Doanh thu & đơn hàng" description="Biểu đồ doanh thu theo ngày, heatmap 30 ngày, phân bổ trạng thái" accent={COLORS.secondary} />

      {/* Period switcher */}
      <div className="mb-3 flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Xem:</span>
        {([7, 14, 30] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              period === p
                ? "bg-primary text-primary-foreground shadow"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {p} ngày
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm sm:text-base">Xu hướng doanh thu & đơn hàng</CardTitle>
                <CardDescription className="text-xs">Composed chart — diện tích = doanh thu, cột = đơn hàng</CardDescription>
              </div>
              <ActivityIcon className="hidden h-5 w-5 text-muted-foreground sm:block" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={series} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cxlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.rose} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={COLORS.rose} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => formatMoneyShort(v)} width={56} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} allowDecimals={false} width={30} />
                <Tooltip content={<ChartTooltip formatter={(v: number, n: string) => n === "revenue" ? formatMoney(Number(v)) : `${v} đơn`} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Area yAxisId="left" type="monotone" name="Doanh thu" dataKey="revenue" stroke={COLORS.primary} strokeWidth={2} fill="url(#revGrad)" />
                <Bar yAxisId="right" name="Đơn hàng" dataKey="orders" fill={COLORS.secondary} radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar yAxisId="right" name="Đơn hủy" dataKey="cancelled" fill={COLORS.rose} radius={[3, 3, 0, 0]} maxBarSize={18} fillOpacity={0.65} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Trạng thái đơn hàng</CardTitle>
              <CardDescription className="text-xs">Phân bổ trên tổng đơn</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
              <DonutChart
                data={data.orderStatusDist}
                centerValue={formatNum(Object.values(data.orderStatusDist).reduce((a, b) => a + b, 0))}
                centerLabel="Tổng đơn"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Heatmap 30 ngày</CardTitle>
              <CardDescription className="text-xs">Mỗi ô = 1 ngày, đậm = doanh thu cao</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
              <CalendarHeatmap data={data.last30Daily.map(d => ({ date: d.date, revenue: d.revenue }))} />
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

// ==================== GROUP 3: Thanh toán & kênh ====================
function GroupPayment({ data }: { data: DashboardData["payment"] }) {
  const methodEntries = Object.entries(data.paymentMethodDist);
  const totalAmount = methodEntries.reduce((s, [, v]) => s + v.amount, 0);

  return (
    <section>
      <SectionTitle number={3} title="Thanh toán & kênh" description="Tỉ trọng phương thức thanh toán, doanh thu POS vs online, xu hướng 7 ngày" accent={COLORS.tertiary} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm sm:text-base">Phương thức thanh toán — 7 ngày</CardTitle>
                <CardDescription className="text-xs">Stacked area: doanh thu theo phương thức</CardDescription>
              </div>
              <ZapIcon className="hidden h-5 w-5 text-muted-foreground sm:block" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.methodDaily} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  {(["cash", "transfer", "card", "ewallet"] as const).map(m => (
                    <linearGradient key={m} id={`meth-${m}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={
                        m === "cash" ? COLORS.emerald : m === "transfer" ? COLORS.sky : m === "card" ? COLORS.violet : COLORS.amber
                      } stopOpacity={0.6} />
                      <stop offset="100%" stopColor={
                        m === "cash" ? COLORS.emerald : m === "transfer" ? COLORS.sky : m === "card" ? COLORS.violet : COLORS.amber
                      } stopOpacity={0.05} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatMoneyShort(v)} width={50} />
                <Tooltip content={<ChartTooltip formatter={v => formatMoney(Number(v))} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} formatter={(v) => labelPaymentMethod(v as string)} />
                <Area type="monotone" name="cash" dataKey="cash" stackId="1" stroke={COLORS.emerald} fill="url(#meth-cash)" />
                <Area type="monotone" name="transfer" dataKey="transfer" stackId="1" stroke={COLORS.sky} fill="url(#meth-transfer)" />
                <Area type="monotone" name="card" dataKey="card" stackId="1" stroke={COLORS.violet} fill="url(#meth-card)" />
                <Area type="monotone" name="ewallet" dataKey="ewallet" stackId="1" stroke={COLORS.amber} fill="url(#meth-ewallet)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
            <CardTitle className="text-sm sm:text-base">Kênh bán hàng</CardTitle>
            <CardDescription className="text-xs">POS vs Online — 7 ngày</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.channelDaily} margin={{ top: 5, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => formatMoneyShort(v)} width={48} />
                <Tooltip content={<ChartTooltip formatter={v => formatMoney(Number(v))} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === "pos" ? "Tại quầy" : "Online"} />
                <Bar name="pos" dataKey="pos" fill={COLORS.primary} radius={[3, 3, 0, 0]} />
                <Bar name="online" dataKey="online" fill={COLORS.tertiary} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tại quầy (POS)</p>
                <p className="mt-0.5 text-base font-bold tabular-nums">{formatMoneyShort(data.posRevenue)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Online</p>
                <p className="mt-0.5 text-base font-bold tabular-nums">{formatMoneyShort(data.onlineRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Method breakdown bars */}
      <Card className="mt-4">
        <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
          <CardTitle className="text-sm sm:text-base">Chi tiết phương thức thanh toán</CardTitle>
          <CardDescription className="text-xs">Doanh thu + số đơn theo từng phương thức</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-3 pt-0 sm:p-5 sm:pt-0">
          {methodEntries.map(([method, v], i) => {
            const pct = totalAmount > 0 ? (v.amount / totalAmount) * 100 : 0;
            const color = PIE_COLORS[i % PIE_COLORS.length];
            return (
              <div key={method} className="space-y-1">
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="font-medium">{labelPaymentMethod(method)}</span>
                  <span className="ml-auto font-semibold tabular-nums">{formatMoney(v.amount)}</span>
                  <span className="w-16 text-right text-xs text-muted-foreground tabular-nums sm:w-20">{formatNum(v.count)} đơn</span>
                  <span className="w-12 text-right text-xs font-medium tabular-nums" style={{ color }}>{pct.toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
          {methodEntries.length === 0 && <p className="text-sm text-muted-foreground">Chưa có giao dịch</p>}
        </CardContent>
      </Card>
    </section>
  );
}

// ==================== GROUP 4: Sản phẩm ====================
function GroupProduct({ data }: { data: DashboardData["product"] }) {
  return (
    <section>
      <SectionTitle number={4} title="Sản phẩm" description="Top bán chạy, cảnh báo tồn kho, phân bổ trạng thái" accent={COLORS.quaternary} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
            <CardTitle className="text-sm sm:text-base">Top sản phẩm bán chạy</CardTitle>
            <CardDescription className="text-xs">Số lượng (thanh) + doanh thu (đường)</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data.topSelling.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="qtyGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={COLORS.tertiary} stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                <Tooltip content={<ChartTooltip formatter={(v: number, n: string) => n === "Doanh thu" ? formatMoney(Number(v)) : `${v} SP`} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar name="Số lượng" dataKey="qty" fill="url(#qtyGrad)" radius={[0, 4, 4, 0]} maxBarSize={20} />
                <Line name="Doanh thu" dataKey="revenue" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 3, fill: COLORS.amber }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Tổng quan kho</CardTitle>
              <CardDescription className="text-xs">Sản phẩm · biến thể · tồn kho</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0 text-sm sm:p-5 sm:pt-0">
              <Row label="Sản phẩm" value={formatNum(data.totalProducts)} />
              <Row label="Biến thể" value={formatNum(data.totalVariants)} />
              <Row label="Sắp hết hàng (≤5)" value={<span className="font-semibold text-amber-500">{formatNum(data.lowStockCount)}</span>} />
              <Row label="Trạng thái SP" value={
                <span className="text-xs">{Object.entries(data.productStatus).map(([k, v]) => `${k}: ${v}`).join(", ")}</span>
              } />
            </CardContent>
          </Card>

          {data.lowStockCount > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20">
              <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
                  <CardTitle className="text-sm">Cảnh báo tồn kho</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 text-xs text-muted-foreground sm:p-5 sm:pt-0">
                Có <span className="font-bold text-amber-600 dark:text-amber-400">{formatNum(data.lowStockCount)}</span> sản phẩm sắp hết hàng. Cần nhập thêm.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b pb-1.5 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground sm:text-sm">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

// ==================== GROUP 5: Kho & nhập hàng ====================
function GroupInventory({ data }: { data: DashboardData["inventory"] }) {
  return (
    <section>
      <SectionTitle number={5} title="Kho & nhập hàng" description="Nhập/xuất/chuyển kho, đơn nhập đang chờ, inventory flow 14 ngày" accent={COLORS.amber} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
            <CardTitle className="text-sm sm:text-base">Dòng chảy kho — 14 ngày</CardTitle>
            <CardDescription className="text-xs">Nhập (vào) vs Xuất (ra) theo ngày</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data.inventoryFlow} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.emerald} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={COLORS.emerald} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.rose} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={COLORS.rose} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip content={<ChartTooltip formatter={v => `${formatNum(Number(v))} SP`} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" name="Nhập kho" dataKey="inbound" stroke={COLORS.emerald} fill="url(#inGrad)" strokeWidth={2} />
                <Area type="monotone" name="Xuất kho" dataKey="outbound" stroke={COLORS.rose} fill="url(#outGrad)" strokeWidth={2} />
                <Line type="monotone" name="Chuyển kho" dataKey="transfer" stroke={COLORS.sky} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <MiniKpi label="Nhập hôm nay" value={formatNum(data.importToday)} icon={TruckIcon} color={COLORS.emerald} />
            <MiniKpi label="Xuất hôm nay" value={formatNum(data.exportToday)} icon={PackageIcon} color={COLORS.rose} />
            <MiniKpi label="Chuyển kho" value={formatNum(data.transferToday)} icon={TruckIcon} color={COLORS.sky} />
          </div>
          <Card>
            <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Giá trị nhập</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0 text-sm sm:p-5 sm:pt-0">
              <Row label="Tháng này (inventory)" value={<span className="font-semibold tabular-nums">{formatMoneyShort(data.monthlyImportValue)}</span>} />
              <Row label="Tháng này (PO)" value={<span className="font-semibold tabular-nums">{formatMoneyShort(data.monthlyPurchaseValue)}</span>} />
              <Row label="Đơn nhập đang chờ" value={<span className="font-semibold tabular-nums text-amber-600">{formatNum(data.pendingPOCount)}</span>} />
              <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-2 text-xs">
                <div><p className="text-muted-foreground">Kho</p><p className="font-semibold tabular-nums">{formatNum(data.totalWarehouses)}</p></div>
                <div><p className="text-muted-foreground">NCC</p><p className="font-semibold tabular-nums">{formatNum(data.totalSuppliers)}</p></div>
                <div><p className="text-muted-foreground">Stock rows</p><p className="font-semibold tabular-nums">{formatNum(data.totalStockLevels)}</p></div>
                <div><p className="text-muted-foreground">Serial</p><p className="font-semibold tabular-nums">{formatNum(data.totalSerials)}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function MiniKpi({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>
        <p className="mt-1 text-lg font-bold tabular-nums sm:text-xl">{value}</p>
      </CardContent>
    </Card>
  );
}

// ==================== GROUP 6: Khách hàng ====================
function GroupCustomer({ data, funnel }: { data: DashboardData["customer"]; funnel: DashboardData["advanced"]["funnel"] }) {
  const totalCust = data.totalCustomers;
  return (
    <section>
      <SectionTitle number={6} title="Khách hàng" description="Phân bổ hạng, khách quay lại, top VIP, điểm tích lũy" accent={COLORS.violet} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
            <CardTitle className="text-sm sm:text-base">Phân bổ hạng thành viên</CardTitle>
            <CardDescription className="text-xs">Tỉ trọng theo tier</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <DonutChart
              data={data.tierDist}
              centerValue={formatNum(totalCust)}
              centerLabel="Khách hàng"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
            <CardTitle className="text-sm sm:text-base">Top khách hàng VIP</CardTitle>
            <CardDescription className="text-xs">Chi tiêu nhiều nhất — bubble: đơn × doanh thu</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            {data.topCustomers.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis type="number" dataKey="orders" name="Đơn" tick={{ fontSize: 10 }} />
                    <YAxis type="number" dataKey="total" name="Doanh thu" tick={{ fontSize: 10 }} tickFormatter={v => formatMoneyShort(v)} width={56} />
                    <ZAxis range={[60, 300]} />
                    <Tooltip content={<ChartTooltip formatter={(v: number, n: string) => n === "total" ? formatMoney(Number(v)) : `${v} đơn`} />} cursor={{ strokeDasharray: "3 3" }} />
                    <Scatter data={data.topCustomers} fill={COLORS.violet}>
                      {data.topCustomers.map((c, i) => (
                        <Cell key={i} fill={tierColor(c.tier)} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1">
                  {data.topCustomers.slice(0, 4).map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: tierColor(c.tier) }}>{i + 1}</span>
                      <span className="truncate font-medium">{c.name}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{labelTier(c.tier)}</Badge>
                      <span className="ml-auto font-semibold tabular-nums">{formatMoneyShort(c.total)}</span>
                      <span className="w-14 text-right text-muted-foreground tabular-nums">{c.orders} đơn</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyChart message="Chưa có dữ liệu khách hàng" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
            <CardTitle className="text-sm sm:text-base">Tổng quan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0 sm:p-5 sm:pt-0">
            <Row label="Tổng KH" value={<span className="font-bold tabular-nums">{formatNum(data.totalCustomers)}</span>} />
            <Row label="Quay lại" value={
              <span className="font-bold tabular-nums">
                {formatNum(data.returningCustomers)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({totalCust > 0 ? formatPct((data.returningCustomers / totalCust) * 100) : "0%"})
                </span>
              </span>
            } />
            <Row label="Điểm phát sinh" value={<span className="font-semibold tabular-nums">{formatNum(data.earnedPoints)}</span>} />
            <Row label="Điểm đã dùng" value={<span className="font-semibold tabular-nums">{formatNum(data.redeemedPoints)}</span>} />
            <Row label="Tổng điểm hiện có" value={<span className="font-bold tabular-nums text-violet-600 dark:text-violet-400">{formatNum(data.totalPoints)}</span>} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
            <CardTitle className="text-sm sm:text-base">Phễu chuyển đổi đơn hàng</CardTitle>
            <CardDescription className="text-xs">Hành trình từ tạo đơn → hoàn tất</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <FunnelChart data={funnel} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// ==================== GROUP 7: Dịch vụ sau bán ====================
function GroupAfterSale({ data }: { data: DashboardData["afterSale"] }) {
  const entries = Object.entries(data.repairMonths);
  return (
    <section>
      <SectionTitle number={7} title="Dịch vụ sau bán" description="Phiếu sửa đang mở, bảo hành sắp hết hạn, yêu cầu thu cũ mới, thời gian sửa TB" accent={COLORS.rose} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4">
        <StatCard title="Phiếu sửa đang mở" value={formatNum(data.openRepairs)} subtitle={`Tổng: ${formatNum(data.totalRepairTickets)}`} icon={WrenchIcon} trend={data.openRepairs > 0 ? "up" : undefined} />
        <StatCard title="Bảo hành sắp hết hạn" value={formatNum(data.expiringWarranties)} subtitle="Trong 30 ngày tới" icon={AwardIcon} trend={data.expiringWarranties > 0 ? "up" : undefined} />
        <StatCard title="Yêu cầu thu cũ mới" value={formatNum(data.pendingTradeIns)} subtitle="pending / evaluating" icon={TrendingUpIcon} trend={data.pendingTradeIns > 0 ? "up" : undefined} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
            <CardTitle className="text-sm sm:text-base">Thời gian sửa trung bình — 6 tháng</CardTitle>
            <CardDescription className="text-xs">Số phiếu (cột) + giờ sửa TB (đường)</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={entries} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} width={32} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} width={36} unit="h" />
                <Tooltip content={<ChartTooltip formatter={(v: number, n: string) => n === "Số phiếu" ? `${v} phiếu` : `${v} giờ`} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" name="Số phiếu" dataKey="repairCount" fill={COLORS.primary} radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Line yAxisId="right" name="Giờ sửa TB" dataKey="avgHours" stroke={COLORS.amber} strokeWidth={2} dot={{ r: 3, fill: COLORS.amber }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <Card>
            <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Trạng thái sửa</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0"><DonutChart data={data.repairStatusDist} centerValue={formatNum(Object.values(data.repairStatusDist).reduce((a,b)=>a+b,0))} centerLabel="Phiếu" /></CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Trạng thái bảo hành</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0"><DonutChart data={data.warrantyStatusDist} centerValue={formatNum(Object.values(data.warrantyStatusDist).reduce((a,b)=>a+b,0))} centerLabel="Bảo hành" /></CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Trạng thái thu cũ</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0"><DonutChart data={data.tradeInStatusDist} centerValue={formatNum(Object.values(data.tradeInStatusDist).reduce((a,b)=>a+b,0))} centerLabel="Yêu cầu" /></CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

// ==================== GROUP 8: Ca bán hàng ====================
function GroupPOS({ data, funnel }: { data: DashboardData["pos"]; funnel: DashboardData["advanced"]["funnel"] }) {
  const max = Math.max(...data.topStaff.map(s => s.revenue), 1);
  return (
    <section>
      <SectionTitle number={8} title="Ca bán hàng" description="Doanh thu theo nhân viên, kiểm tiền cuối ca, chênh lệch quỹ, phễu đơn hàng" accent={COLORS.primary} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <MiniKpi label="Ca đang mở" value={formatNum(data.openSessions)} icon={DollarSignIcon} color={COLORS.emerald} />
            <MiniKpi label="Ca chênh lệch" value={formatNum(data.diffCashSessions)} icon={AlertTriangleIcon} color={COLORS.rose} />
            <MiniKpi label="Tổng chênh" value={formatMoneyShort(data.totalDiffCash)} icon={PercentIcon} color={COLORS.amber} />
          </div>
          <Card>
            <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Phễu đơn hàng</CardTitle>
              <CardDescription className="text-xs">Từ tạo đơn → hoàn tất</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
              <FunnelChart data={funnel} />
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
            <CardTitle className="text-sm sm:text-base">Doanh thu theo nhân viên (Top 10)</CardTitle>
            <CardDescription className="text-xs">Tên thật qua user_profiles</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
            {data.topStaff.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(220, data.topStaff.length * 28)}>
                <BarChart data={data.topStaff} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="staffGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={COLORS.tertiary} stopOpacity={0.95} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => formatMoneyShort(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip content={<ChartTooltip formatter={(v: number, n: string) => n === "Doanh thu" ? formatMoney(Number(v)) : `${v} đơn`} />} />
                  <Bar name="Doanh thu" dataKey="revenue" fill="url(#staffGrad)" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="Chưa có dữ liệu ca bán" />
            )}
            {data.topStaff.length > 0 && (
              <div className="mt-2 space-y-1">
                {data.topStaff.slice(0, 3).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{i + 1}</span>
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="ml-auto text-muted-foreground tabular-nums">{s.orders} đơn</span>
                    <span className="w-20 text-right font-semibold tabular-nums">{formatMoneyShort(s.revenue)}</span>
                    <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">{((s.revenue / max) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// ==================== COMPARISON: tuần này vs tuần trước ====================
function ComparisonSection({ data }: { data: DashboardData }) {
  const { advanced } = data;
  const { thisWeek, prevWeek } = advanced.weeklyCompare;
  const items = [
    { label: "Doanh thu tuần", curr: thisWeek.revenue, prev: prevWeek.revenue, unit: "money" as const },
    { label: "Đơn hàng tuần", curr: thisWeek.orders, prev: prevWeek.orders, unit: "number" as const },
  ];
  return (
    <section>
      <SectionTitle number={9} title="So sánh tuần" description="Tuần này vs tuần trước" />
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(it => {
          const diff = it.prev > 0 ? ((it.curr - it.prev) / it.prev) * 100 : 0;
          const isUp = diff >= 0;
          const fmt = it.unit === "money" ? formatMoney : (n: number) => formatNum(Math.round(n));
          const data = [
            { name: "Tuần trước", value: it.prev, fill: COLORS.secondary },
            { name: "Tuần này", value: it.curr, fill: COLORS.primary },
          ];
          return (
            <Card key={it.label}>
              <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-base">{it.label}</CardTitle>
                  <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${isUp ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                    {isUp ? <ArrowUpRightIcon className="h-3 w-3" /> : <ArrowDownRightIcon className="h-3 w-3" />}
                    {isUp ? "+" : ""}{diff.toFixed(1)}%
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
                <ResponsiveContainer width="100%" height={70}>
                  <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" hide />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={32}>
                      {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                    <Tooltip content={<ChartTooltip formatter={v => fmt(Number(v))} />} cursor={{ fill: "transparent" }} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-1 flex justify-between text-xs">
                  <div>
                    <p className="text-muted-foreground">Tuần trước</p>
                    <p className="font-semibold tabular-nums">{fmt(it.prev)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Tuần này</p>
                    <p className="font-bold tabular-nums">{fmt(it.curr)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// ==================== STATUS BY DAY ====================
function StatusByDayChart({ data }: { data: DashboardData["advanced"]["statusByDay"] }) {
  return (
    <Card>
      <CardHeader className="p-3 pb-2 sm:p-5 sm:pb-3">
        <CardTitle className="text-sm sm:text-base">Phân bổ trạng thái đơn theo ngày — 7 ngày</CardTitle>
        <CardDescription className="text-xs">Stacked bar — phân bổ theo trạng thái</CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-5 sm:pt-0">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={32} />
            <Tooltip content={<ChartTooltip formatter={v => `${v} đơn`} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar name="Chờ" dataKey="pending" stackId="a" fill={STATUS_COLORS.pending} radius={[0, 0, 0, 0]} />
            <Bar name="Xác nhận" dataKey="confirmed" stackId="a" fill={STATUS_COLORS.confirmed} />
            <Bar name="Đang xử lý" dataKey="processing" stackId="a" fill={STATUS_COLORS.processing} />
            <Bar name="Hoàn tất" dataKey="completed" stackId="a" fill={STATUS_COLORS.completed} />
            <Bar name="Hủy" dataKey="cancelled" stackId="a" fill={STATUS_COLORS.cancelled} radius={[3, 3, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ==================== MAIN EXPORT ====================
export function DashboardContent() {
  const q = useQuery({
    queryKey: ["dashboard-stats-v3"],
    queryFn: () => httpGet<DashboardData>("/v1/dashboard/stats"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (q.isLoading) return <LoadingState />;
  if (q.error || !q.data) return <ErrorState message={(q.error as Error)?.message ?? ""} />;

  const data = q.data;

  return (
    <Tabs defaultValue="all" className="space-y-4 sm:space-y-6">
      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList className="w-max">
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="kpi">KPI</TabsTrigger>
          <TabsTrigger value="revenue">Doanh thu</TabsTrigger>
          <TabsTrigger value="payment">Thanh toán</TabsTrigger>
          <TabsTrigger value="product">Sản phẩm</TabsTrigger>
          <TabsTrigger value="inventory">Kho</TabsTrigger>
          <TabsTrigger value="customer">Khách hàng</TabsTrigger>
          <TabsTrigger value="aftersale">Hậu mãi</TabsTrigger>
          <TabsTrigger value="pos">Ca bán</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="all" className="mt-0 space-y-6 sm:space-y-8">
        <GroupKPI data={data} />
        <ComparisonSection data={data} />
        <GroupRevenue data={data.revenue} />
        <GroupPayment data={data.payment} />
        <StatusByDayChart data={data.advanced.statusByDay} />
        <GroupProduct data={data.product} />
        <GroupInventory data={data.inventory} />
        <GroupCustomer data={data.customer} funnel={data.advanced.funnel} />
        <GroupAfterSale data={data.afterSale} />
        <GroupPOS data={data.pos} funnel={data.advanced.funnel} />
      </TabsContent>

      <TabsContent value="kpi" className="mt-0 space-y-6">
        <GroupKPI data={data} />
        <ComparisonSection data={data} />
        <StatusByDayChart data={data.advanced.statusByDay} />
      </TabsContent>

      <TabsContent value="revenue" className="mt-0 space-y-6">
        <GroupRevenue data={data.revenue} />
      </TabsContent>

      <TabsContent value="payment" className="mt-0">
        <GroupPayment data={data.payment} />
      </TabsContent>

      <TabsContent value="product" className="mt-0">
        <GroupProduct data={data.product} />
      </TabsContent>

      <TabsContent value="inventory" className="mt-0">
        <GroupInventory data={data.inventory} />
      </TabsContent>

      <TabsContent value="customer" className="mt-0">
        <GroupCustomer data={data.customer} funnel={data.advanced.funnel} />
      </TabsContent>

      <TabsContent value="aftersale" className="mt-0">
        <GroupAfterSale data={data.afterSale} />
      </TabsContent>

      <TabsContent value="pos" className="mt-0">
        <GroupPOS data={data.pos} funnel={data.advanced.funnel} />
      </TabsContent>
    </Tabs>
  );
}
