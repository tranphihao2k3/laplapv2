import * as React from "react";
import { Camera, AlertTriangle, CheckCircle2, XCircle, Download } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSessionStore } from "@/store";

type PermissionState = "idle" | "pending" | "granted" | "denied" | "unsupported";

export function CameraTester() {
  const { upsertTest } = useSessionStore();
  const [perm, setPerm] = React.useState<PermissionState>("idle");
  const [captured, setCaptured] = React.useState<string | null>(null);
  const [resolution, setResolution] = React.useState<{ w: number; h: number } | null>(null);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const requestCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPerm("unsupported");
      toast.error("Không hỗ trợ getUserMedia");
      return;
    }
    setPerm("pending");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings();
      if (settings?.width && settings.height) {
        setResolution({ w: settings.width, h: settings.height });
      }
      setPerm("granted");
    } catch (err) {
      setPerm("denied");
      toast.error(`Quyền camera bị từ chối: ${(err as Error).message}`);
    }
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    setCaptured(dataUrl);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `camera-${Date.now()}.png`;
    a.click();
    toast.success("Đã chụp và tải ảnh xuống");
  };

  const finishTest = (verdict: "pass" | "fail") => {
    upsertTest({
      type: "camera",
      result: verdict,
      payload: {
        resolution: resolution ? `${resolution.w}x${resolution.h}` : null,
        captured: !!captured,
      },
      capturedAt: new Date().toISOString(),
    });
    toast[verdict === "pass" ? "success" : "error"](
      verdict === "pass" ? "Camera OK" : "Camera có vấn đề",
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" /> Test camera
        </CardTitle>
        <CardDescription>
          Cấp quyền camera, xem preview, chụp 1 ảnh để xác nhận camera hoạt động.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={requestCamera} disabled={perm === "granted" || perm === "pending"}>
            <Camera className="h-4 w-4" /> Cấp quyền camera
          </Button>
          {perm === "granted" ? <Badge variant="secondary">Đã cấp quyền</Badge> : null}
          {perm === "denied" ? <Badge variant="destructive">Bị từ chối</Badge> : null}
          {perm === "unsupported" ? <Badge variant="outline">Không hỗ trợ</Badge> : null}
          {resolution ? (
            <span className="text-xs text-muted-foreground">
              {resolution.w}×{resolution.h}
            </span>
          ) : null}
        </div>

        {perm === "denied" ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
            <p className="text-amber-200">
              Camera bị từ chối hoặc chưa được cấp quyền. Bật chế độ cấp quyền media cho Electron hoặc kiểm tra thiết bị.
            </p>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-border/60 bg-black">
          <video
            ref={videoRef}
            className="aspect-video w-full bg-black"
            autoPlay
            muted
            playsInline
          />
        </div>

        {perm === "granted" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleCapture}>
              <Camera className="h-4 w-4" /> Chụp ảnh
            </Button>
            {captured ? (
              <a
                href={captured}
                download={`camera-${Date.now()}.png`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" /> Tải ảnh
              </a>
            ) : null}
            <Button variant="outline" className="text-emerald-500" onClick={() => finishTest("pass")}>
              <CheckCircle2 className="h-4 w-4" /> Camera OK
            </Button>
            <Button variant="outline" className="text-destructive" onClick={() => finishTest("fail")}>
              <XCircle className="h-4 w-4" /> Có vấn đề
            </Button>
          </div>
        ) : null}

        {captured ? (
          <div className="rounded-lg border border-border/60 p-2">
            <p className="mb-2 text-xs text-muted-foreground">Ảnh đã chụp:</p>
            <img src={captured} alt="Camera capture" className="max-h-48 rounded border" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}