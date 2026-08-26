// UploadTab.tsx — Upload kết quả test lên web với preview
import * as React from "react";
import { Send, ExternalLink, FileJson, AlertTriangle, RefreshCcw, ChevronDown, ChevronRight, CheckCircle2, XCircle, Monitor, Zap, Cpu } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore } from "@/store";
import { cn } from "@/lib/utils";

interface UploadResponseData {
  redirectUrl?: string;
  uploadId?: string;
  laptopId?: string;
  saved?: Record<string, unknown>;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

function SummaryBadge({ label, ok, detail }: { label: string; ok: boolean; detail: React.ReactNode }) {
  return (
    <div className={cn(
      "flex flex-col items-center gap-1 rounded-lg border p-3 text-center",
      ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
    )}>
      {ok ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      ) : (
        <AlertTriangle className="h-5 w-5 text-amber-500" />
      )}
      <span className="text-xs font-medium">{label}</span>
      <span className="text-[10px] text-muted-foreground">{detail}</span>
    </div>
  );
}

export function UploadTab() {
  const { session, hardware, benchmark, setBenchmark, tests } = useSessionStore();
  const [busy, setBusy] = React.useState(false);
  const [redirectUrl, setRedirectUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const passCount = tests.filter((t) => t.result === "pass").length;
  const failCount = tests.filter((t) => t.result === "fail").length;

  const buildPayload = React.useMemo(() => ({
    payloadVersion: "mini-tool-v1" as const,
    capturedAt: new Date().toISOString(),
    device: {
      deviceId: window.lap.platform,
      deviceName: hardware?.os && typeof hardware.os === "object" ? (hardware.os as { hostname?: string }).hostname ?? "" : "",
      os: hardware?.os,
    },
    hardware: hardware ?? undefined,
    benchmark: benchmark ?? undefined,
    tests: tests.map((t) => ({
      type: t.type,
      result: t.result,
      payload: t.payload,
      capturedAt: t.capturedAt,
    })),
  }), [hardware, benchmark, tests]);

  const handlePreviewJson = () => {
    const json = JSON.stringify(buildPayload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laplap-mini-tool-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Đã xuất JSON payload");
  };

  const handleSubmit = async () => {
    if (!session?.sid) {
      toast.error("Chưa kết nối session. Vui lòng vào tab Kết nối trước.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const buildRes = await window.lap.upload.build({
        hardware: hardware ?? undefined,
        benchmark: benchmark ?? undefined,
        tests,
      });
      if (!buildRes.ok || !buildRes.data) {
        throw new Error(buildRes.error ?? "Không build được payload");
      }
      const sendRes = await window.lap.upload.send(buildRes.data);
      if (!sendRes.ok || !sendRes.data) {
        throw new Error(sendRes.error ?? "Không gửi được");
      }
      const data = sendRes.data as { data?: UploadResponseData } & UploadResponseData;
      const inner = (data && typeof data === "object" && "data" in data ? data.data : data) as
        | UploadResponseData
        | undefined;
      const url = inner?.redirectUrl;
      if (url) setRedirectUrl(url);
      toast.success("Đã upload thành công");
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleOpenRedirect = async () => {
    if (!redirectUrl) return;
    const res = await window.lap.shell.openExternal(redirectUrl);
    if (!res.ok) toast.error(res.error ?? "Không mở được URL");
  };

  if (!session) {
    return (
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="flex items-start gap-2 py-4 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <p>
            Chưa kết nối session. Vui lòng vào tab <strong>Kết nối</strong> để dán URL/sid từ web.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryBadge
          label="Phần cứng"
          ok={!!hardware}
          detail={hardware ? (
            <>
              {hardware.cpu?.name?.split(" ").slice(0, 3).join(" ") ?? "—"}
              {hardware.memory?.totalBytes ? ` · ${formatBytes(hardware.memory.totalBytes)} RAM` : ""}
            </>
          ) : "Chưa quét"}
        />
        <SummaryBadge
          label="Benchmark"
          ok={!!benchmark}
          detail={benchmark
            ? `${benchmark.score} điểm${benchmark.fps ? ` · ${benchmark.fps} fps` : ""}`
            : "Chưa test"}
        />
        <SummaryBadge
          label="Kiểm tra"
          ok={tests.length > 0}
          detail={
            tests.length === 0
              ? "Chưa test"
              : `${passCount} OK · ${failCount} lỗi`
          }
        />
        <SummaryBadge
          label="Session"
          ok={true}
          detail={session.uploadUrl ? "Đã kết nối" : "SID only"}
        />
      </div>

      {/* ── Preview ── */}
      <Card>
        <CardHeader className="cursor-pointer select-none" onClick={() => setPreviewOpen(!previewOpen)}>
          <CardTitle className="flex items-center gap-2 text-base">
            {previewOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Xem trước dữ liệu upload
          </CardTitle>
          <CardDescription>
            Nhấn để xem chi tiết nội dung sẽ được gửi lên server.
          </CardDescription>
        </CardHeader>

        {previewOpen && (
          <CardContent className="space-y-3">
            {/* Hardware preview */}
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phần cứng</span>
              </div>
              {hardware ? (
                <div className="space-y-1 text-xs">
                  {hardware.cpu?.name && (
                    <div className="flex gap-2">
                      <span className="w-16 text-muted-foreground">CPU:</span>
                      <span className="font-medium">{hardware.cpu.name}</span>
                    </div>
                  )}
                  {hardware.memory?.totalBytes && (
                    <div className="flex gap-2">
                      <span className="w-16 text-muted-foreground">RAM:</span>
                      <span>{formatBytes(hardware.memory.totalBytes)}</span>
                    </div>
                  )}
                  {(hardware.disks ?? []).length > 0 && (
                    <div className="flex gap-2">
                      <span className="w-16 text-muted-foreground">Disk:</span>
                      <span>{hardware.disks.map((d) => `${d.name ?? "?"} ${d.capacityGb}GB ${d.type ?? ""}`).join(", ")}</span>
                    </div>
                  )}
                  {(hardware.gpu ?? []).length > 0 && (
                    <div className="flex gap-2">
                      <span className="w-16 text-muted-foreground">GPU:</span>
                      <span>{hardware.gpu.map((g) => g.name ?? "?").join(", ")}</span>
                    </div>
                  )}
                  {hardware.os?.hostname && (
                    <div className="flex gap-2">
                      <span className="w-16 text-muted-foreground">Host:</span>
                      <span className="font-mono">{hardware.os.hostname}</span>
                    </div>
                  )}
                  {hardware.os?.caption && (
                    <div className="flex gap-2">
                      <span className="w-16 text-muted-foreground">OS:</span>
                      <span>{hardware.os.caption}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Chưa quét phần cứng.</p>
              )}
            </div>

            {/* Benchmark preview */}
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Benchmark</span>
              </div>
              {benchmark ? (
                <div className="space-y-1 text-xs">
                  <div className="flex gap-2">
                    <span className="w-16 text-muted-foreground">Tool:</span>
                    <span className="font-medium">{benchmark.tool}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-16 text-muted-foreground">Score:</span>
                    <span>{benchmark.score} điểm</span>
                    {benchmark.fps ? <span>· {benchmark.fps} fps</span> : null}
                  </div>
                  {benchmark.preset && (
                    <div className="flex gap-2">
                      <span className="w-16 text-muted-foreground">Preset:</span>
                      <span>{benchmark.preset}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Chưa chạy benchmark.</p>
              )}
            </div>

            {/* Tests preview */}
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Kiểm tra ({tests.length})
                </span>
              </div>
              {tests.length > 0 ? (
                <div className="space-y-1">
                  {tests.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {t.result === "pass" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : t.result === "fail" ? (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      <span className="capitalize">{t.type}</span>
                      <span className={cn(
                        "ml-auto text-[10px] uppercase tracking-wider font-medium",
                        t.result === "pass" ? "text-emerald-400" :
                        t.result === "fail" ? "text-red-400" : "text-amber-400"
                      )}>
                        {t.result}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Chưa chạy test nào.</p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Actions ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" /> Upload kết quả
          </CardTitle>
          <CardDescription>
            Tool sẽ ký HMAC-SHA256 và POST payload lên <span className="font-mono">{session.uploadUrl || "/api/v1/mini-tool/upload"}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSubmit} disabled={busy || !session.sid}>
              <Send className="mr-1 h-4 w-4" /> {busy ? "Đang upload..." : "Upload lên web"}
            </Button>
            <Button variant="outline" onClick={handlePreviewJson}>
              <FileJson className="mr-1 h-4 w-4" /> Xuất JSON
            </Button>
            {benchmark ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBenchmark(null)}
                className="text-xs text-muted-foreground"
              >
                <RefreshCcw className="mr-1 h-3 w-3" /> Reset benchmark
              </Button>
            ) : null}
          </div>

          {busy && (
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {redirectUrl && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
              <p className="font-medium text-emerald-300">Đã upload thành công</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                Redirect: <span className="font-mono">{redirectUrl}</span>
              </p>
              <Button className="mt-2" size="sm" onClick={handleOpenRedirect}>
                <ExternalLink className="mr-1 h-4 w-4" /> Mở trang kết quả
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
