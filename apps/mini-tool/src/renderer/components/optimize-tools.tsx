// optimize-tools.tsx — Các panel "tối ưu nhanh / startup / overlay / RAM sticks"
// được tách ra từ Dashboard.tsx và dùng trong OptimizeTab.
//
// Mỗi panel tự fetch data của mình qua IPC, không cần truyền props từ Dashboard.
// RAM panel dùng CollectedHardware.memory từ session store thay vì polling riêng.

import * as React from "react";
import {
  Activity,
  Cctv,
  ChevronDown,
  Copy,
  Cpu,
  Eye,
  Gamepad2,
  Info,
  MemoryStick,
  Network,
  Power,
  PowerOff,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wifi,
  Zap,
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
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store";
import type { MemoryInfo, RamStickInfo, StartupApp } from "@/types/window";

// ─────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────
function SectionLabel({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <Icon className="h-4 w-4 text-cyan-400" />
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {subtitle && <span className="text-[11px] text-slate-500">· {subtitle}</span>}
    </div>
  );
}

function SettingRow2({
  title,
  description,
  control,
}: {
  title: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function ShortcutRow({ label, combo }: { label: string; combo: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-slate-200">{label}</p>
      <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300">
        {combo}
      </kbd>
    </div>
  );
}

function ThresholdRow({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200">{label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">Báo nhiệt độ quá cao</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="range"
          min={60}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 accent-orange-500"
        />
        <span className="text-sm font-mono text-orange-300 w-12 text-right">
          {value}
          {unit}
        </span>
      </div>
    </div>
  );
}

function QuickActionButton({
  icon: Icon,
  accent,
  title,
  subtitle,
  loading,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  accent: "blue" | "purple" | "orange" | "cyan";
  title: string;
  subtitle: string;
  loading: boolean;
  onClick: () => void;
}) {
  const accentClass: Record<typeof accent, string> = {
    blue: "border-blue-500/30 hover:border-blue-400/60 hover:bg-blue-500/5",
    purple: "border-purple-500/30 hover:border-purple-400/60 hover:bg-purple-500/5",
    orange: "border-orange-500/30 hover:border-orange-400/60 hover:bg-orange-500/5",
    cyan: "border-cyan-500/30 hover:border-cyan-400/60 hover:bg-cyan-500/5",
  };
  const iconClass: Record<typeof accent, string> = {
    blue: "bg-blue-500/15 text-blue-300",
    purple: "bg-purple-500/15 text-purple-300",
    orange: "bg-orange-500/15 text-orange-300",
    cyan: "bg-cyan-500/15 text-cyan-300",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "group flex items-start gap-3 rounded-xl border bg-slate-900/50 backdrop-blur-sm p-3 text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed",
        accentClass[accent],
      )}
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconClass[accent])}>
        {loading ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{title}</p>
        <p className="text-[11px] text-slate-400 truncate mt-0.5">{subtitle}</p>
      </div>
    </button>
  );
}

function StartupAppRow({
  app,
  onToggle,
  pending,
}: {
  app: StartupApp;
  onToggle: (nextEnabled: boolean) => void;
  pending: boolean;
}) {
  const [localEnabled, setLocalEnabled] = React.useState(app.enabled);
  const [localName, setLocalName] = React.useState(app.name);
  React.useEffect(() => {
    setLocalEnabled(app.enabled);
    setLocalName(app.name);
  }, [app.enabled, app.name]);

  const workloadBadge: Record<string, string> = {
    Cao: "bg-red-500/15 text-red-300 border-red-500/40",
    "Vừa": "bg-amber-500/15 text-amber-300 border-amber-500/40",
    "Thấp": "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  };
  const IconForApp = (() => {
    switch (app.iconHint) {
      case "discord":
        return Activity;
      case "steam":
        return Gamepad2;
      case "onedrive":
        return Cctv;
      case "nvidia":
        return Cpu;
      case "spotify":
        return Activity;
      case "chrome":
        return Network;
      case "edge":
        return Network;
      default:
        return Sparkles;
    }
  })();

  const isReadOnly = app.location.endsWith("RunOnce");
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        localEnabled
          ? "border-slate-800/70 bg-slate-900/40 hover:bg-slate-900/70"
          : "border-slate-800/40 bg-slate-900/20 opacity-60",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          localEnabled ? "bg-cyan-500/15 text-cyan-300" : "bg-slate-800 text-slate-500",
        )}
      >
        <IconForApp className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-sm font-medium truncate",
              localEnabled ? "text-white" : "text-slate-400 line-through decoration-slate-600",
            )}
            title={localName}
          >
            {localName}
          </p>
          <Badge
            variant="secondary"
            className={cn("border text-[9px] font-semibold px-1.5", workloadBadge[app.workload])}
          >
            {app.workload}
          </Badge>
        </div>
        <p className="text-[10px] text-slate-500 truncate mt-0.5" title={app.publisher ?? app.command}>
          {app.publisher ?? app.command.slice(0, 60)}
        </p>
      </div>
      {isReadOnly ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="text-[9px] border bg-slate-800 text-slate-400 border-slate-700"
              >
                RunOnce
              </Badge>
            </TooltipTrigger>
            <TooltipContent>RunOnce chỉ chạy 1 lần rồi tự xoá — không toggle được</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Switch
          checked={localEnabled}
          onCheckedChange={(v) => {
            const next = Boolean(v);
            setLocalEnabled(next);
            onToggle(next);
          }}
          disabled={pending}
          aria-label={`Toggle ${localName}`}
        />
      )}
    </div>
  );
}

function RamDisclosure({ memory }: { memory: MemoryInfo }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Card className="bg-slate-900/60 border-slate-800/70 backdrop-blur-sm">
      <CardContent className="p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition-colors px-3 py-2 text-sm"
        >
          <span className="flex items-center gap-2 text-slate-200">
            <MemoryStick className="h-4 w-4 text-purple-300" />
            {(memory.totalGB ?? 0).toFixed(0)} GB · {memory.memoryType ?? "DDR?"} ·{" "}
            {memory.maxSpeedMhz ?? "?"} MT/s
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-slate-400 transition-transform",
              open && "rotate-180 text-cyan-300",
            )}
          />
        </button>
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            open ? "grid-rows-[1fr] mt-2" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden space-y-1">
            {memory.sticks.map((s, i) => {
              const genKey = s.memoryType ?? "DDR";
              const genClass: Record<string, string> = {
                DDR5: "bg-blue-500/20 text-blue-300 border-blue-500/40",
                DDR4: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
                DDR3: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
                DDR: "bg-slate-500/20 text-slate-300 border-slate-500/40",
              };
              return (
                <div
                  key={`${s.slot}-${i}`}
                  className="rounded-lg border border-slate-800/60 bg-slate-900/60 px-3 py-2 flex items-center gap-3"
                >
                  <span className="font-mono text-xs text-slate-400 w-16 truncate">
                    {s.slot ?? "—"}
                  </span>
                  <span className="text-sm font-bold text-white tabular-nums">
                    {s.capacityGB} GB
                  </span>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase",
                      genClass[genKey],
                    )}
                  >
                    {s.memoryType ?? "DDR?"}
                  </span>
                  <span className="text-[11px] font-mono text-purple-300">
                    {s.speedMTs ? `${s.speedMTs} MT/s` : "—"}
                  </span>
                  <span
                    className="flex-1 truncate text-[11px] text-slate-400"
                    title={s.partNumber ?? s.manufacturer ?? ""}
                  >
                    {s.partNumber ?? s.manufacturer ?? ""}
                  </span>
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-cyan-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            const txt = `${s.slot ?? ""}\n${s.manufacturer ?? ""}\n${s.partNumber ?? ""}\n${s.formFactor ?? ""}\n${s.speedMTs ?? ""} MT/s\n${s.voltageV ?? ""}V`;
                            void navigator.clipboard
                              .writeText(txt)
                              .then(() => toast.success("Đã copy chi tiết RAM"));
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy chi tiết</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 1. QuickOptimizePanel — 4 nút 1-chạm
// ─────────────────────────────────────────────────────────────────────
export function QuickOptimizePanel() {
  const [optBusy, setOptBusy] = React.useState<string | null>(null);
  const [optResult, setOptResult] = React.useState<Record<string, string>>({});

  const runOptimize = async (
    key: string,
    action: () => Promise<{ label: string; ok: boolean }>,
  ) => {
    setOptBusy(key);
    try {
      const r = await action();
      setOptResult((prev) => ({ ...prev, [key]: r.label }));
      if (r.ok) toast.success(r.label);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setOptBusy(null);
    }
  };

  const handleClearRam = () =>
    runOptimize("clear-ram", async () => {
      const r = await window.lap.quickOptimize.clearRam();
      if (!r.ok || !r.data) return { ok: false, label: r.error ?? "Thất bại" };
      const freed =
        r.data.freedMb && r.data.freedMb > 0 ? (r.data.freedMb / 1024).toFixed(1) : null;
      const trimmed = r.data.trimmed ?? 0;
      if (freed) return { ok: true, label: `Giải phóng ${freed} GB · ${trimmed} process` };
      if (trimmed > 0) return { ok: true, label: `Đã trim ${trimmed} process (RAM chưa tăng)` };
      return { ok: true, label: "Đã chạy (RAM đã tối ưu sẵn)" };
    });

  const handleCleanTemp = () =>
    runOptimize("clean-temp", async () => {
      const r = await window.lap.optimize.cleanTemp();
      if (!r.ok || !r.data) return { ok: false, label: r.error ?? "Thất bại" };
      const freedMatch = r.data.stdout.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
      return { ok: true, label: freedMatch ? `Đã xoá ${freedMatch[0]}` : "Hoàn tất" };
    });

  const handleCheckDriver = () =>
    runOptimize("check-driver", async () => {
      const r = await window.lap.quickOptimize.checkDriver();
      if (!r.ok || !r.data) return { ok: false, label: r.error ?? "Thất bại" };
      const parsed = r.data.parsed;
      const count = parsed?.count ?? 0;
      const src = parsed?.source === "wua" ? "WU" : "PnP";
      if (count > 0) return { ok: true, label: `${count} mục (${src})` };
      return { ok: true, label: "Đã cập nhật" };
    });

  const handleOptimizeNet = () =>
    runOptimize("dns", async () => {
      const r = await window.lap.quickOptimize.dns();
      if (!r.ok || !r.data) return { ok: false, label: r.error ?? "Thất bại" };
      const adapters = (r.data.stdout.match(/OK:(.+)/) ?? [, ""])[1]
        .split("|")
        .filter(Boolean);
      if (adapters.length > 0) return { ok: true, label: `${adapters.length} adapter → 1.1.1.1` };
      if (r.data.exitCode !== 0 || r.data.stderr) return { ok: false, label: "Cần quyền Admin (UAC)" };
      return { ok: true, label: "Không có adapter nào đang Up" };
    });

  return (
    <div className="space-y-2">
      <SectionLabel
        icon={Zap}
        title="Tối ưu nhanh"
        subtitle="Bấm 1-chạm — mỗi thao tác chạy qua IPC thật"
      />
      <div className="rounded-xl border border-slate-800/70 bg-slate-900/60 backdrop-blur-sm p-2">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <QuickActionButton
            icon={MemoryStick}
            accent="blue"
            title="Dọn RAM"
            subtitle={
              optResult["clear-ram"] ??
              (optBusy === "clear-ram" ? "Đang dọn…" : "Giải phóng working set")
            }
            loading={optBusy === "clear-ram"}
            onClick={handleClearRam}
          />
          <QuickActionButton
            icon={Trash2}
            accent="purple"
            title="Xoá file rác"
            subtitle={
              optResult["clean-temp"] ??
              (optBusy === "clean-temp" ? "Đang quét…" : "Cleaner %TEMP% + Prefetch")
            }
            loading={optBusy === "clean-temp"}
            onClick={handleCleanTemp}
          />
          <QuickActionButton
            icon={ShieldCheck}
            accent="orange"
            title="Kiểm tra driver"
            subtitle={
              optResult["check-driver"] ??
              (optBusy === "check-driver" ? "Đang rà…" : "Liệt kê driver đã cài")
            }
            loading={optBusy === "check-driver"}
            onClick={handleCheckDriver}
          />
          <QuickActionButton
            icon={Wifi}
            accent="cyan"
            title="Tăng tốc DNS"
            subtitle={
              optResult["dns"] ??
              (optBusy === "dns" ? "Đang set…" : "Cloudflare + Google · cần Admin")
            }
            loading={optBusy === "dns"}
            onClick={handleOptimizeNet}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 2. StartupAppsPanel — ứng dụng khởi động cùng Windows
// ─────────────────────────────────────────────────────────────────────
export function StartupAppsPanel() {
  const [startups, setStartups] = React.useState<StartupApp[]>([]);
  const [startupsLoading, setStartupsLoading] = React.useState(true);
  const [startupToggling, setStartupToggling] = React.useState<string | null>(null);

  const loadStartups = React.useCallback(async () => {
    setStartupsLoading(true);
    try {
      const r = await window.lap.startup.list();
      if (r.ok && r.data) setStartups(r.data);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setStartupsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadStartups();
  }, [loadStartups]);

  const handleToggleStartup = async (app: StartupApp, newEnabled: boolean) => {
    const key = `${app.location}::${app.name}`;
    setStartupToggling(key);
    try {
      const r = await window.lap.startup.toggle({
        currentName: app.name,
        location: app.location,
        newEnabled,
      });
      if (!r.ok) {
        toast.error(r.error ?? "Toggle thất bại");
        return;
      }
      if (r.data) {
        setStartups((prev) =>
          prev.map((p) =>
            p.name === app.name && p.location === app.location
              ? { ...p, name: r.data!.newName, enabled: r.data!.enabled }
              : p,
          ),
        );
        toast.success(newEnabled ? `Đã bật "${app.name}"` : `Đã tắt "${app.name}"`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setStartupToggling(null);
    }
  };

  const startCount = startups.filter((s) => s.enabled && !s.location.endsWith("RunOnce")).length;
  const onStartCount = startups.filter((s) => !s.enabled).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel
          icon={Power}
          title="Ứng dụng khởi động cùng Windows"
          subtitle={`${startCount} đang bật · ${onStartCount} đã tắt`}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={loadStartups}
          disabled={startupsLoading}
          className="h-7 text-[11px] text-slate-400 hover:text-cyan-300"
        >
          <RefreshCw className={cn("h-3 w-3 mr-1", startupsLoading && "animate-spin")} />
          Làm mới
        </Button>
      </div>
      <Card className="bg-slate-900/60 border-slate-800/70 backdrop-blur-sm">
        <CardContent className="p-3 space-y-1.5 max-h-[340px] overflow-y-auto disk-list">
          {startupsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full bg-slate-800/40" />
            ))
          ) : startups.length === 0 ? (
            <div className="py-6 text-center">
              <PowerOff className="h-8 w-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-500 mt-2">
                Không tìm thấy ứng dụng khởi động nào trong registry
              </p>
            </div>
          ) : (
            startups.map((s, i) => (
              <StartupAppRow
                key={`${s.location}::${s.name}::${i}`}
                app={s}
                pending={startupToggling === `${s.location}::${s.name}`}
                onToggle={(next) => void handleToggleStartup(s, next)}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 3. OverlayShortcutsPanel — overlay & phím tắt
// ─────────────────────────────────────────────────────────────────────
export function OverlayShortcutsPanel() {
  const [overlayInGame, setOverlayInGame] = React.useState(true);
  const [overlayShortcut] = React.useState("Ctrl + Shift + O");
  const [boostShortcut] = React.useState("Ctrl + Shift + B");
  const [ramShortcut] = React.useState("Ctrl + Shift + M");
  const [cpuAlert, setCpuAlert] = React.useState(85);

  return (
    <div className="space-y-3">
      <SectionLabel icon={Eye} title="Overlay & phím tắt" subtitle="Cấu hình HUD + phím tắt" />
      <Card className="bg-slate-900/60 border-slate-800/70 backdrop-blur-sm">
        <CardContent className="p-4 space-y-3">
          <SettingRow2
            title="Overlay trong game"
            description="Hiển thị FPS, nhiệt độ, GPU khi chơi game"
            control={
              <Switch
                checked={overlayInGame}
                onCheckedChange={(v) => {
                  setOverlayInGame(v);
                  toast.success(v ? "Đã bật overlay" : "Đã tắt overlay");
                }}
              />
            }
          />
          <Separator className="bg-slate-800/60" />
          <ShortcutRow label="Bật/tắt overlay" combo={overlayShortcut} />
          <ShortcutRow label="Boost 1-chạm" combo={boostShortcut} />
          <ShortcutRow label="Dọn RAM nhanh" combo={ramShortcut} />
          <Separator className="bg-slate-800/60" />
          <ThresholdRow
            label="Ngưỡng cảnh báo CPU"
            value={cpuAlert}
            onChange={setCpuAlert}
            unit="°C"
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 4. RamSticksPanel — chi tiết từng thanh RAM
// ─────────────────────────────────────────────────────────────────────
export function RamSticksPanel() {
  const { hardware } = useSessionStore();
  const mem = hardware.cachedHardware?.memory ?? null;
  const loading = !mem;

  if (loading) {
    return (
      <div className="space-y-2">
        <SectionLabel icon={MemoryStick} title="RAM" subtitle="Đang quét..." />
        <Card className="bg-slate-900/40 border-slate-800/60 border-dashed">
          <CardContent className="p-6 text-center">
            <MemoryStick className="h-8 w-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-500 mt-2">Chưa phát hiện RAM</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalGB = mem.totalGB ?? 0;
  const sticks = mem.sticks as RamStickInfo[];

  return (
    <div className="space-y-2">
      <SectionLabel
        icon={MemoryStick}
        title="RAM"
        subtitle="Click để xem chi tiết từng thanh"
      />
      {sticks.length > 0 ? (
        <RamDisclosure memory={mem} />
      ) : totalGB > 0 ? (
        <Card className="bg-slate-900/60 border-slate-800/60">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm text-slate-200">
              {totalGB.toFixed(0)} GB · {mem.memoryType ?? "DDR?"} · {mem.maxSpeedMhz ?? "?"} MT/s
            </p>
            <p className="text-[11px] text-amber-300">
              Chưa đọc được từng thanh (WMI chưa trả về). Bấm "Làm mới" ở Dashboard để quét lại.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900/40 border-slate-800/60 border-dashed">
          <CardContent className="p-6 text-center">
            <MemoryStick className="h-8 w-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-500 mt-2">Chưa phát hiện RAM</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// InfoFooter — dòng tip cuối tab tối ưu
// ─────────────────────────────────────────────────────────────────────
export function OptimizeInfoFooter() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-800/60 bg-slate-900/30 px-4 py-2.5 text-[11px] text-slate-500">
      <Info className="h-3.5 w-3.5 text-slate-600 shrink-0 mt-0.5" />
      <p>
        Tất cả hành động tối ưu đều chạy qua IPC thật — PowerShell ở main process.
        Một số thao tác (đổi plan, CPU max, registry startup) cần quyền Admin — Windows sẽ
        hiện UAC tự động.
      </p>
    </div>
  );
}
