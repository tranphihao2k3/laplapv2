import * as React from "react";
import { Mic, Square, Play, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSessionStore } from "@/store";

type PermissionState = "idle" | "pending" | "granted" | "denied" | "unsupported";

export function MicTester() {
  const { upsertTest } = useSessionStore();
  const [perm, setPerm] = React.useState<PermissionState>("idle");
  const [level, setLevel] = React.useState(0);
  const [recording, setRecording] = React.useState(false);
  const [playbackUrl, setPlaybackUrl] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<"pass" | "fail" | null>(null);

  const streamRef = React.useRef<MediaStream | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animRef = React.useRef<number | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);

  const stopMeter = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    setLevel(0);
  };

  const teardownStream = () => {
    stopMeter();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  };

  React.useEffect(() => () => teardownStream(), []);

  const requestMic = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPerm("unsupported");
      toast.error("Trình duyệt / Electron không hỗ trợ getUserMedia");
      return;
    }
    setPerm("pending");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyserRef.current = analyser;
      setPerm("granted");
      startMeter();
    } catch (err) {
      setPerm("denied");
      toast.error(`Quyền micro bị từ chối: ${(err as Error).message}`);
    }
  };

  const startMeter = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      setLevel(Math.min(1, rms * 2));
      animRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      setPlaybackUrl(url);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
      setRecording(false);
    }, 5000);
  };

  const stopRecording = () => {
    const r = recorderRef.current;
    if (r && r.state !== "inactive") {
      r.stop();
    }
    setRecording(false);
  };

  const finishTest = (verdict: "pass" | "fail") => {
    setResult(verdict);
    upsertTest({
      type: "mic",
      result: verdict,
      payload: { peakLevel: level, durationSec: 5 },
      capturedAt: new Date().toISOString(),
    });
    toast[verdict === "pass" ? "success" : "error"](
      verdict === "pass" ? "Mic OK" : "Mic có vấn đề",
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" /> Test micro
        </CardTitle>
        <CardDescription>
          Cấp quyền micro, nói thử và ghi âm 5 giây. Mic tốt khi thanh level nhảy khi có tiếng.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={requestMic} disabled={perm === "granted" || perm === "pending"}>
            <Mic className="h-4 w-4" /> Cấp quyền micro
          </Button>
          {perm === "granted" ? <Badge variant="secondary">Đã cấp quyền</Badge> : null}
          {perm === "denied" ? <Badge variant="destructive">Bị từ chối</Badge> : null}
          {perm === "unsupported" ? <Badge variant="outline">Không hỗ trợ</Badge> : null}
        </div>

        {perm === "denied" ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
            <p className="text-amber-200">
              Micro bị từ chối hoặc chưa được cấp quyền trong Electron. Mở DevTools và kiểm tra
              <span className="ml-1 font-mono">navigator.mediaDevices</span> hoặc bật chế độ cấp quyền media.
            </p>
          </div>
        ) : null}

        {perm === "granted" ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Mức âm thanh (RMS)</span>
                <span>{Math.round(level * 100)}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-500 transition-[width] duration-75"
                  style={{ width: `${level * 100}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={recording ? stopRecording : startRecording}
                variant={recording ? "destructive" : "outline"}
              >
                {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {recording ? "Dừng ghi" : "Ghi 5s"}
              </Button>
              {playbackUrl ? (
                <audio src={playbackUrl} controls className="h-8" />
              ) : null}
              <Button variant="outline" className="text-emerald-500" onClick={() => finishTest("pass")}>
                <CheckCircle2 className="h-4 w-4" /> Mic OK
              </Button>
              <Button variant="outline" className="text-destructive" onClick={() => finishTest("fail")}>
                <XCircle className="h-4 w-4" /> Có vấn đề
              </Button>
              {result ? <Badge variant={result === "pass" ? "secondary" : "destructive"}>{result === "pass" ? "Đạt" : "Lỗi"}</Badge> : null}
            </div>
          </>
        ) : null}

        {playbackUrl ? (
          <p className="text-xs text-muted-foreground">
            <Play className="mr-1 inline h-3 w-3" /> Nghe lại đoạn ghi để xác nhận mic.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}