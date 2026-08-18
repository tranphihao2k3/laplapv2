import * as React from "react";
import { Send, ExternalLink, FileJson, AlertTriangle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore } from "@/store";

interface UploadResponseData {
  redirectUrl?: string;
  uploadId?: string;
  laptopId?: string;
  saved?: Record<string, unknown>;
}

export function UploadTab() {
  const { session, hardware, benchmark, setBenchmark, tests } = useSessionStore();
  const [busy, setBusy] = React.useState(false);
  const [redirectUrl, setRedirectUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const summary = React.useMemo(() => {
    return {
      hasSession: !!session,
      hasHardware: !!hardware,
      hasBenchmark: !!benchmark,
      testCount: tests.length,
      passCount: tests.filter((t) => t.result === "pass").length,
      failCount: tests.filter((t) => t.result === "fail").length,
    };
  }, [session, hardware, benchmark, tests]);

  const buildPayload = () => {
    const base = {
      payloadVersion: "mini-tool-v1" as const,
      capturedAt: new Date().toISOString(),
      device: {
        deviceId: window.lap.platform,
        deviceName: (hardware?.osInfo as { hostname?: string } | null)?.hostname ?? "",
        os: hardware?.osInfo,
      },
      hardware: hardware ?? undefined,
      benchmark: benchmark ?? undefined,
      tests: tests.map((t) => ({
        type: t.type,
        result: t.result,
        payload: t.payload,
        capturedAt: t.capturedAt,
      })),
    };
    return base;
  };

  const handlePreviewJson = () => {
    const json = JSON.stringify(buildPayload(), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laplap-mini-tool-payload-${Date.now()}.json`;
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
      // Step 1: ask main process to build payload (it adds nonce).
      const buildRes = await window.lap.upload.build({
        hardware: hardware ?? undefined,
        benchmark: benchmark ?? undefined,
        tests,
      });
      if (!buildRes.ok || !buildRes.data) {
        throw new Error(buildRes.error ?? "Không build được payload");
      }
      // Step 2: send via main process (signs + posts).
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
    if (!res.ok) {
      toast.error(res.error ?? "Không mở được URL");
    }
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Session" value={summary.hasSession ? "Sẵn sàng" : "Thiếu"} ok={summary.hasSession} />
            <Stat label="Phần cứng" value={summary.hasHardware ? `${(hardware?.diskLayout ?? []).length ?? 0} ổ` : "Thiếu"} ok={summary.hasHardware} />
            <Stat label="Benchmark" value={summary.hasBenchmark ? `${benchmark?.score} điểm` : "Chưa có"} ok={summary.hasBenchmark} />
            <Stat label="Tests" value={`${summary.passCount} OK / ${summary.failCount} lỗi`} ok={summary.testCount > 0} />
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSubmit} disabled={busy || !session.sid}>
              <Send className="h-4 w-4" /> {busy ? "Đang upload..." : "Upload lên web"}
            </Button>
            <Button variant="outline" onClick={handlePreviewJson}>
              <FileJson className="h-4 w-4" /> Xuất JSON
            </Button>
            {benchmark ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBenchmark(null)}
                className="text-xs text-muted-foreground"
              >
                <RefreshCcw className="h-3 w-3" /> Reset benchmark
              </Button>
            ) : null}
          </div>

          {busy ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {redirectUrl ? (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
              <p className="font-medium text-emerald-300">Đã upload thành công</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                Redirect URL: <span className="font-mono">{redirectUrl}</span>
              </p>
              <Button className="mt-2" size="sm" onClick={handleOpenRedirect}>
                <ExternalLink className="h-4 w-4" /> Mở trang ranking
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: React.ReactNode; ok: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-2.5 text-sm">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
      <Badge variant={ok ? "secondary" : "outline"} className="mt-1 text-[10px]">
        {ok ? "OK" : "Thiếu"}
      </Badge>
    </div>
  );
}