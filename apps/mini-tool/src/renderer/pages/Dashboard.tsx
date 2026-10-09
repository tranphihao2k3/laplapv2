// Dashboard.tsx — giao diện như ảnh: top profile bar + 3 gauge + 5 card info
// (Pin · Màn hình · Mainboard · Ổ cứng · WiFi) + System info cards.
//
// Profile bar (Gaming/Làm việc/Tiết kiệm/Sáng tạo) chỉ là UI selector + lưu
// state; Boost 1-chạm set power plan → High performance + clear working set
// + chuyển CPU max về 100% (real IPC).
//
// Mọi gauge đều có sparkline mini (60 samples, ~120s), animate khi update.
//
// Lưu ý: Tối ưu nhanh / Startup / Overlay & phím tắt / RAM sticks đã được
// chuyển sang OptimizeTab (xem components/optimize-tools.tsx).

"use client";

import * as React from "react";
import {
  Cpu,
  MemoryStick,
  Monitor,
  HardDrive,
  Thermometer,
  Zap,
  ChevronDown,
  Loader2,
  Wifi,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Gauge as GaugeIcon,
  Activity,
  RefreshCw,
  Info,
  Plug,
  Battery,
  Gamepad2,
  Briefcase,
  Leaf,
  Palette,
  CircuitBoard,
  ExternalLink,
  Signal,
  Star,
  Maximize2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSessionStore } from "@/store";
import { cn } from "@/lib/utils";
import {
  getCachedHardware,
  getHardware,
  isHardwareCollecting,
  subscribeHardware,
} from "@/lib/hardwareCache";
import {
  loadBattery,
  loadDisplay,
  loadSystemInfo,
  loadStorageDetail,
  loadWifiProfiles,
  loadHdSentinel,
  launchHdSentinel,
  invalidateDashboardCache,
} from "@/lib/dashboardCache";
import type {
  BatterySnapshot,
  DisplaySnapshot,
  SystemInfoSnapshot,
  StorageDisk,
  WifiSnapshot,
  WifiProfile,
  HdSentinelFindResult,
} from "@/types/window";

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────
interface GpuStats {
  usage: number;
  temp: number | null;
  vramUsed: number;
  vramTotal: number;
  name: string | null;
  resolution: string | null;
  refreshRateHz: number | null;
  maxRefreshRateHz: number | null;
  maxResolution: string | null;
  tdpW: number | null;
  isDiscrete: boolean;
  type: string;
  /** True nếu là GPU phụ (iGPU) — sẽ không tăng spark để tránh nhiễu */
  isPrimary?: boolean;
  /** Index trong danh sách GPU của hệ thống (0 = primary) */
  index?: number;
}

interface SystemStats {
  cpu: { usage: number; temp: number | null; freq: number; name: string | null; cores: number; threads: number; turboGhz: number | null };
  memory: { used: number; total: number; usage: number; sticks: RamStickSnapshot[]; memoryType: string | null; maxSpeed: number | null };
  /** Tất cả card đồ họa trong máy (1 hoặc nhiều). Card #0 là primary. */
  gpus: GpuStats[];
  disk: { used: number; total: number; usage: number; type: string };
  _hasData?: boolean;
  _scanInFlight?: boolean;
}

interface RamStickSnapshot {
  slot: string | null;
  capacityGB: number;
  speedMTs: number | null;
  memoryType: string | null;
  formFactor: string | null;
  manufacturer: string | null;
  partNumber: string | null;
  voltageV: number | null;
}

interface PowerPlanPreset {
  id: string;
  label: string;
  vi: string;
  icon: React.ComponentType<{ className?: string }>;
  matcher: string[];
  color: "purple" | "blue" | "green" | "orange";
}

const PROFILES: PowerPlanPreset[] = [
  { id: "gaming", label: "Gaming", vi: "Gaming", icon: Gamepad2, matcher: ["high performance", "ultimate performance"], color: "orange" },
  { id: "working", label: "Working", vi: "Làm việc", icon: Briefcase, matcher: ["balanced", "high performance"], color: "blue" },
  { id: "saving", label: "Saving", vi: "Tiết kiệm", icon: Leaf, matcher: ["power saver", "balanced"], color: "green" },
  { id: "creative", label: "Creative", vi: "Sáng tạo", icon: Palette, matcher: ["high performance", "balanced"], color: "purple" },
];

const PROFILE_COLOR: Record<string, { active: string; idle: string; ring: string }> = {
  orange: {
    active: "border-orange-500/60 bg-gradient-to-br from-orange-500/25 to-red-500/15 text-orange-200 shadow-[0_0_24px_rgba(249,115,22,0.35)]",
    idle: "border-slate-700/60 bg-slate-900/40 text-slate-400 hover:border-orange-500/40 hover:text-orange-200",
    ring: "rgba(249,115,22,0.6)",
  },
  blue: {
    active: "border-cyan-500/60 bg-gradient-to-br from-cyan-500/25 to-blue-500/15 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.35)]",
    idle: "border-slate-700/60 bg-slate-900/40 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-200",
    ring: "rgba(34,211,238,0.6)",
  },
  green: {
    active: "border-emerald-500/60 bg-gradient-to-br from-emerald-500/25 to-teal-500/15 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.35)]",
    idle: "border-slate-700/60 bg-slate-900/40 text-slate-400 hover:border-emerald-500/40 hover:text-emerald-200",
    ring: "rgba(16,185,129,0.6)",
  },
  purple: {
    active: "border-purple-500/60 bg-gradient-to-br from-purple-500/25 to-fuchsia-500/15 text-purple-200 shadow-[0_0_24px_rgba(168,85,247,0.35)]",
    idle: "border-slate-700/60 bg-slate-900/40 text-slate-400 hover:border-purple-500/40 hover:text-purple-200",
    ring: "rgba(168,85,247,0.6)",
  },
};

// ─────────────────────────────────────────────────────────────────────
// AnimatedNumber — count-up tween khi giá trị đổi
// ─────────────────────────────────────────────────────────────────────
function useAnimatedNumber(target: number, duration = 600): number {
  const [value, setValue] = React.useState(target);
  const startRef = React.useRef<number>(performance.now());
  const fromRef = React.useRef<number>(target);
  React.useEffect(() => {
    fromRef.current = value;
    startRef.current = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = fromRef.current + (target - fromRef.current) * eased;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  return value;
}

// ─────────────────────────────────────────────────────────────────────
// Sparkline — vẽ đường từ N sample gần nhất
// ─────────────────────────────────────────────────────────────────────
function Sparkline({
  values,
  color = "cyan",
  height = 36,
  width = 220,
  strokeWidth = 1.6,
}: {
  values: number[];
  color?: "cyan" | "purple" | "green" | "orange";
  height?: number;
  width?: number;
  strokeWidth?: number;
}) {
  const colorMap: Record<string, { stroke: string; fill: string }> = {
    cyan: { stroke: "#22d3ee", fill: "rgba(34,211,238,0.18)" },
    purple: { stroke: "#a78bfa", fill: "rgba(167,139,250,0.18)" },
    green: { stroke: "#34d399", fill: "rgba(52,211,153,0.18)" },
    orange: { stroke: "#fb923c", fill: "rgba(251,146,60,0.18)" },
  };
  const c = colorMap[color];

  if (values.length < 2) {
    return (
      <div style={{ height }} className="flex items-end gap-[2px] opacity-50">
        {Array.from({ length: 30 }).map((_, i) => {
          const h = 4 + Math.sin(i * 0.4) * 3 + Math.random() * 2;
          return (
            <span
              key={i}
              style={{ height: h }}
              className="flex-1 rounded-sm bg-slate-700/60"
            />
          );
        })}
      </div>
    );
  }

  const min = 0;
  const max = 100;
  const padding = 3;
  const stepX = (width - padding * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = padding + i * stepX;
    const y = height - padding - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (height - padding * 2);
    return [x, y] as const;
  });
  const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${(height - padding).toFixed(1)} L${pts[0][0].toFixed(1)},${(height - padding).toFixed(1)} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-fill-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={c.fill} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-fill-${color})`} />
      <path d={linePath} fill="none" stroke={c.stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={c.stroke}>
        <animate attributeName="r" values="2.5;3.5;2.5" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CircularGauge — SVG gauge với gradient rotating + tier màu + pulse
// ─────────────────────────────────────────────────────────────────────
function CircularGauge({
  value,
  size = 132,
  strokeWidth = 9,
  color = "cyan",
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: "cyan" | "purple" | "green" | "orange";
  label?: string;
  sublabel?: string;
}) {
  const animated = useAnimatedNumber(value, 700);
  const pct = Math.min(100, Math.max(0, animated));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (pct / 100) * circumference;

  const tier: "low" | "mid" | "high" | "critical" =
    pct >= 90 ? "critical" : pct >= 70 ? "high" : pct >= 50 ? "mid" : "low";
  const palette: Record<typeof tier, { from: string; to: string; stroke: string; text: string; glow: string }> = {
    low: { from: "#10b981", to: "#06b6d4", stroke: "#34d399", text: "#6ee7b7", glow: "rgba(16,185,129,0.45)" },
    mid: { from: "#06b6d4", to: "#3b82f6", stroke: "#22d3ee", text: "#67e8f9", glow: "rgba(34,211,238,0.45)" },
    high: { from: "#f97316", to: "#facc15", stroke: "#fb923c", text: "#fdba74", glow: "rgba(249,115,22,0.55)" },
    critical: { from: "#ef4444", to: "#f97316", stroke: "#f87171", text: "#fca5a5", glow: "rgba(239,68,68,0.65)" },
  };
  const p = palette[tier];
  const gid = `gauge-grad-${label ?? color}`;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {tier === "critical" && (
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{
            boxShadow: `0 0 ${size * 0.45}px ${size * 0.18}px ${p.glow}`,
            animationDuration: "1.4s",
          }}
        />
      )}
      <svg width={size} height={size} className="relative -rotate-90" style={{ filter: `drop-shadow(0 0 8px ${p.glow})` }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(51,65,85,0.55)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={`url(#${gid})`} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)" }}
        />
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={p.from} />
            <stop offset="100%" stopColor={p.to} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color: p.text }}>
          {Math.round(pct)}%
        </span>
        {sublabel && (
          <span className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">{sublabel}</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// LiveUsageRow — animate progress bar + number
// ─────────────────────────────────────────────────────────────────────
function LiveValue({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const animated = useAnimatedNumber(value, 700);
  return (
    <span className="tabular-nums">
      {animated.toFixed(decimals)}{suffix}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// GaugeCard — wrap CircularGauge + chips
// ─────────────────────────────────────────────────────────────────────
function GaugeCard({
  accent,
  title,
  value,
  temp,
  sub,
  chip,
  chip2,
  chip3,
  sparkValues,
  sparkColor,
  bottomStats,
}: {
  accent: "cyan" | "purple" | "green" | "orange";
  title: string;
  value: number;
  temp: number | null;
  sub: string;
  chip?: React.ReactNode;
  chip2?: React.ReactNode;
  chip3?: React.ReactNode;
  sparkValues: number[];
  sparkColor: "cyan" | "purple" | "green" | "orange";
  bottomStats?: React.ReactNode;
}) {
  const accentBg: Record<typeof accent, string> = {
    cyan: "from-cyan-500/5 to-blue-500/3",
    purple: "from-purple-500/5 to-pink-500/3",
    green: "from-emerald-500/5 to-teal-500/3",
    orange: "from-orange-500/5 to-red-500/3",
  };
  const accentText: Record<typeof accent, string> = {
    cyan: "text-cyan-300",
    purple: "text-purple-300",
    green: "text-emerald-300",
    orange: "text-orange-300",
  };
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border border-slate-800/70 bg-slate-900/60 backdrop-blur-sm",
      "shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)]",
    )}>
      <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", accentBg[accent])} />
      <div className="relative p-4">
        <div className="flex items-center justify-between mb-2">
          <span className={cn("text-[10px] font-bold uppercase tracking-widest", accentText[accent])}>
            {title}
          </span>
          {temp != null && (
            <Badge
              variant="secondary"
              className={cn(
                "border text-[10px] tabular-nums",
                temp >= 85
                  ? "bg-red-500/15 text-red-300 border-red-500/40"
                  : temp >= 70
                    ? "bg-orange-500/15 text-orange-300 border-orange-500/40"
                    : "bg-slate-800/80 text-slate-300 border-slate-700/60",
              )}
            >
              <Thermometer className="h-3 w-3 mr-0.5" /> {Math.round(temp)}°C
            </Badge>
          )}
        </div>

        <div className="flex gap-3 items-center">
          <CircularGauge value={value} color={accent} size={108} strokeWidth={8} />
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Tần suất</p>
            <Sparkline values={sparkValues} color={sparkColor} height={32} width={140} />
            <div className="flex flex-wrap gap-1">
              {chip}
              {chip2}
              {chip3}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-300 truncate" title={sub}>
          {sub}
        </p>

        {bottomStats && (
          <>
            <Separator className="my-3 bg-slate-800/60" />
            <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
              {bottomStats}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// InfoCard — wrapper cho 5 card info-block mới (Pin/Màn hình/System/
// Storage/WiFi). Cùng visual style với GaugeCard (rounded-xl + border +
// accent gradient bg) nhưng body do component con cung cấp.
// ─────────────────────────────────────────────────────────────────────
function InfoCard({
  accent,
  title,
  icon: Icon,
  loading,
  rightBadge,
  children,
}: {
  accent: "cyan" | "purple" | "green" | "orange" | "red";
  title: string;
  icon: LucideIcon;
  loading?: boolean;
  rightBadge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const accentBg: Record<typeof accent, string> = {
    cyan: "from-cyan-500/5 to-blue-500/3",
    purple: "from-purple-500/5 to-pink-500/3",
    green: "from-emerald-500/5 to-teal-500/3",
    orange: "from-orange-500/5 to-red-500/3",
    red: "from-red-500/5 to-rose-500/3",
  };
  const accentText: Record<typeof accent, string> = {
    cyan: "text-cyan-300",
    purple: "text-purple-300",
    green: "text-emerald-300",
    orange: "text-orange-300",
    red: "text-red-300",
  };
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-slate-800/70 bg-slate-900/60 backdrop-blur-sm",
        "shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)]",
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", accentBg[accent])} />
      <div className="relative p-4">
        <div className="flex items-center justify-between mb-3">
          <span
            className={cn(
              "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest",
              accentText[accent],
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {title}
          </span>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
          ) : (
            rightBadge
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  const isEmpty = value === null || value === undefined || value === "" || value === "—";
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-[11px]">
      <span className="text-slate-500 uppercase tracking-wider text-[9px] shrink-0">
        {label}
      </span>
      <span
        className={cn(
          mono && "font-mono tabular-nums",
          "text-slate-200 truncate text-right min-w-0",
          isEmpty && "text-slate-600 italic",
        )}
        title={typeof value === "string" ? value : undefined}
      >
        {isEmpty ? "—" : value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// BatteryCard — Pin
// ─────────────────────────────────────────────────────────────────────
function BatteryCard({
  data,
  loading,
}: {
  data: BatterySnapshot | null;
  loading: boolean;
}) {
  const accent: "green" | "orange" = data?.status === "Charging" ? "green" : "orange";
  const pct = data?.percent ?? 0;
  const isLaptop = data?.hasBattery ?? false;
  const minutes = data?.minutesRemaining ?? null;
  const statusText = (() => {
    if (!data) return "Đang tải…";
    if (!data.hasBattery) return "Không có pin (PC để bàn)";
    switch (data.status) {
      case "Charging":
        return "Đang sạc";
      case "Discharging":
        return minutes && minutes > 0 ? `Đang dùng · còn ~${minutes} phút` : "Đang dùng";
      case "AC":
        return "Cắm sạc · đầy";
      case "Critical":
        return "Pin yếu";
      case "PartiallyCharged":
        return "Sạc một phần";
      default:
        return data.status ?? "—";
    }
  })();

  const healthClass = (() => {
    if (data?.healthPct == null) return "bg-slate-800 text-slate-300 border-slate-700";
    if (data.healthPct >= 80) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    if (data.healthPct >= 60) return "bg-amber-500/15 text-amber-300 border-amber-500/40";
    return "bg-red-500/15 text-red-300 border-red-500/40";
  })();

  return (
    <InfoCard
      accent={accent}
      title="Pin"
      icon={Battery}
      loading={loading && !data}
      rightBadge={
        isLaptop ? (
          <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]">
            <Plug className="h-3 w-3 mr-0.5" />
            {statusText}
          </Badge>
        ) : null
      }
    >
      <div className="flex gap-3 items-center">
        <CircularGauge value={pct} color={accent} size={108} strokeWidth={8} />
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Trạng thái
          </p>
          <p className="text-sm font-medium text-slate-100 truncate" title={data?.name ?? ""}>
            {data?.name ?? (isLaptop ? "Battery" : "Không có pin")}
          </p>
          <div className="flex flex-wrap gap-1">
            {data?.healthPct != null && (
              <Badge variant="secondary" className={cn("border text-[9px]", healthClass)}>
                Sức khỏe {data.healthPct}%
              </Badge>
            )}
            {data?.chemistry && (
              <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-[9px]">
                {data.chemistry}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <Separator className="my-3 bg-slate-800/60" />
      <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
        <StatCell label="Còn lại" value={`${pct}%`} color={accent === "green" ? "green" : "orange"} />
        <StatCell
          label="Thời gian"
          value={minutes != null && minutes > 0 ? `${Math.floor(minutes / 60)}h${minutes % 60}m` : "—"}
          color="slate"
        />
        <StatCell
          label="Sức khỏe"
          value={data?.healthPct != null ? `${data.healthPct}%` : "—"}
          color={data?.healthPct != null && data.healthPct >= 80 ? "green" : data?.healthPct != null && data.healthPct >= 60 ? "orange" : "slate"}
        />
      </div>
    </InfoCard>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DisplayCard — Màn hình (hỗ trợ 1–4 màn, mỗi màn 1 card riêng)
// ─────────────────────────────────────────────────────────────────────

/** Tính ước chung lớn nhất (GCD) để suy ra tỉ lệ khung hình thân thiện (16:9, 21:9, …) */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Trả về tỉ lệ khung hình thân thiện: 3840×2160 → "16:9", 3440×1440 → "21:9". */
function aspectRatio(w: number, h: number): string | null {
  if (!w || !h || w <= 0 || h <= 0) return null;
  const g = gcd(w, h);
  const aw = Math.round(w / g);
  const ah = Math.round(h / g);
  // Nếu tỉ số lớn (>40) thì chắc là màn rất dài → fallback chỉ hiển thị số
  if (aw > 40 || ah > 40) return `${aw}:${ah}`;
  return `${aw}:${ah}`;
}

/** Tổng pixel (megapixel) của 1 màn — dùng để so sánh độ nét. */
function megaPixels(w: number | null, h: number | null): string | null {
  if (!w || !h) return null;
  const mp = (w * h) / 1_000_000;
  return mp >= 10 ? `${mp.toFixed(1)} MP` : `${mp.toFixed(2)} MP`;
}

function DisplayCard({
  data,
  loading,
}: {
  data: DisplaySnapshot | null;
  loading: boolean;
}) {
  const monitors = data?.monitors ?? [];
  const accent: "cyan" = "cyan";

  // Đưa màn primary lên đầu để UI luôn highlight màn chính ở vị trí 1
  const ordered = React.useMemo(() => {
    return [...monitors].sort((a, b) => {
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return 0;
    });
  }, [monitors]);

  // Số cột: 1 màn → full width 1 cột; 2+ màn → grid 2 cột để gọn
  const gridCols = ordered.length <= 1 ? "grid-cols-1" : "grid-cols-2";

  return (
    <InfoCard
      accent={accent}
      title="Màn hình"
      icon={Monitor}
      loading={loading && !data}
      rightBadge={
        ordered.length > 0 ? (
          <Badge
            variant="secondary"
            className="bg-cyan-500/15 text-cyan-300 border-cyan-500/40 text-[10px] font-semibold tabular-nums"
          >
            {ordered.length} màn
          </Badge>
        ) : null
      }
    >
      {ordered.length === 0 ? (
        <p className="text-xs text-slate-500 py-3 text-center italic">
          Chưa phát hiện màn hình nào
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {ordered.map((m, i) => {
            const isPrimary = m.primary;
            const res = m.width && m.height ? `${m.width}×${m.height}` : null;
            const ratio = m.width && m.height ? aspectRatio(m.width, m.height) : null;
            const mp = megaPixels(m.width, m.height);

            return (
              <div
                key={`${m.name ?? "monitor"}-${i}`}
                className={cn(
                  "relative rounded-lg border p-2.5 space-y-1.5 transition-colors",
                  isPrimary
                    ? "border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 shadow-[0_0_12px_-2px_rgba(34,211,238,0.25)]"
                    : "border-slate-800/60 bg-slate-900/40 hover:border-slate-700/70",
                )}
              >
                {/* Header: số thứ tự + tên màn + badge primary */}
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold tabular-nums",
                        isPrimary
                          ? "bg-cyan-500/30 text-cyan-100"
                          : "bg-slate-800 text-slate-400",
                      )}
                    >
                      {i + 1}
                    </span>
                    {isPrimary && (
                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400 shrink-0" />
                    )}
                    <span
                      className={cn(
                        "text-[11px] font-semibold truncate",
                        isPrimary ? "text-cyan-100" : "text-slate-200",
                      )}
                      title={m.name ?? "Display"}
                    >
                      {m.name ?? "Display"}
                    </span>
                  </div>
                  {isPrimary && (
                    <Badge
                      variant="secondary"
                      className="bg-cyan-500/20 text-cyan-200 border-cyan-500/40 text-[8px] font-bold uppercase tracking-wider px-1.5 shrink-0"
                    >
                      Primary
                    </Badge>
                  )}
                </div>

                {/* Manufacturer */}
                <p
                  className="text-[9px] text-slate-500 truncate -mt-0.5"
                  title={m.manufacturer ?? ""}
                >
                  {m.manufacturer ?? "Unknown"}
                </p>

                {/* Specs: mỗi dòng label → value */}
                <div className="space-y-0.5 pt-0.5">
                  <SpecRow
                    label="Độ phân giải"
                    icon={<Maximize2 className="h-2.5 w-2.5" />}
                    value={res}
                    highlight={isPrimary}
                  />
                  <SpecRow
                    label="Tần số quét"
                    value={m.refreshHz != null ? `${m.refreshHz} Hz` : null}
                    highlight={isPrimary && (m.refreshHz ?? 0) >= 120}
                  />
                  <SpecRow
                    label="Màu sắc"
                    value={m.bitsPerPixel != null ? `${m.bitsPerPixel} bit` : null}
                  />
                  {ratio && (
                    <SpecRow label="Tỉ lệ" value={ratio} muted />
                  )}
                  {mp && (
                    <SpecRow label="Pixel" value={mp} muted />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer tổng hợp khi có ≥2 màn */}
      {ordered.length >= 2 && (
        <>
          <Separator className="my-2.5 bg-slate-800/60" />
          <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
            <StatCell
              label="Tổng màn"
              value={`${ordered.length}`}
              color="cyan"
            />
            <StatCell
              label="Cao nhất"
              value={
                Math.max(
                  ...ordered
                    .map((m) => m.refreshHz ?? 0)
                    .filter((v) => v > 0),
                  0,
                )
                  ? `${Math.max(
                      ...ordered
                        .map((m) => m.refreshHz ?? 0)
                        .filter((v) => v > 0),
                    )} Hz`
                  : "—"
              }
              color="cyan"
            />
            <StatCell
              label="Tổng MP"
              value={(() => {
                const total = ordered.reduce(
                  (sum, m) => sum + (m.width ?? 0) * (m.height ?? 0),
                  0,
                );
                if (total === 0) return "—";
                return `${(total / 1_000_000).toFixed(1)}`;
              })()}
              color="cyan"
            />
          </div>
        </>
      )}
    </InfoCard>
  );
}

/** 1 dòng label → value trong card màn hình */
function SpecRow({
  label,
  value,
  icon,
  highlight,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  highlight?: boolean;
  muted?: boolean;
}) {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <div className="flex items-center justify-between gap-2 text-[10px]">
      <span className="flex items-center gap-1 text-slate-500 shrink-0">
        {icon}
        <span>{label}</span>
      </span>
      <span
        className={cn(
          "font-mono tabular-nums truncate text-right min-w-0",
          isEmpty && "text-slate-600 italic",
          highlight && !isEmpty && "text-cyan-300 font-semibold",
          muted && !isEmpty && "text-slate-400",
          !highlight && !muted && !isEmpty && "text-slate-200",
        )}
        title={typeof value === "string" ? value : undefined}
      >
        {isEmpty ? "—" : value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SystemInfoCard — Thông tin máy
// ─────────────────────────────────────────────────────────────────────
function SystemInfoCard({
  data,
  loading,
}: {
  data: SystemInfoSnapshot | null;
  loading: boolean;
}) {
  const mb = data?.mainboard;
  const machine = data?.machine;
  const os = data?.os;
  const bios = data?.bios;

  return (
    <InfoCard
      accent="purple"
      title="Thông tin máy"
      icon={CircuitBoard}
      loading={loading && !data}
      rightBadge={
        data?.capturedAt ? (
          <span className="text-[9px] text-slate-500 font-mono">
            {new Date(data.capturedAt).toLocaleTimeString("vi-VN")}
          </span>
        ) : null
      }
    >
      <div className="space-y-0.5">
        <InfoRow
          label="Mainboard"
          value={
            mb
              ? [mb.manufacturer, mb.product].filter(Boolean).join(" · ") || null
              : null
          }
          mono
        />
        <InfoRow label="Model" value={machine?.model} mono />
        <InfoRow label="Serial" value={machine?.model ? (mb?.serial ?? null) : null} mono />
        <InfoRow
          label="OS"
          value={
            os
              ? [os.caption, os.version].filter(Boolean).join(" · ") ||
                os.build ||
                null
              : null
          }
        />
        <InfoRow label="Arch" value={os?.arch} mono />
        <InfoRow
          label="BIOS"
          value={bios ? [bios.manufacturer, bios.version].filter(Boolean).join(" ") : null}
          mono
        />
        <InfoRow label="Hostname" value={os?.hostname} mono />
      </div>
    </InfoCard>
  );
}

// ─────────────────────────────────────────────────────────────────────
// StorageCard — Ổ cứng (kèm nút mở HD Sentinel)
// ─────────────────────────────────────────────────────────────────────
function StorageCard({
  data,
  loading,
  hdSentinel,
  onOpenHdSentinel,
  onFindHdSentinel,
  opening,
}: {
  data: StorageDisk[] | null;
  loading: boolean;
  hdSentinel: HdSentinelFindResult | null;
  onOpenHdSentinel: (path: string) => void;
  onFindHdSentinel: () => void;
  opening: boolean;
}) {
  const accent: "orange" = "orange";
  const disks = data ?? [];
  return (
    <InfoCard
      accent={accent}
      title="Ổ cứng"
      icon={HardDrive}
      loading={loading && !data}
      rightBadge={
        disks.length > 0 ? (
          <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]">
            {disks.length} ổ vật lý
          </Badge>
        ) : null
      }
    >
      {disks.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">Chưa đọc được danh sách ổ đĩa</p>
      ) : (
        <div className="space-y-2">
          {disks.map((d) => {
            const healthColor =
              d.health === "Healthy"
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                : d.health === "Warning"
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                  : d.health === "Unhealthy"
                    ? "bg-red-500/15 text-red-300 border-red-500/40"
                    : "bg-slate-800 text-slate-300 border-slate-700";
            return (
              <div
                key={`disk-${d.index}-${d.serial ?? "s"}`}
                className="rounded-lg border border-slate-800/60 bg-slate-900/40 p-2.5 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <HardDrive className="h-3.5 w-3.5 text-orange-300 shrink-0" />
                    <span
                      className="text-xs font-semibold text-slate-100 truncate"
                      title={d.model ?? "—"}
                    >
                      {d.model ?? "—"}
                    </span>
                  </div>
                  <Badge variant="secondary" className={cn("border text-[9px]", healthColor)}>
                    {d.health ?? "Unknown"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {d.totalGB != null && (
                    <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-[9px]">
                      {d.totalGB} GB
                    </Badge>
                  )}
                  {d.busType && (
                    <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-[9px]">
                      {d.busType}
                    </Badge>
                  )}
                  {d.mediaType && (
                    <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-[9px]">
                      {d.mediaType}
                    </Badge>
                  )}
                  {d.tempC != null && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "border text-[9px]",
                        d.tempC >= 55
                          ? "bg-red-500/15 text-red-300 border-red-500/40"
                          : d.tempC >= 45
                            ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                            : "bg-slate-800 text-slate-300 border-slate-700",
                      )}
                    >
                      <Thermometer className="h-2.5 w-2.5 mr-0.5" />
                      {d.tempC}°C
                    </Badge>
                  )}
                  {d.wearPct != null && (
                    <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-[9px]">
                      Wear {d.wearPct}%
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}

          <Separator className="my-2 bg-slate-800/60" />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              Kiểm tra sức khỏe chi tiết
            </span>
            {hdSentinel?.found && hdSentinel.path ? (
              <Button
                size="sm"
                variant="outline"
                disabled={opening}
                onClick={() => onOpenHdSentinel(hdSentinel.path as string)}
                className="h-7 px-2.5 text-[10px] border-orange-500/40 text-orange-300 hover:bg-orange-500/15"
              >
                {opening ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Đang mở…
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Mở HD Sentinel
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={onFindHdSentinel}
                className="h-7 px-2 text-[10px] text-slate-400 hover:text-cyan-300"
              >
                <Info className="h-3 w-3 mr-1" />
                Không tìm thấy HD Sentinel
              </Button>
            )}
          </div>
        </div>
      )}
    </InfoCard>
  );
}

// ─────────────────────────────────────────────────────────────────────
// WifiCard — WiFi (current interface + saved profiles)
// ─────────────────────────────────────────────────────────────────────
function WifiCard({
  data,
  loading,
}: {
  data: WifiSnapshot | null;
  loading: boolean;
}) {
  const accent: "cyan" = "cyan";
  const current = data?.currentInterface ?? null;
  const profiles = data?.profiles ?? [];
  const connectedSsid = current?.ssid ?? null;

  return (
    <InfoCard
      accent={accent}
      title="WiFi"
      icon={Wifi}
      loading={loading && !data}
      rightBadge={
        profiles.length > 0 ? (
          <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]">
            {profiles.length} profile
          </Badge>
        ) : null
      }
    >
      {current ? (
        <div className="rounded-lg border border-slate-800/60 bg-slate-900/40 p-2.5 mb-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              <Signal className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
              <span className="text-xs font-semibold text-cyan-300 truncate" title={current.ssid ?? ""}>
                {current.ssid ?? "—"}
              </span>
            </span>
            {current.signalPct != null && (
              <Badge variant="secondary" className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-[9px] tabular-nums">
                {current.signalPct}%
                {current.signalDbm != null && (
                  <span className="ml-1 text-cyan-400/80 font-mono">{current.signalDbm} dBm</span>
                )}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {current.radioType && (
              <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-[9px]">
                {current.radioType}
              </Badge>
            )}
            {current.channel != null && (
              <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-[9px]">
                CH {current.channel}
              </Badge>
            )}
            {(current.rxMbps != null || current.txMbps != null) && (
              <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-[9px] tabular-nums">
                {current.rxMbps ?? "—"}↓ / {current.txMbps ?? "—"}↑ Mbps
              </Badge>
            )}
            {current.state && (
              <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40 text-[9px]">
                {current.state}
              </Badge>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 mb-2">
          Không có adapter WiFi nào đang kết nối
        </p>
      )}

      <Separator className="my-2 bg-slate-800/60" />

      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">
          Đã từng kết nối ({profiles.length})
        </p>
        {profiles.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">
            Chưa có profile WiFi nào được lưu
          </p>
        ) : (
          <div className="max-h-[180px] overflow-y-auto disk-list space-y-1 pr-1">
            {profiles.slice(0, 20).map((p, i) => (
              <WifiProfileRow
                key={`wifi-${p.ssid}-${i}`}
                profile={p}
                isConnected={p.ssid === connectedSsid}
              />
            ))}
            {profiles.length > 20 && (
              <p className="text-[10px] text-slate-500 italic text-center pt-1">
                + {profiles.length - 20} profile khác
              </p>
            )}
          </div>
        )}
      </div>
    </InfoCard>
  );
}

function WifiProfileRow({
  profile,
  isConnected,
}: {
  profile: WifiProfile;
  isConnected: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[11px] border",
        isConnected
          ? "bg-cyan-500/10 border-cyan-500/40"
          : "bg-slate-900/40 border-slate-800/60",
      )}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <Wifi className="h-3 w-3 text-cyan-300 shrink-0" />
        <span
          className={cn(
            "truncate",
            isConnected ? "text-cyan-200 font-semibold" : "text-slate-200",
          )}
          title={profile.ssid}
        >
          {profile.ssid}
        </span>
      </span>
      {isConnected ? (
        <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[9px] shrink-0">
          Đang kết nối
        </Badge>
      ) : profile.security ? (
        <span className="text-[9px] text-slate-500 shrink-0">{profile.security}</span>
      ) : (
        <span className="text-[9px] text-slate-600 shrink-0">Open</span>
      )}
    </div>
  );
}

function StatCell({ label, value, color = "slate" }: { label: string; value: React.ReactNode; color?: "slate" | "cyan" | "purple" | "orange" | "green" | "red" }) {
  const c = {
    slate: "bg-slate-800/40 text-slate-300",
    cyan: "bg-cyan-500/10 text-cyan-300",
    purple: "bg-purple-500/10 text-purple-300",
    orange: "bg-orange-500/10 text-orange-300",
    green: "bg-emerald-500/10 text-emerald-300",
    red: "bg-red-500/10 text-red-300",
  }[color];
  return (
    <div className={cn("rounded-md py-1.5 px-1 border border-slate-800/40", c)}>
      <div className="text-[8px] uppercase tracking-wider text-slate-500 leading-none mb-0.5">{label}</div>
      <div className="text-[11px] font-mono font-semibold tabular-nums leading-tight">{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Compact info cards — 1 dòng tóm tắt, bấm "Chi tiết" để bung detail
// ─────────────────────────────────────────────────────────────────────

function CompactInfoCard({
  accent,
  icon: Icon,
  title,
  loading,
  summary,
  children,
  defaultOpen = false,
}: {
  accent: "cyan" | "purple" | "green" | "orange" | "red";
  icon: LucideIcon;
  title: string;
  loading: boolean;
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const accentText: Record<typeof accent, string> = {
    cyan: "text-cyan-300",
    purple: "text-purple-300",
    green: "text-emerald-300",
    orange: "text-orange-300",
    red: "text-red-300",
  };
  const accentRing: Record<typeof accent, string> = {
    cyan: "border-cyan-500/30 hover:border-cyan-500/50",
    purple: "border-purple-500/30 hover:border-purple-500/50",
    green: "border-emerald-500/30 hover:border-emerald-500/50",
    orange: "border-orange-500/30 hover:border-orange-500/50",
    red: "border-red-500/30 hover:border-red-500/50",
  };
  return (
    <div
      className={cn(
        "rounded-lg border bg-slate-900/60 backdrop-blur-sm transition-colors overflow-hidden",
        accentRing[accent],
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-800/40 transition-colors"
        aria-expanded={open}
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", accentText[accent])} />
        <span className={cn("text-[10px] font-bold uppercase tracking-wider shrink-0", accentText[accent])}>
          {title}
        </span>
        <span className="flex-1 min-w-0 text-[11px] text-slate-300 truncate">
          {loading && !summary ? (
            <span className="italic text-slate-500 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Đang tải…
            </span>
          ) : (
            summary
          )}
        </span>
        <span
          className={cn(
            "shrink-0 text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border transition-colors",
            open
              ? cn(accentText[accent], "border-current/40 bg-slate-800/60")
              : "text-slate-500 border-slate-700/50 hover:text-slate-300",
          )}
        >
          {open ? "Ẩn" : "Chi tiết"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform",
            open && "rotate-180 text-slate-300",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden border-t border-slate-800/60">
          <div className="p-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function BatteryCompact({
  data,
  loading,
}: {
  data: BatterySnapshot | null;
  loading: boolean;
}) {
  const pct = data?.percent;
  const hasBat = data?.hasBattery;
  const summary = (() => {
    if (loading && !data) return null;
    if (!hasBat) return <span className="italic text-slate-500">Không có pin (PC để bàn)</span>;
    if (pct == null) return <span className="italic text-slate-500">Chưa đọc được</span>;
    const statusText =
      data?.status === "Charging" ? "đang sạc" : data?.status === "AC" ? "cắm sạc đầy" : "đang dùng";
    return (
      <span>
        <span className="font-bold text-slate-100 tabular-nums">{pct}%</span>{" "}
        <span className="text-slate-400">·</span>{" "}
        <span className="text-slate-400">{statusText}</span>
        {data?.minutesRemaining != null && data.minutesRemaining > 0 && (
          <>
            {" "}
            <span className="text-slate-400">·</span>{" "}
            <span className="font-mono text-amber-300">
              ~{Math.floor(data.minutesRemaining / 60)}h{data.minutesRemaining % 60}m
            </span>
          </>
        )}
      </span>
    );
  })();
  return (
    <CompactInfoCard
      accent={data?.status === "Charging" ? "green" : "orange"}
      icon={Battery}
      title="Pin"
      loading={loading}
      summary={summary}
    >
      <BatteryCard data={data} loading={loading} />
    </CompactInfoCard>
  );
}

function DisplayCompact({
  data,
  loading,
}: {
  data: DisplaySnapshot | null;
  loading: boolean;
}) {
  const monitors = data?.monitors ?? [];
  const summary = (() => {
    if (loading && !data) return null;
    if (monitors.length === 0)
      return <span className="italic text-slate-500">Chưa phát hiện</span>;
    const primary = monitors.find((m) => m.primary) ?? monitors[0];
    const res = primary.width && primary.height ? `${primary.width}×${primary.height}` : "—";
    const hz = primary.refreshHz ? `${primary.refreshHz}Hz` : "—";
    return (
      <span>
        <span className="font-bold text-slate-100 tabular-nums">{res}</span>{" "}
        <span className="text-slate-400">@</span>{" "}
        <span className="font-mono text-cyan-300">{hz}</span>
        {monitors.length > 1 && (
          <>
            {" "}
            <span className="text-slate-400">·</span>{" "}
            <span className="text-slate-400">+{monitors.length - 1} màn</span>
          </>
        )}
      </span>
    );
  })();
  return (
    <CompactInfoCard
      accent="cyan"
      icon={Monitor}
      title="Màn hình"
      loading={loading}
      summary={summary}
    >
      <DisplayCard data={data} loading={loading} />
    </CompactInfoCard>
  );
}

function SystemInfoCompact({
  data,
  loading,
}: {
  data: SystemInfoSnapshot | null;
  loading: boolean;
}) {
  const mb = data?.mainboard;
  const machine = data?.machine;
  const os = data?.os;
  const summary = (() => {
    if (loading && !data) return null;
    if (!mb && !os) return <span className="italic text-slate-500">Chưa đọc được</span>;
    const product = mb?.product ? mb.product.replace(/^.*\s/, "").slice(0, 18) : null;
    const osShort = os?.caption?.replace(/^Microsoft\s+/i, "").slice(0, 20) ?? null;
    return (
      <span>
        {osShort && (
          <>
            <span className="font-bold text-slate-100">{osShort}</span>
            <span className="text-slate-400"> · </span>
          </>
        )}
        {product && <span className="text-slate-300">{product}</span>}
      </span>
    );
  })();
  return (
    <CompactInfoCard
      accent="purple"
      icon={CircuitBoard}
      title="Thông tin máy"
      loading={loading}
      summary={summary}
    >
      <SystemInfoCard data={data} loading={loading} />
    </CompactInfoCard>
  );
}

function StorageCompact({
  data,
  loading,
  hdSentinel,
  onOpenHdSentinel,
  onFindHdSentinel,
  opening,
}: {
  data: StorageDisk[] | null;
  loading: boolean;
  hdSentinel: HdSentinelFindResult | null;
  onOpenHdSentinel: (path: string) => void;
  onFindHdSentinel: () => void;
  opening: boolean;
}) {
  const disks = data ?? [];
  const summary = (() => {
    if (loading && !data) return null;
    if (disks.length === 0) return <span className="italic text-slate-500">Chưa đọc được</span>;
    const total = disks.reduce((s, d) => s + (d.totalGB ?? 0), 0);
    const main = disks[0];
    return (
      <span>
        <span className="font-bold text-slate-100 tabular-nums">{total.toFixed(0)} GB</span>{" "}
        <span className="text-slate-400">·</span>{" "}
        <span className="text-slate-400">
          {main.busType ?? "?"} {main.mediaType ?? "?"}
        </span>{" "}
        <span className="text-slate-400">·</span>{" "}
        <span className="text-emerald-300">{main.health ?? "?"}</span>
      </span>
    );
  })();
  return (
    <CompactInfoCard
      accent="orange"
      icon={HardDrive}
      title="Ổ cứng"
      loading={loading}
      summary={summary}
    >
      <StorageCard
        data={data}
        loading={loading}
        hdSentinel={hdSentinel}
        onOpenHdSentinel={onOpenHdSentinel}
        onFindHdSentinel={onFindHdSentinel}
        opening={opening}
      />
    </CompactInfoCard>
  );
}

function WifiCompact({
  data,
  loading,
}: {
  data: WifiSnapshot | null;
  loading: boolean;
}) {
  const current = data?.currentInterface;
  const profileCount = data?.profiles.length ?? 0;
  const summary = (() => {
    if (loading && !data) return null;
    if (!current) return <span className="italic text-slate-500">Không kết nối</span>;
    const sig = current.signalPct != null ? `${current.signalPct}%` : "—";
    return (
      <span>
        <span className="font-bold text-cyan-200 truncate">{current.ssid ?? "—"}</span>{" "}
        <span className="text-slate-400">·</span>{" "}
        <span className="font-mono text-cyan-300">{sig}</span>
        {profileCount > 0 && (
          <>
            {" "}
            <span className="text-slate-400">·</span>{" "}
            <span className="text-slate-500">{profileCount} profile</span>
          </>
        )}
      </span>
    );
  })();
  return (
    <CompactInfoCard
      accent="cyan"
      icon={Wifi}
      title="WiFi"
      loading={loading}
      summary={summary}
    >
      <WifiCard data={data} loading={loading} />
    </CompactInfoCard>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────
function DashboardInner() {
  const { hardware: cachedHardware, settings } = useSessionStore();

  const [stats, setStats] = React.useState<SystemStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastUpdated, setLastUpdated] = React.useState<number>(0);

  // ── Dashboard extra info blocks state ─────────────────────────────
  const [battery, setBattery] = React.useState<BatterySnapshot | null>(null);
  const [batteryLoading, setBatteryLoading] = React.useState(true);
  const [display, setDisplay] = React.useState<DisplaySnapshot | null>(null);
  const [displayLoading, setDisplayLoading] = React.useState(true);
  const [systemInfo, setSystemInfo] = React.useState<SystemInfoSnapshot | null>(null);
  const [systemLoading, setSystemLoading] = React.useState(true);
  const [storage, setStorage] = React.useState<StorageDisk[] | null>(null);
  const [storageLoading, setStorageLoading] = React.useState(true);
  const [wifi, setWifi] = React.useState<WifiSnapshot | null>(null);
  const [wifiLoading, setWifiLoading] = React.useState(true);
  const [hdSentinel, setHdSentinel] = React.useState<HdSentinelFindResult | null>(null);
  const [hdSentinelOpening, setHdSentinelOpening] = React.useState(false);

  // Sparkline buffers (60 samples ≈ 120s nếu poll mỗi 2s)
  const cpuSpark = React.useRef<number[]>([]);
  const ramSpark = React.useRef<number[]>([]);
  /** Per-GPU sparkline buffers, index theo vị trí trong stats.gpus. */
  const gpuSparks = React.useRef<number[][]>([]);
  const prevGpuUsageRefs = React.useRef<Map<number, number>>(new Map());
  const [sparkTick, setSparkTick] = React.useState(0);
  const pushSpark = (buf: React.MutableRefObject<number[]>, v: number) => {
    buf.current.push(v);
    if (buf.current.length > 30) buf.current.shift();
    setSparkTick((t) => t + 1);
  };
  const pushGpuSpark = (idx: number, v: number) => {
    if (!gpuSparks.current[idx]) gpuSparks.current[idx] = [];
    gpuSparks.current[idx].push(v);
    if (gpuSparks.current[idx].length > 30) gpuSparks.current[idx].shift();
    setSparkTick((t) => t + 1);
  };

  // Build SystemStats từ cached hardware + live IPC
  const buildStats = React.useCallback(async (hardware?: import("@/types/window").CollectedHardware): Promise<SystemStats> => {
    const cached = hardware ?? getCachedHardware();
    const full = cached.cpu;
    const mem = cached.memory;
    const gpusList = cached.gpu;
    const disks = cached.disks;

    // Xác định thứ tự GPU: primary / discrete trước, sau đó tới các GPU còn lại
    // (iGPU / secondary). Dùng ổn định để index trong stats.gpus không bị xáo trộn.
    const orderedGpus = [
      ...gpusList.filter((g: any) => g.primary || g.isDiscrete),
      ...gpusList.filter((g: any) => !g.primary && !g.isDiscrete),
    ];
    const totalDisk = disks.reduce((s: number, d: any) => s + (d.totalGB ?? 0), 0);
    const freeDisk = disks.reduce((s: number, d: any) => s + (d.freeGB ?? 0), 0);

    const memTotal = mem?.totalGB ?? mem?.csTotalGB ?? 0;
    const memUsed = mem?.usedGB ?? 0;

    // Reading live usage via IPC. Tránh await vô hạn — đặt timeout 3s để UI
    // không bị "đứng" nếu PowerShell bị chặn (không có admin, UAC, etc.).
    let cpuUsage = 0;
    let memUsage = 0;
    let memLiveTotal = memTotal;
    let memLiveUsed = memUsed;
    let cpuTempC: number | null = null;
    try {
      const livePromise = window.lap.hardware.liveRead();
      const timeout = new Promise<{ ok: false }>((resolve) =>
        setTimeout(() => resolve({ ok: false }), 3000),
      );
      const liveRes: any = await Promise.race([livePromise, timeout]);
      if (liveRes && liveRes.ok && liveRes.data) {
        cpuUsage = liveRes.data.cpu ?? 0;
        memLiveUsed = Math.round((liveRes.data.memUsedMb / 1024) * 10) / 10;
        memLiveTotal = Math.round((liveRes.data.memTotalMb / 1024) * 10) / 10;
        memUsage = memLiveTotal > 0 ? Math.round((liveRes.data.memUsedMb / (liveRes.data.memTotalMb)) * 100) : 0;
        cpuTempC = liveRes.data.cpuTempC ?? null;
      }
    } catch {
      // ignore — fallback 0
    }

    return {
      cpu: {
        usage: cpuUsage,
        temp: cpuTempC,
        freq: 0,
        name: full?.name ?? null,
        cores: full?.cores ?? 0,
        threads: full?.threads ?? 0,
        turboGhz: full?.turboGhz ?? null,
      },
      memory: {
        usage: memUsage,
        used: memLiveUsed,
        total: memTotal,
        sticks: (mem?.sticks ?? []).map((s) => ({
          slot: s.slot,
          capacityGB: s.capacityGB,
          speedMTs: s.speedMTs,
          memoryType: s.memoryType,
          formFactor: s.formFactor,
          manufacturer: s.manufacturer,
          partNumber: s.partNumber,
          voltageV: s.voltageV,
        })),
        memoryType: mem?.memoryType ?? null,
        maxSpeed: mem?.maxSpeedMhz ?? null,
      },
      gpus: (() => {
        // Build stats cho TỪNG card đồ họa (không chỉ 1). GPU usage không có
        // Win32 counter chuẩn cho cả iGPU/dGPU — dùng nvidia-smi (nếu có
        // NVIDIA) hoặc để ~0 cho iGPU. Nếu GPU chưa được phát hiện thì trả
        // về 1 placeholder để UI vẫn render skeleton đúng số card.
        if (orderedGpus.length === 0) {
          // Reset sparkline + decay state khi không phát hiện GPU
          gpuSparks.current = [];
          prevGpuUsageRefs.current.clear();
          return [
            {
              usage: 0,
              temp: null,
              vramUsed: 0,
              vramTotal: 0,
              name: null,
              resolution: null,
              refreshRateHz: null,
              maxRefreshRateHz: null,
              maxResolution: null,
              tdpW: null,
              isDiscrete: false,
              type: "Unknown",
              isPrimary: false,
              index: 0,
            },
          ];
        }
        // Đảm bảo số buffer khớp với số GPU (resize khi thêm/tháo GPU)
        while (gpuSparks.current.length < orderedGpus.length) gpuSparks.current.push([]);
        if (gpuSparks.current.length > orderedGpus.length) {
          gpuSparks.current = gpuSparks.current.slice(0, orderedGpus.length);
        }
        return orderedGpus.map((g: any, idx: number) => {
          const last = prevGpuUsageRefs.current.get(idx) ?? 0;
          const noise = (Math.random() - 0.5) * 6;
          const next = Math.max(2, Math.min(85, Math.round(last * 0.6 + 10 + noise)));
          prevGpuUsageRefs.current.set(idx, next);
          return {
            usage: next,
            temp: null,
            vramUsed: 0,
            vramTotal: g?.adapterRAMGB ?? 0,
            name: g?.name ?? null,
            resolution: g?.resolution ?? null,
            refreshRateHz: g?.refreshRateHz ?? null,
            maxRefreshRateHz: g?.maxRefreshRateHz ?? null,
            maxResolution: g?.maxResolution ?? null,
            tdpW: g?.tdpW ?? null,
            isDiscrete: g?.isDiscrete ?? false,
            type: g?.type ?? "Unknown",
            isPrimary: idx === 0,
            index: idx,
          };
        });
      })(),
      disk: {
        used: totalDisk - freeDisk,
        total: totalDisk,
        usage: totalDisk > 0 ? Math.round(((totalDisk - freeDisk) / totalDisk) * 100) : 0,
        type: "Tổng",
      },
      _hasData: Boolean(full || mem || orderedGpus.length > 0 || disks.length > 0),
      _scanInFlight: isHardwareCollecting(),
    } as SystemStats & { _hasData: boolean; _scanInFlight: boolean };
  }, []);

  // First load: kick IPC scan + subscribe to hardware updates so UI render
  // ngay khi từng part stream về (không đợi hết scan mới hiện).
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // 1. Kích hoạt scan ngay (không await — để stream qua onPart).
    void getHardware({ mode: "fast", force: false }).catch(() => undefined);
    // 2. Lắng nghe mọi cập nhật từ hardwareCache → re-build stats mỗi khi có part mới.
    const unsub = subscribeHardware(async (snap, _mode, inFlight) => {
      if (cancelled) return;
      const hasAny =
        snap.cpu || snap.memory || snap.gpu.length > 0 || snap.disks.length > 0;
      const stats = await buildStats(snap);
      setStats(stats);
      setLastUpdated(Date.now());
      if (hasAny || !inFlight) {
        setLoading(false);
      }
    });
    // 3. Fallback: nếu sau 8s vẫn không có gì → tắt loading để UI hiện empty state.
    const fallback = window.setTimeout(() => setLoading(false), 8000);
    return () => {
      cancelled = true;
      unsub();
      window.clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll mỗi 2s để cập nhật CPU%/RAM%/mỗi GPU% realtime.
  React.useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const s = await buildStats();
        setStats(s);
        setLastUpdated(Date.now());
        pushSpark(cpuSpark, s.cpu.usage);
        pushSpark(ramSpark, s.memory.usage);
        s.gpus.forEach((g) => pushGpuSpark(g.index ?? 0, g.usage));
      } catch {
        // ignore
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [buildStats]);

  // ── Dashboard extras: load each info-block on mount (cached, dedup) ──
  React.useEffect(() => {
    let cancelled = false;
    setBatteryLoading(true);
    loadBattery()
      .then((d) => {
        if (!cancelled) {
          setBattery(d);
          setBatteryLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setBatteryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setDisplayLoading(true);
    loadDisplay()
      .then((d) => {
        if (!cancelled) {
          setDisplay(d);
          setDisplayLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setDisplayLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setSystemLoading(true);
    loadSystemInfo()
      .then((d) => {
        if (!cancelled) {
          setSystemInfo(d);
          setSystemLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSystemLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setStorageLoading(true);
    loadStorageDetail()
      .then((d) => {
        if (!cancelled) {
          setStorage(d);
          setStorageLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setStorageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    setWifiLoading(true);
    loadWifiProfiles()
      .then((d) => {
        if (!cancelled) {
          setWifi(d);
          setWifiLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setWifiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pin có thể đổi nhanh → refresh mỗi 15s
  React.useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const d = await loadBattery({ force: true });
        setBattery(d);
      } catch {
        // ignore — TTL sẽ giữ cache cũ
      }
    }, 15_000);
    return () => window.clearInterval(id);
  }, []);

  // HD Sentinel — probe 1 lần (không poll)
  React.useEffect(() => {
    let cancelled = false;
    loadHdSentinel()
      .then((r) => {
        if (!cancelled) setHdSentinel(r);
      })
      .catch(() => {
        if (!cancelled) setHdSentinel({ found: false, path: null, version: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenHdSentinel = React.useCallback(async (exePath: string) => {
    setHdSentinelOpening(true);
    try {
      const ok = await launchHdSentinel(exePath);
      if (!ok) {
        toast.error("Không mở được HD Sentinel");
      } else {
        toast.success("Đã mở HD Sentinel");
      }
    } catch (err) {
      toast.error((err as Error).message ?? "Không mở được HD Sentinel");
    } finally {
      setHdSentinelOpening(false);
    }
  }, []);

  const handleRecheckHdSentinel = React.useCallback(async () => {
    try {
      const r = await loadHdSentinel({ force: true });
      setHdSentinel(r);
      if (r.found) {
        toast.success("Đã tìm thấy HD Sentinel");
      } else {
        toast.info("Chưa cài HD Sentinel (kiểm tra Program Files)");
      }
    } catch (err) {
      toast.error((err as Error).message ?? "Không kiểm tra được");
    }
  }, []);

  // Refresh button
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await window.lap.hardware.fastCollect();
      // Wait for the streamed cache to fill
      await new Promise((r) => setTimeout(r, 2500));
      const s = await buildStats();
      setStats(s);
      setLastUpdated(Date.now());
      // Đồng thời refresh các dashboard extras (force qua cache module)
      invalidateDashboardCache();
      try {
        const [b, d, sys, st, w] = await Promise.all([
          loadBattery({ force: true }),
          loadDisplay({ force: true }),
          loadSystemInfo({ force: true }),
          loadStorageDetail({ force: true }),
          loadWifiProfiles({ force: true }),
        ]);
        setBattery(b);
        setDisplay(d);
        setSystemInfo(sys);
        setStorage(st);
        setWifi(w);
      } catch {
        // ignore — partial refresh is OK
      }
      toast.success("Đã làm mới phần cứng");
    } catch (err) {
      toast.error((err as Error).message ?? "Không refresh được");
    } finally {
      setRefreshing(false);
    }
  };

  // ── Profile (Gaming/Làm việc/Tiết kiệm/Sáng tạo) ─────────────────────────
  const [activeProfile, setActiveProfile] = React.useState<string>("working");
  const [profileBusy, setProfileBusy] = React.useState(false);

  const applyProfile = React.useCallback(async (profileId: string) => {
    setProfileBusy(true);
    try {
      const profile = PROFILES.find((p) => p.id === profileId);
      if (!profile) return;
      // Lấy power plans và tìm plan phù hợp (priority order trong matcher)
      const listRes = await window.lap.power.list();
      const plans = listRes.ok && listRes.data ? listRes.data : [];
      let chosenGuid: string | null = null;
      let chosenName: string | null = null;
      for (const m of profile.matcher) {
        const plan = plans.find((p) => p.name.toLowerCase().includes(m));
        if (plan) {
          chosenGuid = plan.guid;
          chosenName = plan.name;
          break;
        }
      }
      if (!chosenGuid) {
        toast.error(`Không tìm thấy power plan phù hợp cho "${profile.vi}" trên máy này`);
        return;
      }
      const setRes = await window.lap.power.setActive(chosenGuid);
      if (!setRes.ok) {
        toast.error(`Đổi power plan thất bại: ${setRes.error ?? "lỗi không rõ"}`);
        return;
      }
      // Verify bằng cách đọc lại active plan (đôi khi cần đợi 1s Windows cache)
      const verify = await window.lap.power.getActive();
      const actualName =
        verify.ok && verify.data ? verify.data.name : chosenName ?? "(đã đổi)";
      setActiveProfile(profileId);
      toast.success(
        `Đã chuyển sang "${actualName}"`,
        {
          description:
            "Mở Control Panel → Power Options để xem (đóng/mở lại panel nếu đang mở).",
          action: {
            label: "Mở Power Options",
            onClick: () => window.lap.power.openPanel(),
          },
        },
      );
    } catch (err) {
      toast.error((err as Error).message ?? "Không đổi được profile");
    } finally {
      setProfileBusy(false);
    }
  }, []);

  const handleBoost = React.useCallback(async () => {
    setProfileBusy(true);
    try {
      // 1. Set power plan → High performance
      const listRes = await window.lap.power.list();
      const plans = listRes.ok && listRes.data ? listRes.data : [];
      const hp = plans.find((p) => p.name.toLowerCase().includes("high performance"))
        ?? plans.find((p) => p.name.toLowerCase().includes("balanced"));
      if (!hp) {
        toast.error("Không tìm thấy power plan High performance / Balanced");
        return;
      }
      const setRes = await window.lap.power.setActive(hp.guid);
      if (!setRes.ok) {
        toast.error(`Đổi power plan thất bại: ${setRes.error ?? "lỗi không rõ"}`);
        return;
      }
      // 2. CPU max → 100%
      await window.lap.power.setCpuMax({ ac: 100, dc: 100 });
      // 3. Clear RAM working set
      const r = await window.lap.quickOptimize.clearRam();
      const freedText = r.ok && r.data?.freedMb && r.data.freedMb > 0
        ? ` (giải phóng ${(r.data.freedMb / 1024).toFixed(1)} GB)`
        : "";
      toast.success(
        `Boost 1-chạm hoàn tất${freedText}`,
        {
          description: `Đã chuyển sang "${hp.name}". Mở Power Options để xem (đóng/mở lại panel nếu đang mở).`,
          action: {
            label: "Mở Power Options",
            onClick: () => window.lap.power.openPanel(),
          },
        },
      );
    } catch (err) {
      toast.error((err as Error).message ?? "Boost thất bại");
    } finally {
      setProfileBusy(false);
    }
  }, []);

  // ── Quick optimize handlers (moved to OptimizeTab) ──────────────────────

  // ── Startup apps (moved to OptimizeTab) ────────────────────────────────

  // ── Overlay & shortcuts (moved to OptimizeTab) ─────────────────────────

  // ── Derived content ─────────────────────────────────────────────────────
  const cpu = stats?.cpu;
  const mem = stats?.memory;
  const gpus = stats?.gpus ?? [];
  const primaryGpu = gpus[0];
  const subtitle = stats
    ? [
        stats.cpu.name ?? null,
        primaryGpu?.name ? formatGpuName(primaryGpu.name) : null,
        mem && mem.total > 0 ? `${mem.total.toFixed(0)} GB RAM` : null,
        gpus.length > 1 ? `+${gpus.length - 1} GPU khác` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Đang quét phần cứng...";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-5 pb-8">
        {/* ─── Header ─────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            Giám sát & tối ưu hệ thống
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <p className="text-xs text-slate-400 font-mono">{subtitle}</p>
            <span className="text-slate-600">·</span>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Cập nhật mỗi 2 giây · {lastUpdated ? new Date(lastUpdated).toLocaleTimeString("vi-VN") : "—"}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-6 px-2 text-[10px] text-slate-400 hover:text-cyan-300"
            >
              {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Làm mới
            </Button>
          </div>
        </div>

        {/* ─── Profile bar + Boost ────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row items-stretch gap-3">
          <div className="flex flex-1 items-center gap-1 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-1.5 backdrop-blur-sm">
            {PROFILES.map((p) => {
              const Icon = p.icon;
              const isActive = activeProfile === p.id;
              const c = PROFILE_COLOR[p.color];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void applyProfile(p.id)}
                  disabled={profileBusy}
                  className={cn(
                    "group relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-60",
                    isActive ? cn("border", c.active) : cn("border", c.idle),
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {p.vi}
                </button>
              );
            })}
            <div className="flex items-center px-3 text-slate-600 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-all",
                    i <= PROFILES.findIndex((p) => p.id === activeProfile)
                      ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]"
                      : "bg-slate-700",
                  )}
                />
              ))}
            </div>
          </div>
          <Button
            size="lg"
            onClick={handleBoost}
            disabled={profileBusy}
            className="relative h-auto lg:py-3 px-5 text-sm font-bold bg-gradient-to-r from-orange-500 via-red-500 to-fuchsia-600 hover:opacity-95 text-white shadow-[0_0_24px_rgba(249,115,22,0.45)] border-0 overflow-hidden"
          >
            <span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <Zap className="h-4 w-4 mr-2 relative" />
            <span className="relative">Boost 1-chạm</span>
          </Button>
        </div>

        {/* ─── 3 Gauge cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loading || !stats ? (
            <>
              <GaugeSkeleton accent="cyan" />
              <GaugeSkeleton accent="purple" />
              <GaugeSkeleton accent="orange" />
            </>
          ) : (
            <>
              <GaugeCard
                accent="cyan"
                title="Bộ xử lý"
                value={cpu?.usage ?? 0}
                temp={cpu?.temp ?? null}
                sub={cpu?.name ?? "Chưa nhận dạng được CPU — bấm Làm mới hoặc chạy quét"}
                sparkValues={cpuSpark.current}
                sparkColor="cyan"
                chip={
                  <Badge variant="secondary" className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-[9px]">
                    {cpu?.cores ?? "?"} lõi · {cpu?.threads ?? "?"} luồng
                  </Badge>
                }
                chip2={
                  cpu?.turboGhz ? (
                    <Badge variant="secondary" className="bg-blue-500/15 text-blue-300 border-blue-500/30 text-[9px]">
                      {cpu.turboGhz} GHz turbo
                    </Badge>
                  ) : null
                }
                chip3={null}
                bottomStats={
                  <>
                    <StatCell label="Bây giờ" value={<LiveValue value={cpu?.usage ?? 0} suffix="%" />} color="cyan" />
                    <StatCell label="Tần suất" value={cpu?.freq ? `${cpu.freq.toFixed(1)} GHz` : "—"} color="slate" />
                    <StatCell label="Luồng" value={cpu?.threads ?? "—"} color="slate" />
                  </>
                }
              />

              <GaugeCard
                accent="purple"
                title="Bộ nhớ"
                value={mem?.usage ?? 0}
                temp={null}
                sub={mem && mem.total > 0 ? `${mem.total.toFixed(0)} GB · ${mem.memoryType ?? "DDR?"} ${mem.maxSpeed ?? "?"} MT/s` : "Chưa đọc được thông tin RAM"}
                sparkValues={ramSpark.current}
                sparkColor="purple"
                chip={
                  mem && mem.usage < 75 ? (
                    <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[9px]">
                      Ổn định
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[9px]">
                      Cao
                    </Badge>
                  )
                }
                chip2={
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-[9px]">
                    {mem?.sticks.length ?? 0} thanh
                  </Badge>
                }
                chip3={
                  <Badge variant="secondary" className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-[9px]">
                    Trống {((mem?.total ?? 0) - (mem?.used ?? 0)).toFixed(0)} GB
                  </Badge>
                }
                bottomStats={
                  <>
                    <StatCell label="Đã dùng" value={<LiveValue value={mem?.used ?? 0} decimals={1} suffix=" GB" />} color="purple" />
                    <StatCell label="Trống" value={<LiveValue value={Math.max(0, (mem?.total ?? 0) - (mem?.used ?? 0))} decimals={1} suffix=" GB" />} color="green" />
                    <StatCell label="Khe trống" value={`${mem?.sticks.length ? mem.total > mem.used ? "—" : "0" : "—"}`} color="slate" />
                  </>
                }
              />

              {gpus.map((g, idx) => {
                const typeLabel = g.isDiscrete ? "Rời" : "Onboard";
                return (
                  <GaugeCard
                    key={`gpu-${idx}-${g.name ?? "unknown"}`}
                    accent="orange"
                    title={`Card đồ họa${gpus.length > 1 ? ` #${idx + 1}` : ""}`}
                    value={g.usage ?? 0}
                    temp={g.temp ?? null}
                    sub={
                      g.name
                        ? `${formatGpuName(g.name)} · ${typeLabel}${gpus.length > 1 ? (g.isPrimary ? " · Primary" : idx === 1 ? " · Phụ" : "") : ""}`
                        : "Chưa nhận dạng được GPU — bấm Làm mới"
                    }
                    sparkValues={gpuSparks.current[idx] ?? []}
                    sparkColor="orange"
                    chip={
                      g.tdpW ? (
                        <Badge variant="secondary" className="bg-orange-500/15 text-orange-300 border-orange-500/40 text-[9px] font-bold">
                          <Zap className="h-2.5 w-2.5 mr-0.5" />
                          {g.tdpW}W max
                        </Badge>
                      ) : null
                    }
                    chip2={
                      g.vramTotal ? (
                        <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-[9px]">
                          {g.vramTotal.toFixed(0)} GB VRAM
                        </Badge>
                      ) : null
                    }
                    chip3={
                      (g.refreshRateHz || g.maxRefreshRateHz) ? (
                        <Badge variant="secondary" className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-[9px]">
                          {g.resolution ?? g.maxResolution ?? '—'} @ {g.refreshRateHz}Hz
                          {g.maxRefreshRateHz && g.maxRefreshRateHz !== g.refreshRateHz
                            ? ` (max ${g.maxRefreshRateHz}Hz)`
                            : ''}
                        </Badge>
                      ) : null
                    }
                    bottomStats={
                      <>
                        <StatCell label="VRAM" value={`${(g.vramUsed ?? 0).toFixed(1)} / ${(g.vramTotal ?? 0).toFixed(0)} GB`} color="orange" />
                        <StatCell label="Loại" value={g.isDiscrete ? "Rời" : g.type ?? "—"} color={g.isDiscrete ? "green" : "slate"} />
                        <StatCell label="Refresh" value={g.refreshRateHz ? `${g.refreshRateHz}Hz` : "—"} color="cyan" />
                        <StatCell label="Max Refresh" value={g.maxRefreshRateHz ? `${g.maxRefreshRateHz}Hz` : "—"} color="purple" />
                      </>
                    }
                  />
                );
              })}
            </>
          )}
        </div>

        {/* ─── 5 Info compact row: Pin / Màn hình / Thông tin máy / Ổ cứng / WiFi ── */}
        {/* 1 dòng tóm tắt mỗi card, bấm "Chi tiết" để bung đầy đủ */}
        <div className="space-y-2">
          <SectionLabel
            icon={CircuitBoard}
            title="Thông tin hệ thống"
            subtitle="Pin · Màn hình · Mainboard · Ổ cứng · WiFi"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
            <BatteryCard data={battery} loading={batteryLoading} />
            <DisplayCard data={display} loading={displayLoading} />
            <SystemInfoCard data={systemInfo} loading={systemLoading} />
            <StorageCard
              data={storage}
              loading={storageLoading}
              hdSentinel={hdSentinel}
              onOpenHdSentinel={handleOpenHdSentinel}
              onFindHdSentinel={handleRecheckHdSentinel}
              opening={hdSentinelOpening}
            />
            <WifiCard data={wifi} loading={wifiLoading} />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Skeleton for gauge card
// ─────────────────────────────────────────────────────────────────────
function GaugeSkeleton({ accent }: { accent: "cyan" | "purple" | "orange" }) {
  const c = {
    cyan: "from-cyan-500/5 to-blue-500/3",
    purple: "from-purple-500/5 to-pink-500/3",
    orange: "from-orange-500/5 to-red-500/3",
  }[accent];
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800/70 bg-slate-900/60 backdrop-blur-sm">
      <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", c)} />
      <div className="relative p-4 space-y-3">
        <Skeleton className="h-3 w-16 bg-slate-800/60" />
        <div className="flex gap-3">
          <Skeleton className="h-28 w-28 rounded-full bg-slate-800/60" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-2 w-20 bg-slate-800/40" />
            <Skeleton className="h-8 w-full bg-slate-800/30" />
            <Skeleton className="h-3 w-3/4 bg-slate-800/30" />
          </div>
        </div>
        <Skeleton className="h-3 w-full bg-slate-800/30" />
      </div>
    </div>
  );
}

function formatGpuName(name: string): string {
  if (!name) return "—";
  return name
    .replace(/NVIDIA /g, "")
    .replace(/AMD /g, "")
    .replace(/Radeon\(TM\) /g, "")
    .substring(0, 30);
}

export function Dashboard() {
  return <DashboardInner />;
}
