import * as React from "react";
import { ClipboardPaste, Link2, ShieldCheck, Timer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useSessionStore } from "@/store";

const SID_PATTERN = /sid=([a-f0-9]{16,})/i;

function extractSid(text: string): { sid: string; source: "url" | "raw" } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const m = trimmed.match(SID_PATTERN);
  if (m && m[1]) return { sid: m[1].toLowerCase(), source: "url" };
  if (/^[a-f0-9]{16,}$/i.test(trimmed)) {
    return { sid: trimmed.toLowerCase(), source: "raw" };
  }
  return null;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Đã hết hạn";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ConnectTab() {
  const { session, setSession } = useSessionStore();
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const [detected, setDetected] = React.useState<string | null>(null);

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    const m = extractSid(input);
    setDetected(m?.sid ?? null);
  }, [input]);

  const handlePasteFromClipboard = async () => {
    try {
      const result = await window.lap.clipboard.read();
      if (result.ok && result.data) {
        setInput(result.data);
        toast.info("Đã dán nội dung từ clipboard");
      } else {
        toast.error("Không đọc được clipboard");
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleConnect = async () => {
    const parsed = extractSid(input);
    if (!parsed) {
      toast.error("Không nhận diện được session id hợp lệ");
      return;
    }
    setBusy(true);
    try {
      const result = await window.lap.session.import({ sid: parsed.sid });
      if (!result.ok || !result.data) {
        toast.error(result.error ?? "Không import được session");
        return;
      }
      setSession(result.data);
      toast.success("Đã kết nối session");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    await window.lap.session.clear();
    setSession(null);
    setInput("");
    toast.success("Đã xóa session");
  };

  const expiresAt = session?.expiresAt ? new Date(session.expiresAt).getTime() : null;
  const remaining = expiresAt ? expiresAt - now : null;
  const expired = expiresAt !== null && remaining !== null && remaining <= 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Kết nối với web
          </CardTitle>
          <CardDescription>
            Dán URL hoặc session id từ trang{" "}
            <span className="font-mono">/test-laptop</span> để liên kết mini tool với tài khoản.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-input">URL hoặc Session ID</Label>
            <div className="flex gap-2">
              <Input
                id="session-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://laplapcantho.store/test-laptop/system-scan?sid=..."
                className="font-mono text-xs"
                spellCheck={false}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handlePasteFromClipboard}
                aria-label="Dán từ clipboard"
              >
                <ClipboardPaste className="h-4 w-4" />
              </Button>
            </div>
            {detected ? (
              <p className="flex items-center gap-1.5 text-xs text-emerald-500">
                <ShieldCheck className="h-3.5 w-3.5" /> Phát hiện sid:{" "}
                <span className="font-mono">{detected}</span>
              </p>
            ) : input.trim() ? (
              <p className="text-xs text-amber-500">
                Không nhận diện được sid hợp lệ. Cần URL chứa <span className="font-mono">?sid=</span> hoặc chuỗi hex 16+ ký tự.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ví dụ: <span className="font-mono">9f3a1b2c4d5e6f70a1b2c3d4e5f60718</span>
              </p>
            )}
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleConnect} disabled={!detected || busy}>
              {busy ? "Đang kết nối..." : "Kết nối"}
            </Button>
            {session ? (
              <Button variant="outline" onClick={handleClear}>
                Xóa session
              </Button>
            ) : null}
            {session ? (
              <Badge variant={expired ? "destructive" : "secondary"}>
                <Timer className="mr-1 h-3 w-3" />
                {expired
                  ? "Đã hết hạn"
                  : `Còn ${formatCountdown(remaining ?? 0)}`}
              </Badge>
            ) : null}
          </div>

          {session ? (
            <div className="rounded-lg border border-border/60 bg-card/40 p-3 text-xs">
              <p className="font-medium text-foreground">Session hiện tại</p>
              <p className="mt-1 text-muted-foreground">SID: <span className="font-mono">{session.sid}</span></p>
              {session.uploadUrl ? (
                <p className="mt-1 text-muted-foreground break-all">Upload URL: <span className="font-mono">{session.uploadUrl}</span></p>
              ) : null}
              <p className="mt-1 text-muted-foreground">Hết hạn: {new Date(session.expiresAt).toLocaleString("vi-VN")}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hướng dẫn nhanh</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Mở web <span className="font-mono">/test-laptop/system-scan</span>, đăng nhập nếu cần.</li>
            <li>Bấm nút "Mở mini tool" để lấy URL có <span className="font-mono">sid</span>.</li>
            <li>Quay lại tool này, bấm biểu tượng bảng nhớp ở trên để dán nội dung vừa copy.</li>
            <li>Bấm "Kết nối" — tool sẽ giữ session trong 2 giờ (mặc định).</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}