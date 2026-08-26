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

const INITIAL_DATA: CollectedHardware = {
  cpu: null, memory: null, disks: [], gpu: [],
  mainboard: null, bios: null, battery: null, os: null, network: [],
  collectedAt: "", source: "powershell-enhanced",
};

export function HardwareTab() {
  const { setHardware } = useSessionStore();
  const [data, setData] = React.useState<CollectedHardware>(INITIAL_DATA);
  const [status, setStatus] = React.useState<Record<string, PartStatus>>({
    cpu: "loading", memory: "loading", disks: "loading", gpu: "loading",
    mainboard: "loading", bios: "loading", battery: "loading",
    os: "loading", network: "loading",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [streaming, setStreaming] = React.useState(false);
  const [doneAt, setDoneAt] = React.useState<string | null>(null);

  const start = React.useCallback(async () => {
    setData(INITIAL_DATA);
    setStatus({
      cpu: "loading", memory: "loading", disks: "loading", gpu: "loading",
      mainboard: "loading", bios: "loading", battery: "loading",
      os: "loading", network: "loading",
    });
    setErrors({});
    setDoneAt(null);
    setStreaming(true);
    const res = await window.lap.hardware.collect();
    if (!res.ok) {
      setStreaming(false);
      toast.error(`Không khởi động được: ${res.error ?? "lỗi"}`);
    }
  }, []);

  React.useEffect(() => {
    const off = window.lap.hardware.onPart((part: HardwarePart) => {
      if (part.key === "__done__") {
        setStreaming(false);
        setDoneAt(new Date().toISOString());
        // Save hardware data to store for upload
        setData((prev) => {
          const snapshot = { ...prev, collectedAt: new Date().toISOString(), source: "powershell-enhanced" };
          setHardware(snapshot);
          return snapshot;
        });
        setStatus((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
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
      if (!part.ok) {
        setErrors((e) => ({ ...e, [part.key]: part.error }));
        setStatus((s) => ({ ...s, [part.key]: "error" }));
        return;
      }
      setStatus((s) => ({ ...s, [part.key]: "ready" }));
      setData((d) => ({ ...d, [part.key]: (part as { data: unknown }).data } as CollectedHardware));
    });
    void start();
    return () => { off(); void window.lap.hardware.cancel(); };
  }, [start]);

  const handleRefresh = () => { void window.lap.hardware.cancel(); void start(); };

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Phần cứng</h2>
          <p className="text-sm text-muted-foreground">
            Quét chi tiết qua WMI + Registry + SMBIOS — lấy thông tin chuẩn xác.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={streaming}>
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Làm mới
          </Button>
          <Button onClick={handleExport} disabled={!doneAt}>
            <Download className="h-4 w-4" /> Xuất JSON
          </Button>
        </div>
      </div>

      {/* ── CPU ── */}
      <SectionCard
        icon={<Cpu className="h-5 w-5" />}
        title="CPU"
        status={status.cpu}
        errorMessage={errors.cpu}
        onCopy={() => copyText("CPU", cpu?.name)}
      >
        <SpecTable
          rows={[
            { label: "Tên", value: cpu?.name },
            { label: "Hãng", value: normalizeMaker(cpu?.manufacturer) },
            { label: "Kiến trúc", value: cpu?.architecture || "—" },
            { label: "Nhân / Luồng", value: cpu?.cores && cpu?.threads ? `${cpu.cores} nhân / ${cpu.threads} luồng` : "—" },
            { label: "Xung cơ bản", value: cpu?.baseGhz ? `${cpu.baseGhz} GHz` : "—" },
            { label: "Xung Turbo", value: cpu?.turboGhz ? `${cpu.turboGhz} GHz` : "—" },
            { label: "Socket", value: cpu?.socket || "—" },
            { label: "TDP", value: cpu?.tdpW ? `${cpu.tdpW} W` : "—" },
            { label: "Cache L1", value: formatCache(cpu?.cacheL1Kb ?? null) },
            { label: "Cache L2", value: formatCache(cpu?.cacheL2Kb ?? null) },
            { label: "Cache L3", value: formatCache(cpu?.cacheL3Kb ?? null) },
          ]}
        />
      </SectionCard>

      {/* ── RAM ── */}
      <SectionCard
        icon={<MemoryStick className="h-5 w-5" />}
        title="RAM"
        status={status.memory}
        errorMessage={errors.memory}
        onCopy={() => copyText("RAM", formatBytes(totalMemBytes))}
      >
        <div className="space-y-3">
          <SpecTable
            rows={[
              { label: "Tổng", value: formatBytes(totalMemBytes) },
              { label: "Số thanh", value: memory?.slots ?? "—" },
              ...(memory?.platformMaxMhz ? [{
                label: "Bus nền tảng",
                value: `${memory.platformMaxMhz} MHz · ${memory.platformCpuName ?? "—"}`,
              }] : []),
            ]}
          />
          {memory?.modules && memory.modules.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Chi tiết từng thanh:</p>
              <ul className="space-y-1 text-xs">
                {memory.modules.map((m, i) => {
                  const running = m.configuredMhz ?? m.speedMhz;
                  const platformMax = m.platformMaxMhz ?? memory.platformMaxMhz;
                  const belowSpec = typeof running === "number" && typeof platformMax === "number" && running < platformMax;
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-2 rounded border border-border/40 bg-muted/30 px-2 py-1">
                      <span className="font-mono font-medium">{m.slot ?? `Slot ${i + 1}`}</span>
                      <span className="text-muted-foreground">·</span>
                      <span>{formatBytes(m.sizeBytes)}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className={cn(
                        "font-medium",
                        (m.generation ?? memGen(m.type)) === "DDR5" ? "text-blue-400" :
                        (m.generation ?? memGen(m.type)) === "DDR4" ? "text-green-400" : "text-zinc-400"
                      )}>
                        {m.generation ?? memGen(m.type)}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span>
                        {running ? `${running} MHz` : "—"}
                        {platformMax ? (
                          <span className="text-muted-foreground"> / {platformMax} MHz</span>
                        ) : null}
                      </span>
                      {m.clTiming ? (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-mono text-[10px]">CL {m.clTiming}</span>
                        </>
                      ) : null}
                      {m.voltageMv ? (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{m.voltageMv} mV</span>
                        </>
                      ) : null}
                      {m.partNumber ? (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-mono text-[10px]">{m.partNumber}</span>
                        </>
                      ) : null}
                      {m.manufacturer ? (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{m.manufacturer}</span>
                        </>
                      ) : null}
                      {belowSpec ? (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">
                          dưới spec
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Disk ── */}
      <SectionCard
        icon={<HardDrive className="h-5 w-5" />}
        title="Ổ cứng"
        status={status.disks}
        errorMessage={errors.disks}
        onCopy={() => copyText("Disk", disks.map((d) => `${d.name} (${d.capacityGb}GB ${d.type})`).join("\n"))}
      >
        {disks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không tìm thấy ổ đĩa.</p>
        ) : (
          <div className="space-y-2">
            {disks.map((d, i) => {
              const isNvme = (d.type ?? "").toLowerCase().includes("nvme");
              const isSsd = isNvme || (d.type ?? "").toLowerCase() === "ssd";
              const typeClass = isNvme ? "bg-emerald-500/15 text-emerald-300"
                : isSsd ? "bg-sky-500/15 text-sky-300"
                : (d.type ?? "").toLowerCase() === "hdd" ? "bg-zinc-500/15 text-zinc-400"
                : (d.type ?? "").toLowerCase() === "usb" ? "bg-amber-500/15 text-amber-300"
                : "bg-muted text-muted-foreground";
              return (
                <div key={i} className="rounded border border-border/40 bg-muted/20 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-semibold">{d.name ?? "?"}</span>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider", typeClass)}>
                      {d.type ?? "Unknown"}
                    </span>
                    <span className="text-muted-foreground">{d.capacityGb ? `${d.capacityGb} GB` : "?"}</span>
                    {d.freeGb ? (
                      <span className="text-muted-foreground">· {d.freeGb} GB trống</span>
                    ) : null}
                    {d.interfaceType && d.interfaceType !== "Unknown" ? (
                      <span className="text-muted-foreground">· {d.interfaceType}</span>
                    ) : null}
                    {d.firmwareRevision ? (
                      <span className="font-mono text-[10px] text-muted-foreground">FW: {d.firmwareRevision}</span>
                    ) : null}
                    {d.tempC ? (
                      <span className="text-muted-foreground">· {d.tempC}°C</span>
                    ) : null}
                    {d.serialNumber && d.serialNumber !== "To be filled by O.E.M." ? (
                      <span className="font-mono text-[10px] text-muted-foreground">SN: {d.serialNumber}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── GPU ── */}
      <SectionCard
        icon={<Monitor className="h-5 w-5" />}
        title="GPU / VGA"
        status={status.gpu}
        errorMessage={errors.gpu}
        onCopy={() => copyText("GPU", gpus.map((g) => g.name).join(", "))}
      >
        {gpus.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không tìm thấy GPU.</p>
        ) : (
          <div className="space-y-2">
            {gpus.map((g, i) => (
              <div key={i} className="rounded border border-border/40 bg-muted/20 px-3 py-2">
                <div className="font-semibold text-sm">{g.name ?? "?"}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {g.vramMb ? (
                    <span className="font-mono">{g.vramMb} MB VRAM</span>
                  ) : null}
                  {g.vramType ? (
                    <span>{g.vramType}</span>
                  ) : null}
                  {g.driverVersion ? (
                    <span>Driver {g.driverVersion}</span>
                  ) : null}
                  {g.computeUnits ? (
                    <span>{g.computeUnits} cores</span>
                  ) : null}
                  {g.busWidth ? (
                    <span>{g.busWidth}-bit</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Bottom grid ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              { label: "Phiên bản", value: mainboard?.version || "—" },
              { label: "Serial", value: mainboard?.serial || "—" },
              { label: "BIOS Ver", value: mainboard?.biosVersion || bios?.version || "—" },
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
                { label: "Trạng thái", value: battery.status },
                { label: "Hóa học", value: chemName(battery.chemistry) },
                {
                  label: "Dung lượng",
                  value: battery.designCapacityMwh && battery.fullChargeCapacityMwh
                    ? `${(battery.fullChargeCapacityMwh / 1000).toFixed(0)} / ${(battery.designCapacityMwh / 1000).toFixed(0)} Wh`
                    : "—",
                },
                { label: "Sức khỏe", value: battery.healthPct ? `${battery.healthPct}%` : "—" },
                { label: "Chu kỳ", value: battery.cycleCount ? `${battery.cycleCount} cycles` : "—" },
                { label: "Điện áp", value: battery.voltageMv ? `${(battery.voltageMv / 1000).toFixed(2)} V` : "—" },
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Không có pin (máy bàn).</p>
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
              {
                label: "Hệ điều hành",
                value: os?.caption ? `${os.caption} ${os.version ?? ""}`.trim() : "—",
              },
              { label: "Build", value: os?.build || "—" },
              { label: "Kiến trúc", value: os?.arch || "—" },
              {
                label: "Kích hoạt",
                value: os?.activated === null || os?.activated === undefined
                  ? "—" : os.activated ? "Có" : "Chưa",
              },
              { label: "Serial hệ thống", value: os?.serial || "—" },
              { label: "BIOS", value: bios?.version ?? "—" },
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
            <p className="text-sm text-muted-foreground">Không có adapter mạng.</p>
          ) : (
            <div className="space-y-2">
              {network.map((n, i) => (
                <div key={i} className="text-xs">
                  <div className="font-medium text-sm">{n.name ?? `NIC ${i + 1}`}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                    <span className="font-mono">{n.mac ?? "?"}</span>
                    {n.ipv4.length > 0 && <span>{n.ipv4.join(", ")}</span>}
                    {n.speedMbps ? <span>{n.speedMbps} Mbps</span> : null}
                    {n.driverVersion ? <span>Driver {n.driverVersion}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <p className="text-xs text-muted-foreground">
        {streaming
          ? "Đang thu thập từ WMI + Registry…"
          : doneAt
            ? `Hoàn tất lúc ${new Date(doneAt).toLocaleString("vi-VN")} · nguồn: PowerShell WMI/Registry`
            : "—"}
      </p>
    </div>
  );
}
