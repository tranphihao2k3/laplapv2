// WifiTester.tsx — Kiểm tra WiFi adapter va ket noi
import * as React from "react";
import { Wifi, RefreshCcw, CheckCircle2, XCircle, Signal } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSessionStore } from "@/store";

interface WifiNetwork {
  ssid: string;
  bssid: string;
  signalDbm: number;
  frequencyGhz: number;
  security: string;
  connected: boolean;
}

interface WifiAdapter {
  name: string;
  description: string;
  mac: string;
  status: string;
  speedMbps: number | null;
}

interface WifiScanResult {
  adapters: WifiAdapter[];
  networks: WifiNetwork[];
  ok: boolean;
}

export function WifiTester() {
  const { upsertTest } = useSessionStore();
  const [loading, setLoading] = React.useState(false);
  const [adapters, setAdapters] = React.useState<WifiAdapter[]>([]);
  const [networks, setNetworks] = React.useState<WifiNetwork[]>([]);
  const [result, setResult] = React.useState<"pass" | "fail" | null>(null);

  const scanWifi = async () => {
    setLoading(true);
    setResult(null);
    setAdapters([]);
    setNetworks([]);
    try {
      const res = await window.lap.optimize.scanWifi();
      if (!res.ok) {
        toast.error(res.error ?? "Scan WiFi that bai");
        return;
      }
      const stdout = res.data?.stdout ?? "";
      try {
        const parsed = JSON.parse(stdout.trim()) as WifiScanResult;
        setAdapters(Array.isArray(parsed.adapters) ? parsed.adapters : []);
        setNetworks(Array.isArray(parsed.networks) ? parsed.networks : []);
        const count = (Array.isArray(parsed.networks) ? parsed.networks.length : 0);
        const adapterCount = (Array.isArray(parsed.adapters) ? parsed.adapters.length : 0);
        toast.success(`Tim thay ${adapterCount} adapter, ${count} mang WiFi`);
      } catch {
        toast.error("Khong the parse ket qua WiFi");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const recordResult = (verdict: "pass" | "fail") => {
    setResult(verdict);
    upsertTest({
      type: "wifi",
      result: verdict,
      payload: { adapterCount: adapters.length, networkCount: networks.length },
      capturedAt: new Date().toISOString(),
    });
    toast[verdict === "pass" ? "success" : "error"](
      verdict === "pass" ? "WiFi OK" : "WiFi co van de",
    );
  };

  const signalBars = (dbm: number): number => {
    if (dbm >= -50) return 4;
    if (dbm >= -60) return 3;
    if (dbm >= -70) return 2;
    if (dbm >= -80) return 1;
    return 0;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" /> Test WiFi
        </CardTitle>
        <CardDescription>
          Quet WiFi adapter va cac mang xung quanh. Kiem tra driver, ket noi va cuong do tin hieu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={scanWifi} disabled={loading}>
            {loading ? (
              <RefreshCcw className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Wifi className="mr-1 h-4 w-4" />
            )}
            {loading ? "Dang quet..." : "Quet WiFi"}
          </Button>
        </div>

        {adapters.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Adapter ({adapters.length})
            </p>
            {adapters.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs">
                <Wifi className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{a.name || "(khong co ten)"}</p>
                  <p className="text-muted-foreground">{a.description}</p>
                </div>
                <Badge variant={a.status === "connected" ? "secondary" : "outline"} className="ml-auto">
                  {a.status}
                </Badge>
                {a.speedMbps && <span className="text-muted-foreground">{a.speedMbps} Mbps</span>}
              </div>
            ))}
          </div>
        )}

        {networks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mang WiFi ({networks.length})
            </p>
            {networks.map((n, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-xs">
                <Signal className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{n.ssid || "(an)"}</p>
                  <p className="text-muted-foreground">{n.security} · {n.frequencyGhz} GHz</p>
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div
                      key={j}
                      className="h-3 w-1 rounded-sm"
                      style={{ backgroundColor: j < signalBars(n.signalDbm) ? "#34d399" : undefined, opacity: j < signalBars(n.signalDbm) ? 1 : 0.3 }}
                    />
                  ))}
                  <span className="ml-1 font-mono text-[10px] text-muted-foreground">{n.signalDbm} dBm</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {adapters.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground">
            Bam "Quet WiFi" de kiem tra adapter va cac mang xung quanh.
          </p>
        )}

        {adapters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button variant="outline" className="text-emerald-500" onClick={() => recordResult("pass")}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> WiFi OK
            </Button>
            <Button variant="outline" className="text-destructive" onClick={() => recordResult("fail")}>
              <XCircle className="mr-1 h-4 w-4" /> Co van de
            </Button>
            {result && (
              <Badge variant={result === "pass" ? "secondary" : "destructive"}>
                {result === "pass" ? "OK" : "Loi"}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
