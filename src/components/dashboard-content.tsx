"use client";

import { useQuery } from "@tanstack/react-query";
import { httpGet } from "@/lib/api/http";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend,
} from "recharts";
import {
  TrendingUpIcon, TrendingDownIcon, BanknoteIcon, ShoppingCartIcon,
  UsersIcon, PackageIcon, AlertTriangleIcon, TruckIcon, AwardIcon,
  WrenchIcon, DollarSignIcon, PercentIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ---------- Types ----------
type DailyRevenue = { date: string; revenue: number; orders: number; cancelled: number };
type TopSelling = { id: string; qty: number; revenue: number; name: string };
type TopStaff = { id: string; orders: number; revenue: number };

type DashboardData = {
  kpi: {
    revenueTotal: number; revenueToday: number; revenueThisWeek: number; revenueThisMonth: number;
    totalOrders: number; ordersToday: number; ordersThisWeek: number; ordersThisMonth: number;
    completedOrders: number; cancelledOrders: number; aov: number; cancellationRate: number;
    totalCustomers: number; newCustomersToday: number; newCustomersThisWeek: number; newCustomersThisMonth: number;
  };
  revenue: {
    dailyRevenue: DailyRevenue[];
    orderStatusDist: Record<string, number>;
    paymentStatusDist: Record<string, number>;
    cancellationRate: number; aov: number;
  };
  payment: {
    paymentMethodDist: Record<string, { count: number; amount: number }>;
    channelDist: Record<string, number>;
    posRevenue: number; onlineRevenue: number;
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
  };
  customer: {
    tierDist: Record<string, number>;
    totalCustomers: number; returningCustomers: number;
    totalPoints: number; earnedPoints: number; redeemedPoints: number;
  };
  afterSale: {
    openRepairs: number; repairStatusDist: Record<string, number>; totalRepairTickets: number;
    expiringWarranties: number; warrantyStatusDist: Record<string, number>; totalWarranties: number;
    pendingTradeIns: number; tradeInStatusDist: Record<string, number>; totalTradeIns: number;
  };
  pos: {
    openSessions: number; totalSessions: number;
    topStaff: TopStaff[]; diffCashSessions: number; totalDiffCash: number;
  };
};

// ---------- Colors ----------
const COLORS = {
  primary: "hsl(var(--chart-1))",
  secondary: "hsl(var(--chart-2))",
  tertiary: "hsl(var(--chart-3))",
  quaternary: "hsl(var(--chart-4))",
  danger: "hsl(var(--chart-5))",
};
const PIE_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#f59e0b", "#8b5cf6", "#ec4899"];

const formatMoney = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
const formatNum = (n: number) =>
  new Intl.NumberFormat("vi-VN").format(n);
const formatPct = (n: number) =>
  n.toFixed(1) + "%";

function StatCard({ title, value, subtitle, icon: Icon, trend, trendLabel }: {
  title: string; value: string; subtitle?: string;
  icon?: React.ElementType; trend?: "up" | "down"; trendLabel?: string;
}) {
  return (
    <Card className="hover-lift">
      <CardHeader className="flex flex-row items-center justify-between gap-1 p-3 pb-1 sm:p-6 sm:pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
        <div className="text-lg font-bold leading-tight sm:text-2xl">{value}</div>
        {(subtitle || trendLabel) && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] leading-tight text-muted-foreground sm:mt-1 sm:text-xs">
            {trend === "up" && <TrendingUpIcon className="h-3 w-3 shrink-0 text-green-500" />}
            {trend === "down" && <TrendingDownIcon className="h-3 w-3 shrink-0 text-red-500" />}
            <span className="truncate">{trendLabel}{subtitle && ` · ${subtitle}`}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2 sm:mb-4 sm:gap-3">
      <Badge variant="default" className="shrink-0 rounded-full px-2 py-0.5 text-[11px] sm:px-2.5 sm:py-1 sm:text-xs">{String(number).padStart(2, "0")}</Badge>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight sm:text-xl">{title}</h2>
        <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
      </div>
    </div>
  );
}

function SimplePieChart({ data, title }: { data: Record<string, number>; title?: string }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  if (entries.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Không có dữ liệu</p>;
  return (
    <div>
      {title && <p className="mb-2 text-sm font-medium">{title}</p>}
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie data={entries.map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" innerRadius={42} outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
            {entries.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

function LoadingState() {
  return (
    <div className="space-y-8">
      {/* KPI Section Skeleton */}
      <section>
        <div className="mb-4 flex items-baseline gap-3">
          <Skeleton className="h-6 w-12 rounded-full" />
          <div>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="mt-1 h-4 w-64" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Chart Section Skeleton */}
      <section>
        <div className="mb-4 flex items-baseline gap-3">
          <Skeleton className="h-6 w-12 rounded-full" />
          <div>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-1 h-4 w-56" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="pt-6">
              <Skeleton className="h-[280px] w-full" />
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="h-[220px] w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="h-[220px] w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
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

// ==================== GROUP 1: KPI TỔNG QUAN ====================
function GroupKPI({ kpi }: { kpi: DashboardData["kpi"] }) {
  return (
    <section>
      <SectionTitle number={1} title="KPI tổng quan" description="Doanh thu, đơn hàng, khách hàng mới theo ngày/tuần/tháng" />
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Doanh thu tổng" value={formatMoney(kpi.revenueTotal)} subtitle="Lũy kế" icon={BanknoteIcon} />
        <StatCard title="Doanh thu hôm nay" value={formatMoney(kpi.revenueToday)} subtitle={`Tuần: ${formatMoney(kpi.revenueThisWeek)}`} icon={TrendingUpIcon} />
        <StatCard title="Tổng đơn hàng" value={formatNum(kpi.totalOrders)} subtitle={`Hôm nay: ${kpi.ordersToday}`} icon={ShoppingCartIcon} />
        <StatCard title="Giá trị đơn TB" value={formatMoney(kpi.aov)} subtitle="AOV" icon={BanknoteIcon} />
        <StatCard title="Khách hàng mới" value={formatNum(kpi.newCustomersThisMonth)} subtitle={`Hôm nay: ${kpi.newCustomersToday} · Tuần: ${kpi.newCustomersThisWeek}`} icon={UsersIcon} />
        <StatCard title="Tỉ lệ hủy" value={formatPct(kpi.cancellationRate)} subtitle={`${formatNum(kpi.cancelledOrders)} đơn`} trend={kpi.cancellationRate > 5 ? "down" : "up"} icon={PercentIcon} />
      </div>
    </section>
  );
}

// ==================== GROUP 2: DOANH THU & ĐƠN HÀNG ====================
function GroupRevenue({ data }: { data: DashboardData["revenue"] }) {
  return (
    <section>
      <SectionTitle number={2} title="Doanh thu & đơn hàng" description="Biểu đồ doanh thu theo ngày, phân bổ trạng thái đơn, tỉ lệ hủy" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-6"><CardTitle className="text-sm sm:text-base">Doanh thu theo ngày</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.dailyRevenue}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatMoney(v)} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-2 text-xs shadow">
                      <p className="font-medium">{d.date}</p>
                      <p>Doanh thu: {formatMoney(d.revenue)}</p>
                      <p>Đơn: {d.orders} | Hủy: {d.cancelled}</p>
                    </div>
                  );
                }} />
                <Area type="monotone" dataKey="revenue" stroke={COLORS.primary} fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-6"><CardTitle className="text-sm sm:text-base">Trạng thái đơn hàng</CardTitle></CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <SimplePieChart data={data.orderStatusDist} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-6"><CardTitle className="text-sm sm:text-base">Trạng thái thanh toán</CardTitle></CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <SimplePieChart data={data.paymentStatusDist} />
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-4">
        <StatCard title="Doanh thu TB / đơn" value={formatMoney(data.aov)} subtitle="Giá trị đơn trung bình" />
        <StatCard title="Tỉ lệ hủy đơn" value={formatPct(data.cancellationRate)} subtitle="Trên tổng đơn" />
        <StatCard title="Đã hoàn tất" value={formatNum(data.orderStatusDist["completed"] ?? 0)} subtitle={`+ ${data.orderStatusDist["fulfilled"] ?? 0} fulfilled`} />
      </div>
    </section>
  );
}

// ==================== GROUP 3: THANH TOÁN & KÊNH ====================
function GroupPayment({ data }: { data: DashboardData["payment"] }) {
  const methodEntries = Object.entries(data.paymentMethodDist);
  const totalAmount = Object.values(data.paymentMethodDist).reduce((s, v) => s + v.amount, 0);
  return (
    <section>
      <SectionTitle number={3} title="Thanh toán & kênh" description="Tỉ trọng phương thức thanh toán, doanh thu POS vs online" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-6"><CardTitle className="text-sm sm:text-base">Phương thức thanh toán</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-3">
              {methodEntries.map(([method, v], i) => (
                <div key={method} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-sm capitalize">{method === "ewallet" ? "Ví điện tử" : method === "cod" ? "COD" : method}</span>
                    <span className="ml-auto text-sm font-medium tabular-nums">{formatMoney(v.amount)}</span>
                    <span className="w-14 text-right text-xs text-muted-foreground">{formatNum(v.count)} đơn</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${totalAmount > 0 ? (v.amount / totalAmount) * 100 : 0}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  </div>
                </div>
              ))}
              {methodEntries.length === 0 && <p className="text-sm text-muted-foreground">Chưa có giao dịch</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-6"><CardTitle className="text-sm sm:text-base">Kênh bán hàng</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <SimplePieChart data={data.channelDist} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatCard title="POS" value={formatMoney(data.posRevenue)} icon={DollarSignIcon} />
              <StatCard title="Online" value={formatMoney(data.onlineRevenue)} icon={ShoppingCartIcon} />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// ==================== GROUP 4: SẢN PHẨM ====================
function GroupProduct({ data }: { data: DashboardData["product"] }) {
  return (
    <section>
      <SectionTitle number={4} title="Sản phẩm" description="Top bán chạy, cảnh báo tồn kho, phân bổ trạng thái sản phẩm" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-6"><CardTitle className="text-sm sm:text-base">Top sản phẩm bán chạy</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.topSelling.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={150} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return <div className="rounded-lg border bg-background p-2 text-xs shadow"><p className="font-medium">{d.name}</p><p>SL: {d.qty} · DT: {formatMoney(d.revenue)}</p></div>;
                }} />
                <Bar dataKey="qty" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-2"><CardTitle className="text-sm sm:text-base">Tổng quan kho</CardTitle></CardHeader>
            <CardContent className="space-y-2 p-3 pt-0 text-sm sm:p-6 sm:pt-0">
              <div className="flex justify-between"><span className="text-muted-foreground">Sản phẩm</span><span className="font-medium">{formatNum(data.totalProducts)}</span></div>
              <div className="flex justify-between border-b pb-1"><span className="text-muted-foreground">Biến thể</span><span className="font-medium">{formatNum(data.totalVariants)}</span></div>
              <div className="flex justify-between border-b pb-1"><span className="text-muted-foreground">Sắp hết hàng (≤5)</span><span className="font-medium text-amber-500">{formatNum(data.lowStockCount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Trạng thái</span><span className="font-medium">{Object.entries(data.productStatus).map(([k, v]) => `${k}: ${formatNum(v)}`).join(", ")}</span></div>
            </CardContent>
          </Card>
          {data.lowStockCount > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
              <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
                  <CardTitle className="text-sm">Cảnh báo tồn kho</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 text-xs text-muted-foreground sm:p-6 sm:pt-0">
                Có {formatNum(data.lowStockCount)} sản phẩm sắp hết hàng. Cần nhập thêm.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}

// ==================== GROUP 5: KHO & NHẬP HÀNG ====================
function GroupInventory({ data }: { data: DashboardData["inventory"] }) {
  return (
    <section>
      <SectionTitle number={5} title="Kho & nhập hàng" description="Nhập/xuất/chuyển kho, đơn nhập đang chờ, giá trị nhập tháng" />
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Nhập kho hôm nay" value={formatNum(data.importToday)} subtitle="Đã nhập" icon={TruckIcon} />
        <StatCard title="Xuất kho hôm nay" value={formatNum(data.exportToday)} subtitle="Đã xuất" icon={PackageIcon} />
        <StatCard title="Chuyển kho" value={formatNum(data.transferToday)} subtitle="Lượt chuyển" icon={TruckIcon} />
        <StatCard title="Đơn nhập đang chờ" value={formatNum(data.pendingPOCount)} subtitle="sent / partial" icon={ShoppingCartIcon} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Giá trị nhập tháng" value={formatMoney(data.monthlyImportValue)} subtitle="Từ inventory" icon={BanknoteIcon} />
        <StatCard title="Giá trị PO tháng" value={formatMoney(data.monthlyPurchaseValue)} subtitle="Từ purchase orders" icon={BanknoteIcon} />
        <StatCard title="Kho hàng" value={formatNum(data.totalWarehouses)} subtitle="Tổng số kho" icon={PackageIcon} />
        <StatCard title="Nhà cung cấp" value={formatNum(data.totalSuppliers)} subtitle="Đối tác" icon={UsersIcon} />
      </div>
    </section>
  );
}

// ==================== GROUP 6: KHÁCH HÀNG ====================
function GroupCustomer({ data }: { data: DashboardData["customer"] }) {
  return (
    <section>
      <SectionTitle number={6} title="Khách hàng" description="Phân bổ hạng, khách quay lại, điểm tích lũy" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-6"><CardTitle className="text-sm sm:text-base">Phân bổ hạng thành viên</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <SimplePieChart data={data.tierDist} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-6"><CardTitle className="text-sm sm:text-base">Tổng quan</CardTitle></CardHeader>
          <CardContent className="space-y-3 p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm text-muted-foreground">Tổng khách hàng</span>
              <span className="text-lg font-bold">{formatNum(data.totalCustomers)}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm text-muted-foreground">Khách quay lại</span>
              <span className="text-lg font-bold">{formatNum(data.returningCustomers)}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm text-muted-foreground">Tỉ lệ quay lại</span>
              <span className="text-lg font-bold">{data.totalCustomers > 0 ? formatPct((data.returningCustomers / data.totalCustomers) * 100) : "0%"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Điểm tích lũy phát sinh</span>
              <span className="text-lg font-bold">{formatNum(data.earnedPoints)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Điểm đã dùng</span>
              <span className="text-lg font-bold">{formatNum(data.redeemedPoints)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tổng điểm hiện có</span>
              <span className="text-lg font-bold">{formatNum(data.totalPoints)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-6"><CardTitle className="text-sm sm:text-base">Chỉ số khách hàng</CardTitle></CardHeader>
          <CardContent className="space-y-4 p-3 pt-0 sm:p-6 sm:pt-4">
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Tỉ trọng theo hạng</p>
              {Object.entries(data.tierDist).map(([tier, count]) => (
                <div key={tier} className="mb-2">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize">{tier === "bronze" ? "Đồng" : tier === "silver" ? "Bạc" : tier === "gold" ? "Vàng" : tier}</span>
                    <span>{formatNum(count)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full" style={{
                      width: `${data.totalCustomers > 0 ? (count / data.totalCustomers) * 100 : 0}%`,
                      backgroundColor: tier === "bronze" ? "#d97706" : tier === "silver" ? "#6b7280" : tier === "gold" ? "#f59e0b" : "#8b5cf6"
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// ==================== GROUP 7: DỊCH VỤ SAU BÁN ====================
function GroupAfterSale({ data }: { data: DashboardData["afterSale"] }) {
  return (
    <section>
      <SectionTitle number={7} title="Dịch vụ sau bán" description="Phiếu sửa đang mở, bảo hành sắp hết hạn, yêu cầu thu cũ mới" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4">
        <StatCard title="Phiếu sửa đang mở" value={formatNum(data.openRepairs)} subtitle={`Tổng: ${formatNum(data.totalRepairTickets)}`} icon={WrenchIcon} trend={data.openRepairs > 0 ? "up" : undefined} />
        <StatCard title="Bảo hành sắp hết hạn" value={formatNum(data.expiringWarranties)} subtitle="Trong 30 ngày tới" icon={AwardIcon} trend={data.expiringWarranties > 0 ? "up" : undefined} />
        <StatCard title="Yêu cầu thu cũ mới" value={formatNum(data.pendingTradeIns)} subtitle="pending / evaluating" icon={TrendingUpIcon} trend={data.pendingTradeIns > 0 ? "up" : undefined} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-6"><CardTitle className="text-sm sm:text-base">Trạng thái sửa chữa</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0"><SimplePieChart data={data.repairStatusDist} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-6"><CardTitle className="text-sm sm:text-base">Trạng thái bảo hành</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0"><SimplePieChart data={data.warrantyStatusDist} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-6"><CardTitle className="text-sm sm:text-base">Trạng thái thu cũ</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0"><SimplePieChart data={data.tradeInStatusDist} /></CardContent>
        </Card>
      </div>
    </section>
  );
}

// ==================== GROUP 8: CA BÁN HÀNG ====================
function GroupPOS({ data }: { data: DashboardData["pos"] }) {
  return (
    <section>
      <SectionTitle number={8} title="Ca bán hàng" description="Doanh thu theo nhân viên, kiểm tiền cuối ca, chênh lệch quỹ" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4">
        <StatCard title="Ca POS đang mở" value={formatNum(data.openSessions)} subtitle={`Tổng ca: ${formatNum(data.totalSessions)}`} icon={DollarSignIcon} />
        <StatCard title="Ca chênh lệch quỹ" value={formatNum(data.diffCashSessions)} subtitle={`Tổng chênh lệch: ${formatMoney(data.totalDiffCash)}`} trend={data.diffCashSessions > 0 ? "down" : undefined} icon={AlertTriangleIcon} />
        <StatCard title="Tỉ lệ chênh lệch" value={data.totalSessions > 0 ? formatPct((data.diffCashSessions / data.totalSessions) * 100) : "0%"} subtitle="Số ca có diff / tổng" icon={PercentIcon} />
      </div>
      {data.topStaff.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="p-3 pb-2 sm:p-6 sm:pb-6"><CardTitle className="text-sm sm:text-base">Doanh thu theo nhân viên (Top 10)</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.topStaff} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => formatMoney(v)} />
                <YAxis type="category" dataKey="id" tick={{ fontSize: 11 }} width={180} tickFormatter={v => v.slice(0, 8) + "..."} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return <div className="rounded-lg border bg-background p-2 text-xs shadow"><p className="font-medium">{d.id}</p><p>DT: {formatMoney(d.revenue)} · Đơn: {d.orders}</p></div>;
                }} />
                <Bar dataKey="revenue" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

// ==================== SO SÁNH KỲ ====================
function ComparisonSection({ data }: { data: DashboardData }) {
  const { kpi } = data;
  const comparisons = [
    { label: "Doanh thu hôm nay", value: kpi.revenueToday, compare: kpi.revenueThisWeek / 7, unit: "money" },
    { label: "Đơn hàng hôm nay", value: kpi.ordersToday, compare: kpi.ordersThisWeek / 7, unit: "number" },
    { label: "Khách mới hôm nay", value: kpi.newCustomersToday, compare: kpi.newCustomersThisWeek / 7, unit: "number" },
  ] as const;

  return (
    <section>
      <SectionTitle number={0} title="So sánh kỳ" description="Hôm nay so với trung bình tuần này" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4">
        {comparisons.map((c) => {
          const diff = c.compare > 0 ? ((c.value - c.compare) / c.compare) * 100 : 0;
          const isUp = diff >= 0;
          const fmt = c.unit === "money" ? formatMoney : (n: number) => formatNum(Math.round(n));
          return (
            <Card key={c.label}>
              <CardHeader className="p-3 pb-1 sm:p-6 sm:pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">{c.label}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="text-lg font-bold leading-tight sm:text-2xl">{fmt(c.value)}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[11px] sm:mt-1 sm:text-xs">
                  {isUp ? <TrendingUpIcon className="h-3 w-3 shrink-0 text-green-500" /> : <TrendingDownIcon className="h-3 w-3 shrink-0 text-red-500" />}
                  <span className={isUp ? "text-green-600" : "text-red-600"}>{isUp ? "+" : ""}{diff.toFixed(1)}%</span>
                  <span className="text-muted-foreground">vs TB tuần ({fmt(c.compare)})</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// ==================== MAIN EXPORT ====================
export function DashboardContent() {
  const q = useQuery({
    queryKey: ["dashboard-stats-v2"],
    queryFn: () => httpGet<DashboardData>("/v1/dashboard/stats"),
    refetchInterval: 60_000,
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
        <GroupKPI kpi={data.kpi} />
        <ComparisonSection data={data} />
        <GroupRevenue data={data.revenue} />
        <GroupPayment data={data.payment} />
        <GroupProduct data={data.product} />
        <GroupInventory data={data.inventory} />
        <GroupCustomer data={data.customer} />
        <GroupAfterSale data={data.afterSale} />
        <GroupPOS data={data.pos} />
      </TabsContent>

      <TabsContent value="kpi" className="mt-0 space-y-6">
        <GroupKPI kpi={data.kpi} />
        <ComparisonSection data={data} />
      </TabsContent>

      <TabsContent value="revenue" className="mt-0">
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
        <GroupCustomer data={data.customer} />
      </TabsContent>

      <TabsContent value="aftersale" className="mt-0">
        <GroupAfterSale data={data.afterSale} />
      </TabsContent>

      <TabsContent value="pos" className="mt-0">
        <GroupPOS data={data.pos} />
      </TabsContent>
    </Tabs>
  );
}
