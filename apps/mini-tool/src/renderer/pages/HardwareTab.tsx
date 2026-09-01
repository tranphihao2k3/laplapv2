// HardwareTab.tsx — stream phần cứng từ PowerShell (WMI + Registry + DirectX)
import * as React from "react";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  CircuitBoard,
  BatteryFull,
  Network,
  Monitor,
  RefreshCcw,
  Download,
  Copy,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  CollectedHardware,
  HardwarePart,
} from "../types/window";
import { useSessionStore } from "@/store";

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function formatCache(kb: number | null | undefined): string {
  if (!kb || kb <= 0) return "—";
  if (kb >= 1024) return `${(kb / 1024).toFixed(0)} MB`;
  return `${kb} KB`;
}

function normalizeMaker(raw: string | null | undefined): string {
  if (!raw) return "—";
  const lower = raw.toLowerCase();
  if (lower.includes("genuineintel") || lower.includes("intel")) return "Intel";
  if (lower.includes("authenticamd") || lower.includes("advmicro") || lower.includes("amd")) return "AMD";
  if (lower.includes("arm")) return "ARM";
  return raw;
}

function chemName(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (typeof n === "string") return n;
  const map: Record<number, string> = {
    1: "Other", 2: "Unknown", 3: "Lead Acid", 4: "Nickel Cadmium",
    5: "Nickel Metal Hydride", 6: "Lithium-ion", 7: "Zinc Air", 8: "Lithium Polymer",
  };
  return map[n] ?? String(n);
}

function memGen(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (typeof n === "string") return n;
  const map: Record<number, string> = {
    0: "Unknown", 20: "DDR", 21: "DDR2", 24: "DDR3", 26: "DDR4", 30: "DDR4", 31: "DDR5", 34: "DDR5", 35: "DDR5",
  };
  return map[n] ?? String(n);
}

interface SpecRow {
  label: string;
  value: React.ReactNode;
}

function SpecTable({ rows }: { rows: SpecRow[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-3 items-baseline gap-2">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">{row.label}</dt>
          <dd className="col-span-2 break-words text-foreground">{row.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function copyText(label: string, value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  if (!text) { toast.error("Không có dữ liệu để copy"); return; }
  void navigator.clipboard.writeText(text)
    .then(() => toast.success(`Đã copy ${label}`))
    .catch(() => toast.error("Không copy được"));
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-3/4" />
      ))}
    </div>
  );
}

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  status: "loading" | "ready" | "error" | "empty";
  errorMessage?: string;
  onCopy?: () => void;
  children: React.ReactNode;
}

function SectionCard({ icon, title, status, errorMessage, onCopy, children }: SectionCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex items-start gap-2">
          <div className={cn(
            "rounded-md p-1.5",
            status === "loading" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
          )}>
            {status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
          </div>
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {title}
              {status === "loading" && (
                <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">đang quét…</span>
              )}
            </CardTitle>
            <CardDescription className="text-xs">Thông tin chính xác từ WMI + Registry</CardDescription>
          </div>
        </div>
        {onCopy && status === "ready" ? (
          <Button variant="ghost" size="icon" onClick={onCopy} aria-label={`Copy ${title}`}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        {status === "loading" ? (
          <CardSkeleton />
        ) : status === "error" ? (
          <div className="flex items-start gap-2 text-sm text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-mono text-xs">Không lấy được: {errorMessage ?? "lỗi không xác định"}</p>
          </div>
        ) : status === "empty" ? (
          <p className="text-sm text-muted-foreground">Không có dữ liệu.</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

type PartStatus = "loading" | "ready" | "error" | "empty";

// Tên các key phần cứng mà main process stream ra (dùng để derive status).
const PART_KEYS = [
  "cpu",
  "memory",
  "disks",
  "gpu",
  "mainboard",
  "bios",
  "battery",
  "os",
  "network",
] as const;

type PartKey = (typeof PART_KEYS)[number];

/** Build status map từ CollectedHardware đã có (cache hit). */
function deriveStatusFromData(data: CollectedHardware): Record<PartKey, PartStatus> {
  const empty: Record<PartKey, PartStatus> = {
    cpu: "empty", memory: "empty", disks: "empty", gpu: "empty",
    mainboard: "empty", bios: "empty", battery: "empty",
    os: "empty", network: "empty",
  };
  if (data.cpu) empty.cpu = "ready";
  if (data.memory) empty.memory = "ready";
  if (data.disks.length > 0) empty.disks = "ready";
  if (data.gpu.length > 0) empty.gpu = "ready";
  if (data.mainboard) empty.mainboard = "ready";
  if (data.bios) empty.bios = "ready";
  empty.battery = "ready";
  if (data.os) empty.os = "ready";
  if (data.network.length > 0) empty.network = "ready";
  return empty;
}

const LOADING_STATUS: Record<PartKey, PartStatus> = {
  cpu: "loading", memory: "loading", disks: "loading", gpu: "loading",
  mainboard: "loading", bios: "loading", battery: "loading",
  os: "loading", network: "loading",
};

const EMPTY_HARDWARE: CollectedHardware = {
  cpu: null, memory: null, disks: [], gpu: [],
  mainboard: null, bios: null, battery: null, os: null, network: [],
  collectedAt: "", source: "powershell-enhanced",
};

export function HardwareTab() {
  const { hardware: cachedHardware, setHardware, settings } = useSessionStore();

  // Local staging cho data đang stream (đẩy vào store từng part để cache).
  // Khởi tạo từ cache nếu có để data cũ hiển thị ngay khi remount.
  const [staging, setStaging] = React.useState<CollectedHardware>(
    cachedHardware ?? EMPTY_HARDWARE,
  );
  const data = staging;
  const doneAt = cachedHardware?.collectedAt || null;

  const [status, setStatus] = React.useState<Record<PartKey, PartStatus>>(() =>
    cachedHardware ? deriveStatusFromData(cachedHardware) : LOADING_STATUS,
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [streaming, setStreaming] = React.useState(false);

  const start = React.useCallback(async () => {
    setStaging(EMPTY_HARDWARE);
    setStatus(LOADING_STATUS);
    setErrors({});
    setStreaming(true);
    setHardware(null);
    const res = await window.lap.hardware.collect();
    if (!res.ok) {
      setStreaming(false);
      toast.error(`Không khởi động được: ${res.error ?? "lỗi"}`);
    }
  }, [setHardware]);

  // Subscribe IPC một lần; cleanup chỉ unsub + cancel stream,
  // KHÔNG xóa store data để cache sống qua các lần remount.
  React.useEffect(() => {
    const off = window.lap.hardware.onPart((part: HardwarePart) => {
      if (part.key === "__done__") {
        setStreaming(false);
        // Snapshot staging → store với collectedAt mới.
        setStaging((prev) => {
          const snapshot: CollectedHardware = {
            ...prev,
            collectedAt: new Date().toISOString(),
            source: "powershell-enhanced",
          };
          setHardware(snapshot);
          return snapshot;
        });
        setStatus((prev) => {
          const next = { ...prev };
          for (const k of PART_KEYS) {
            if (next[k] === "loading") next[k] = "empty";
          }
          return next;
        });
        return;
      }
      if (part.key === "__error__") {
        setStreaming(false);
        toast.error(`Lỗi stream: ${part.error}`);
        return;
      }
      const key = part.key as PartKey;
      if (!PART_KEYS.includes(key)) return;

      if (!part.ok) {
        setErrors((e) => ({ ...e, [key]: part.error }));
        setStatus((s) => ({ ...s, [key]: "error" }));
        return;
      }
      setStatus((s) => ({ ...s, [key]: "ready" }));
      // Cập nhật staging + đẩy vào store để cache qua remount.
      setStaging((prev) => {
        const next: CollectedHardware = {
          ...prev,
          [key]: (part as { data: unknown }).data,
        } as CollectedHardware;
        setHardware(next);
        return next;
      });
    });
    return () => {
      off();
      void window.lap.hardware.cancel();
    };
  }, [setHardware]);

  // Khi mount: chỉ scan nếu cache rỗng VÀ user bật autoScanOnStartup.
  React.useEffect(() => {
    if (cachedHardware) {
      // Cache hit — không quét lại; chỉ đảm bảo status đúng từ cache.
      setStatus(deriveStatusFromData(cachedHardware));
      return;
    }
    if (settings.autoScanOnStartup) {
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    void window.lap.hardware.cancel();
    void start();
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ ...data, collectedAt: doneAt ?? new Date().toISOString() }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laplap-hardware-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Đã xuất JSON phần cứng");
  };

  const cpu = data.cpu;
  const memory = data.memory;
  const disks = data.disks;
  const gpus = data.gpu;
  const mainboard = data.mainboard;
  const bios = data.bios;
  const battery = data.battery;
  const os = data.os;
  const network = data.network;
  const totalMemBytes = memory?.totalBytes ?? (memory?.modules?.reduce((s, m) => s + (m.sizeBytes ?? 0), 0) ?? null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Phần cứng</h2>
          <p className="text-xs text-muted-foreground">
            Quét chi tiết qua WMI + Registry + SMBIOS
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={streaming}>
            {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Làm mới
          </Button>
          <Button size="sm" onClick={handleExport} disabled={!doneAt}>
            <Download className="h-3.5 w-3.5" /> Xuất JSON
          </Button>
        </div>
      </div>

      {/* ── Grid 3-4 cột cho tất cả ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {/* CPU */}
        <SectionCard
          icon={<Cpu className="h-4 w-4" />}
          title="CPU"
          status={status.cpu}
          errorMessage={errors.cpu}
          onCopy={() => copyText("CPU", cpu?.name)}
        >
          <SpecTable
            rows={[
              { label: "Tên", value: cpu?.name },
              { label: "Hãng", value: normalizeMaker(cpu?.manufacturer) },
              { label: "Nhân / Luồng", value: cpu?.cores && cpu?.threads ? `${cpu.cores} nhân / ${cpu.threads} luồng` : "—" },
              { label: "Xung", value: cpu?.baseGhz && cpu?.turboGhz ? `${cpu.baseGhz} - ${cpu.turboGhz} GHz` : cpu?.baseGhz ? `${cpu.baseGhz} GHz` : "—" },
              { label: "Cache", value: cpu?.cacheL3Kb ? formatCache(cpu.cacheL3Kb) : formatCache(cpu?.cacheL2Kb ?? null) },
              { label: "Socket", value: cpu?.socket || "—" },
            ]}
          />
        </SectionCard>

        {/* RAM */}
        <SectionCard
          icon={<MemoryStick className="h-4 w-4" />}
          title="RAM"
          status={status.memory}
          errorMessage={errors.memory}
          onCopy={() => copyText("RAM", formatBytes(totalMemBytes))}
        >
          <div className="space-y-2">
            <SpecTable
              rows={[
                { label: "Tổng", value: formatBytes(totalMemBytes) },
                { label: "Số thanh", value: memory?.slots ?? "—" },
                { label: "Bus", value: memory?.platformMaxMhz ? `${memory.platformMaxMhz} MHz` : "—" },
              ]}
            />
            {memory?.modules && memory.modules.length > 0 && (
              <ul className="space-y-1 text-[11px]">
                {memory.modules.map((m, i) => {
                  const running = m.configuredMhz ?? m.speedMhz;
                  const platformMax = m.platformMaxMhz ?? memory.platformMaxMhz;
                  const belowSpec = typeof running === "number" && typeof platformMax === "number" && running < platformMax;
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-1.5 rounded border border-border/40 bg-muted/30 px-2 py-0.5">
                      <span className="font-mono font-medium text-[10px]">{m.slot ?? `#${i + 1}`}</span>
                      <span className="text-muted-foreground">·</span>
                      <span>{formatBytes(m.sizeBytes)}</span>
                      {m.manufacturer && (
                        <span className="text-[10px] text-cyan-400 font-medium">{m.manufacturer}</span>
                      )}
                      <span className={cn(
                        "font-medium",
                        (m.generation ?? memGen(m.type)) === "DDR5" ? "text-blue-400" :
                        (m.generation ?? memGen(m.type)) === "DDR4" ? "text-green-400" : "text-zinc-400"
                      )}>
                        {m.generation ?? memGen(m.type)}
                      </span>
                      <span>{running ? `${running}MHz` : "—"}</span>
                      {belowSpec && (
                        <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium uppercase text-amber-300">
                          dưới spec
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SectionCard>

        {/* Disk */}
        <SectionCard
          icon={<HardDrive className="h-4 w-4" />}
          title="Ổ cứng"
          status={status.disks}
          errorMessage={errors.disks}
          onCopy={() => copyText("Disk", disks.map((d) => `${d.name} (${d.capacityGb}GB ${d.type})`).join("\n"))}
        >
          {disks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Không tìm thấy ổ đĩa.</p>
          ) : (
            <div className="space-y-1.5">
              {disks.map((d, i) => {
                const isNvme = (d.type ?? "").toLowerCase().includes("nvme");
                const isSsd = isNvme || (d.type ?? "").toLowerCase() === "ssd";
                const typeClass = isNvme ? "bg-emerald-500/15 text-emerald-300"
                  : isSsd ? "bg-sky-500/15 text-sky-300"
                  : (d.type ?? "").toLowerCase() === "hdd" ? "bg-zinc-500/15 text-zinc-400"
                  : (d.type ?? "").toLowerCase() === "usb" ? "bg-amber-500/15 text-amber-300"
                  : "bg-muted text-muted-foreground";
                return (
                  <div key={i} className="rounded border border-border/40 bg-muted/20 px-2 py-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                      <span className="font-semibold">{d.name ?? "?"}</span>
                      <span className={cn("rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider", typeClass)}>
                        {d.type ?? "?"}
                      </span>
                      <span className="text-muted-foreground">{d.capacityGb ? `${d.capacityGb}GB` : "?"}</span>
                      {d.freeGb && <span className="text-muted-foreground">({d.freeGb}GB trống)</span>}
                      {d.tempC && <span className="text-muted-foreground">{d.tempC}°C</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* GPU */}
        <SectionCard
          icon={<Monitor className="h-4 w-4" />}
          title="GPU / VGA"
          status={status.gpu}
          errorMessage={errors.gpu}
          onCopy={() => copyText("GPU", gpus.map((g) => g.name).join(", "))}
        >
          {gpus.length === 0 ? (
            <p className="text-xs text-muted-foreground">Không tìm thấy GPU.</p>
          ) : (
            <div className="space-y-1.5">
              {gpus.map((g, i) => (
                <div key={i} className="rounded border border-border/40 bg-muted/20 px-2 py-1">
                  <div className="font-semibold text-xs">{g.name ?? "?"}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                    {g.vramMb && <span className="font-mono">{g.vramMb}MB VRAM</span>}
                    {g.vramType && <span className="text-blue-400">{g.vramType}</span>}
                    {g.tdpW && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-300">
                        {g.tdpW}W (max)
                      </span>
                    )}
                    {g.computeUnits && <span className="text-purple-400">{g.computeUnits} cores</span>}
                    {g.driverVersion && <span>Driver v{g.driverVersion}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Mainboard */}
        <SectionCard
          icon={<CircuitBoard className="h-4 w-4" />}
          title="Mainboard"
          status={status.mainboard}
          errorMessage={errors.mainboard}
          onCopy={() => copyText("Mainboard", mainboard?.product)}
        >
          <SpecTable
            rows={[
              { label: "Hãng", value: mainboard?.manufacturer },
              { label: "Model", value: mainboard?.product },
              { label: "Serial", value: mainboard?.serial || "—" },
              { label: "BIOS", value: mainboard?.biosVersion || bios?.version || "—" },
            ]}
          />
        </SectionCard>

        {/* Battery */}
        <SectionCard
          icon={<BatteryFull className="h-4 w-4" />}
          title="Pin"
          status={status.battery}
          errorMessage={errors.battery}
          onCopy={() => copyText("Battery", battery?.name)}
        >
          {battery ? (
            <SpecTable
              rows={[
                { label: "Tên", value: battery.name },
                {
                  label: "Dung lượng",
                  value: battery.designCapacityMwh && battery.fullChargeCapacityMwh
                    ? `${(battery.fullChargeCapacityMwh / 1000).toFixed(0)} / ${(battery.designCapacityMwh / 1000).toFixed(0)} Wh`
                    : "—",
                },
                { label: "Sức khỏe", value: battery.healthPct ? `${battery.healthPct}%` : "—" },
                { label: "Chu kỳ", value: battery.cycleCount ? `${battery.cycleCount} cycles` : "—" },
              ]}
            />
          ) : (
            <p className="text-xs text-muted-foreground">Không có pin (máy bàn).</p>
          )}
        </SectionCard>

        {/* OS */}
        <SectionCard
          icon={<Monitor className="h-4 w-4" />}
          title="Hệ điều hành"
          status={status.os}
          errorMessage={errors.os}
          onCopy={() => copyText("OS", os?.caption)}
        >
          <SpecTable
            rows={[
              { label: "Hostname", value: os?.hostname },
              { label: "OS", value: os?.caption ? `${os.caption} ${os.version ?? ""}`.trim() : "—" },
              { label: "Build", value: os?.build || "—" },
              {
                label: "Kích hoạt",
                value: os?.activated === null || os?.activated === undefined
                  ? "—" : os.activated ? "Có" : "Chưa",
              },
            ]}
          />
        </SectionCard>

        {/* Network */}
        <SectionCard
          icon={<Network className="h-4 w-4" />}
          title="Mạng"
          status={status.network}
          errorMessage={errors.network}
          onCopy={() => copyText("Network", network.map((n) => `${n.name} ${n.mac}`).join("\n"))}
        >
          {network.length === 0 ? (
            <p className="text-xs text-muted-foreground">Không có adapter mạng.</p>
          ) : (
            <div className="space-y-1.5">
              {network.map((n, i) => (
                <div key={i} className="text-[11px]">
                  <div className="font-medium">{n.name ?? `NIC ${i + 1}`}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-muted-foreground">
                    <span className="font-mono text-[10px]">{n.mac ?? "?"}</span>
                    {n.ipv4.length > 0 && <span>{n.ipv4[0]}</span>}
                    {n.speedMbps && <span>{n.speedMbps}Mbps</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <p className="text-[10px] text-muted-foreground">
        {streaming
          ? "Đang thu thập từ WMI + Registry…"
          : doneAt
            ? `Hoàn tất lúc ${new Date(doneAt).toLocaleTimeString("vi-VN")} · PowerShell WMI/Registry · dữ liệu lưu cache, chuyển tab không cần quét lại`
            : "—"}
      </p>
    </div>
  );
}
