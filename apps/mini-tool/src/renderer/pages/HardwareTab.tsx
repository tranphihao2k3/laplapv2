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
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatBytes } from "@/lib/utils";
import { useSessionStore } from "@/store";

interface SpecRow {
  label: string;
  value: unknown;
}

function SpecTable({ rows }: { rows: SpecRow[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-3 items-baseline gap-2">
          <dt className="text-xs uppercase tracking-wider text-muted-foreground">
            {row.label}
          </dt>
          <dd className="col-span-2 break-words text-foreground">
            {renderValue(row.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "Có" : "Không";
  return JSON.stringify(value);
}

function copyText(label: string, value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  if (!text) return;
  void navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`Đã copy ${label}`))
    .catch(() => toast.error("Không copy được"));
}

export function HardwareTab() {
  const { hardware, setHardware } = useSessionStore();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.lap.hardware.collect();
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? "Không thu thập được phần cứng");
      }
      setHardware(result.data);
    } catch (err) {
      setError((err as Error).message);
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [setHardware]);

  React.useEffect(() => {
    if (!hardware && !loading) {
      void load();
    }
    // intentionally only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = () => {
    if (!hardware) return;
    const blob = new Blob([JSON.stringify(hardware, null, 2)], {
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

  const cpu = hardware?.cpu as Record<string, unknown> | null;
  const memory = hardware?.memory as Record<string, unknown> | null;
  const disks = (hardware?.diskLayout as Record<string, unknown>[] | null) ?? [];
  const graphics = hardware?.graphics as Record<string, unknown> | null;
  const system = hardware?.system as Record<string, unknown> | null;
  const battery = hardware?.battery as Record<string, unknown> | null;
  const os = hardware?.osInfo as Record<string, unknown> | null;
  const network = (hardware?.networkInterfaces as Record<string, unknown>[] | null) ?? [];
  const baseboard = hardware?.baseboard as Record<string, unknown> | null;
  const bios = hardware?.bios as Record<string, unknown> | null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Phần cứng</h2>
          <p className="text-sm text-muted-foreground">
            Quét nhanh toàn bộ thông tin máy tính bằng WMI + PowerShell.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} /> Làm mới
          </Button>
          <Button onClick={handleExport} disabled={!hardware}>
            <Download className="h-4 w-4" /> Xuất JSON
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-2 py-3 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <p>{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HardwareCard
          icon={<Cpu className="h-5 w-5" />}
          title="CPU"
          loading={loading && !hardware}
          onCopy={() => copyText("CPU", cpu?.["brand"] ?? cpu?.["manufacturer"])}
          rows={[
            { label: "Tên", value: cpu?.["brand"] },
            { label: "Hãng", value: cpu?.["manufacturer"] },
            { label: "Nhân / Luồng", value: `${cpu?.["cores"] ?? "?"} / ${cpu?.["physicalCores"] ?? cpu?.["cores"] ?? "?"}` },
            { label: "Xung nhịp", value: `${cpu?.["speed"] ?? "?"} GHz @ ${cpu?.["speedMin"] ?? "?"} GHz` },
            { label: "Socket", value: cpu?.["socket"] },
          ]}
        />
        <HardwareCard
          icon={<MemoryStick className="h-5 w-5" />}
          title="RAM"
          loading={loading && !hardware}
          onCopy={() => copyText("RAM", memory?.["total"])}
          rows={[
            {
              label: "Tổng",
              value: memory?.["total"] ? formatBytes(Number(memory["total"])) : "—",
            },
            { label: "Trống", value: memory?.["available"] ? formatBytes(Number(memory["available"])) : "—" },
            { label: "Đang dùng", value: memory?.["active"] ? formatBytes(Number(memory["active"])) : "—" },
          ]}
        />
        <HardwareCard
          icon={<HardDrive className="h-5 w-5" />}
          title="Ổ cứng"
          loading={loading && !hardware}
          onCopy={() => copyText("Disk", disks.map((d) => d["name"]).join(" | "))}
          rows={
            disks.length === 0
              ? [{ label: "Số ổ", value: 0 }]
              : disks.map((d, i) => ({
                  label: `Ổ ${i + 1}`,
                  value: (
                    <span>
                      <span className="font-medium">{String(d["name"] ?? "?")}</span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {String(d["type"] ?? "?")} · {d["size"] ? formatBytes(Number(d["size"])) : "?"}
                      </span>
                    </span>
                  ),
                }))
          }
        />
        <HardwareCard
          icon={<Monitor className="h-5 w-5" />}
          title="GPU"
          loading={loading && !hardware}
          onCopy={() => copyText("GPU", graphics?.["controllers"])}
          rows={[
            {
              label: "VGA",
              value: Array.isArray(graphics?.["controllers"])
                ? (graphics!["controllers"] as unknown[]).map((c) => String((c as Record<string, unknown>)["model"] ?? c)).join(", ")
                : String(graphics?.["controllers"] ?? "—"),
            },
            { label: "Vendor", value: graphics?.["vendor"] },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SmallCard
          icon={<CircuitBoard className="h-4 w-4" />}
          title="Mainboard"
          loading={loading && !hardware}
          onCopy={() => copyText("Mainboard", baseboard?.["model"])}
          rows={[
            { label: "Model", value: baseboard?.["model"] },
            { label: "Hãng", value: baseboard?.["manufacturer"] },
            { label: "Serial", value: baseboard?.["serial"] },
            { label: "Version", value: baseboard?.["version"] },
          ]}
        />
        <SmallCard
          icon={<BatteryFull className="h-4 w-4" />}
          title="Pin"
          loading={loading && !hardware}
          onCopy={() => copyText("Battery", battery?.["model"])}
          rows={[
            { label: "Model", value: battery?.["model"] },
            {
              label: "Sạc",
              value:
                battery?.["percent"] !== undefined
                  ? `${battery?.["percent"]}%${battery?.["charging"] ? " (đang sạc)" : ""}`
                  : "—",
            },
            { label: "Loại", value: battery?.["type"] },
          ]}
        />
        <SmallCard
          icon={<Monitor className="h-4 w-4" />}
          title="Hệ điều hành"
          loading={loading && !hardware}
          onCopy={() => copyText("OS", os?.["hostname"])}
          rows={[
            { label: "Hostname", value: os?.["hostname"] },
            { label: "OS", value: `${os?.["platform"] ?? "?"} ${os?.["release"] ?? ""}` },
            { label: "Kernel", value: os?.["kernel"] },
            { label: "Kiến trúc", value: os?.["arch"] },
            { label: "Serial hệ thống", value: system?.["serial"] },
            { label: "BIOS", value: bios?.["version"] },
          ]}
        />
        <SmallCard
          icon={<Network className="h-4 w-4" />}
          title="Mạng"
          loading={loading && !hardware}
          onCopy={() => copyText("Network", network.map((n) => n["mac"]).join(" | "))}
          rows={
            network.length === 0
              ? [{ label: "Adapters", value: 0 }]
              : network.map((n, i) => ({
                  label: n["iface"] ? String(n["iface"]) : `NIC ${i + 1}`,
                  value: (
                    <span>
                      <span className="font-mono">{String(n["mac"] ?? "?")}</span>
                      {n["ip4"] ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {String(n["ip4"])}
                        </span>
                      ) : null}
                    </span>
                  ),
                }))
          }
        />
      </div>

      {hardware?.collectedAt ? (
        <p className="text-xs text-muted-foreground">
          Cập nhật lần cuối: {new Date(hardware.collectedAt).toLocaleString("vi-VN")}
        </p>
      ) : null}
    </div>
  );
}

interface CardProps {
  icon: React.ReactNode;
  title: string;
  loading?: boolean;
  onCopy?: () => void;
  rows: SpecRow[];
}

function HardwareCard({ icon, title, loading, onCopy, rows }: CardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex items-start gap-2">
          <div className="rounded-md bg-primary/10 p-1.5 text-primary">{icon}</div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">Thông tin chính</CardDescription>
          </div>
        </div>
        {onCopy ? (
          <Button variant="ghost" size="icon" onClick={onCopy} aria-label={`Copy ${title}`}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <SpecTable rows={rows} />
        )}
      </CardContent>
    </Card>
  );
}

function SmallCard(props: CardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{props.icon}</span>
          <CardTitle className="text-sm">{props.title}</CardTitle>
        </div>
        {props.onCopy ? (
          <Button variant="ghost" size="icon" onClick={props.onCopy} aria-label={`Copy ${props.title}`}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        {props.loading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : (
          <SpecTable rows={props.rows} />
        )}
      </CardContent>
    </Card>
  );
}