"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Play,
  Square,
  Volume2,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";

/* ===================== TIỆN ÍCH CHUNG ===================== */

/**
 * Vì sao cần: getUserMedia chỉ tồn tại trong "secure context" (https, hoặc
 * localhost/127.0.0.1). Khi mở trang từ MÁY KHÁC qua IP LAN (vd http://192.168.1.5:3000)
 * thì `navigator.mediaDevices` là `undefined` → code cũ ném "Cannot read
 * properties of undefined", người dùng chỉ thấy lỗi tối nghĩa mà không hiểu vì sao.
 * Hàm này phát hiện sớm để hiện hướng dẫn cụ thể thay vì lỗi kỹ thuật.
 */
function getMediaSupport(): { ok: true } | { ok: false; reason: string } {
  if (typeof navigator === "undefined") return { ok: false, reason: "Đang tải…" };
  if (!navigator.mediaDevices?.getUserMedia) {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      return {
        ok: false,
        reason:
          `Trình duyệt chặn camera/mic vì trang đang mở qua kết nối không bảo mật (${window.location.protocol}//${window.location.hostname}). ` +
          "Camera và mic chỉ hoạt động trên HTTPS hoặc localhost. " +
          "Nếu bạn đang mở từ máy khác qua địa chỉ IP, hãy dùng HTTPS hoặc mở trực tiếp trên máy chạy web.",
      };
    }
    return { ok: false, reason: "Trình duyệt này không hỗ trợ truy cập camera/microphone." };
  }
  return { ok: true };
}

/** Đổi lỗi kỹ thuật của getUserMedia thành câu tiếng Việt dễ hiểu. */
function explainMediaError(e: unknown, kind: "camera" | "microphone"): string {
  const err = e as DOMException;
  const ten = kind === "camera" ? "camera" : "microphone";
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return `Bạn đã từ chối quyền truy cập ${ten}. Bấm vào biểu tượng khoá/camera trên thanh địa chỉ để cấp lại quyền, rồi thử lại.`;
    case "NotFoundError":
    case "OverconstrainedError":
      return `Không tìm thấy ${ten} nào trên máy này. Kiểm tra thiết bị đã được cắm/bật chưa.`;
    case "NotReadableError":
    case "TrackStartError":
      return `Không đọc được ${ten} — có thể ứng dụng khác (Zoom, Teams, Meet…) đang chiếm. Hãy đóng ứng dụng đó rồi thử lại.`;
    case "AbortError":
      return `Truy cập ${ten} bị ngắt giữa lúc đang mở. Thử lại lần nữa.`;
    default:
      return (e as Error)?.message ?? `Không thể truy cập ${ten}`;
  }
}

/* ===================== CAMERA ===================== */
function CameraTab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  // Bản sao trong ref để cleanup lúc unmount đọc được stream mới nhất
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const getDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const all = await navigator.mediaDevices.enumerateDevices();
    const cams = all.filter((d) => d.kind === "videoinput");
    setDevices(cams);
    if (cams.length > 0 && !selectedDevice) setSelectedDevice(cams[0].deviceId);
  }, [selectedDevice]);

  const startCamera = async () => {
    const support = getMediaSupport();
    if (!support.ok) {
      setError(support.reason);
      return;
    }
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: selectedDevice ? { exact: selectedDevice } : undefined },
      });
      setStream(s);
      streamRef.current = s;
      setActive(true);
      setError(null);
      await getDevices();
    } catch (e: unknown) {
      setError(explainMediaError(e, "camera"));
    }
  };

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setActive(false);
  };

  // Gán stream vào <video> bằng effect, KHÔNG gán ngay trong startCamera:
  // thẻ <video> chỉ được render khi `active === true`, nên lúc startCamera chạy
  // thì videoRef.current vẫn là null → preview đen dù camera đã bật.
  useEffect(() => {
    if (active && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [active, stream]);

  // Chỉ dọn khi unmount (deps []) — nếu để [stream] thì mỗi lần setStream()
  // React chạy cleanup của render trước và tắt luôn track vừa mở (rõ nhất khi
  // đổi camera trong danh sách).
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {devices.length > 1 && (
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        )}
        {!active ? (
          <Button onClick={startCamera} className="bg-zinc-900 text-white hover:bg-zinc-700">
            <Camera className="mr-2 h-4 w-4" /> Bật camera
          </Button>
        ) : (
          <Button variant="outline" onClick={stopCamera}>
            <CameraOff className="mr-2 h-4 w-4" /> Tắt camera
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          {error}
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 aspect-video flex items-center justify-center">
        {active ? (
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-500">
            <Camera className="h-12 w-12 opacity-30" />
            <span className="text-sm">Camera chưa được bật</span>
          </div>
        )}
        {active && (
          <Badge className="absolute left-3 top-3 bg-green-600 text-white">
            LIVE
          </Badge>
        )}
      </div>
    </div>
  );
}

/* ===================== MICROPHONE ===================== */
function MicTab() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  // Đỉnh âm lượng đã ghi nhận — bằng chứng "mic ĐÃ nhận được tiếng", vì mức
  // tức thời có thể vụt về 0 ngay khi ngừng nói, khiến người dùng tưởng mic hỏng.
  const [peak, setPeak] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Giữ stream trong ref để cleanup lúc unmount đọc được giá trị mới nhất mà
  // không phải đưa `stream` vào deps của effect (xem lý do ở effect cleanup).
  const streamRef = useRef<MediaStream | null>(null);

  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Vẽ theo kích thước thật của canvas trên màn hình (và nhân devicePixelRatio)
    // để sóng không bị kéo giãn/mờ trên màn Retina.
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 600;
    const cssH = canvas.clientHeight || 140;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const bins = analyser.frequencyBinCount;

    // ── 1. Dạng sóng thật (oscilloscope) — nhìn ra ngay là có tiếng hay không
    const timeData = new Uint8Array(bins);
    analyser.getByteTimeDomainData(timeData);

    // Đường 0 dB ở giữa
    ctx.strokeStyle = "#e4e4e7";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cssH / 2);
    ctx.lineTo(cssW, cssH / 2);
    ctx.stroke();

    // RMS = mức âm lượng chuẩn hơn so với trung bình phổ tần
    let sumSq = 0;
    for (let i = 0; i < bins; i++) {
      const v = (timeData[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / bins);
    const level = Math.min(100, rms * 250);
    setVolume(level);
    setPeak((p) => (level > p ? level : p));

    // Sóng càng to càng đậm màu → phản hồi thị giác rõ khi nói
    ctx.strokeStyle = level > 2 ? "#18181b" : "#a1a1aa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const slice = cssW / bins;
    for (let i = 0; i < bins; i++) {
      const y = (timeData[i] / 128) * (cssH / 2);
      const x = i * slice;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // ── 2. Cột tần số mờ phía sau cho sinh động
    const freqData = new Uint8Array(bins);
    analyser.getByteFrequencyData(freqData);
    ctx.fillStyle = "rgba(24,24,27,0.13)";
    const barW = cssW / bins;
    for (let i = 0; i < bins; i++) {
      const h = (freqData[i] / 255) * (cssH / 2);
      ctx.fillRect(i * barW, cssH - h, Math.max(1, barW - 1), h);
    }

    animRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  /** Mở mic và bắt đầu vẽ sóng — KHÔNG ghi âm. */
  const startListening = async () => {
    const support = getMediaSupport();
    if (!support.ok) {
      setError(support.reason);
      return;
    }
    try {
      // Tắt xử lý tín hiệu để sóng phản ánh đúng tiếng vào mic: autoGainControl
      // và noiseSuppression có thể triệt tiếng nhỏ thành phẳng lặng, gây cảm giác
      // "mic không nhận" dù thực tế vẫn thu được.
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      setStream(s);
      streamRef.current = s;
      setError(null);
      setPeak(0);

      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new Ctor();
      // Chrome mở AudioContext ở trạng thái "suspended" nếu chưa có tương tác;
      // không resume thì analyser trả toàn số 0 → sóng phẳng dù mic vẫn chạy.
      if (audioCtx.state === "suspended") await audioCtx.resume();
      const source = audioCtx.createMediaStreamSource(s);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;
      audioCtxRef.current = audioCtx;

      setListening(true);
      animRef.current = requestAnimationFrame(drawWaveform);
    } catch (e: unknown) {
      setError(explainMediaError(e, "microphone"));
    }
  };

  const stopListening = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (stream) stream.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    cancelAnimationFrame(animRef.current);
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    setStream(null);
    setRecording(false);
    setListening(false);
    setVolume(0);
  };

  /** Ghi âm để phát lại — chỉ dùng lại stream đang mở, sóng vẫn chạy liên tục. */
  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    setAudioUrl(null);
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setAudioUrl(URL.createObjectURL(blob));
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  // CHỈ dọn khi unmount — deps phải là [] .
  // Trước đây deps là [stream]: khi startListening gọi setStream(), React chạy
  // cleanup của lần render trước, mà cleanup đó cancelAnimationFrame() +
  // audioCtx.close() → huỷ đúng vòng lặp vẽ và AudioContext vừa mới tạo,
  // nên sóng âm phẳng lặng dù mic vẫn thu bình thường.
  // Dùng ref (không phải state) để cleanup luôn thấy stream mới nhất.
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      void audioCtxRef.current?.close();
    };
  }, []);

  // Thu hồi blob URL cũ để không rò rỉ bộ nhớ khi ghi âm nhiều lần
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {!listening ? (
          <Button onClick={startListening} className="bg-zinc-900 text-white hover:bg-zinc-700">
            <Mic className="mr-2 h-4 w-4" /> Bật microphone
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={stopListening}>
              <MicOff className="mr-2 h-4 w-4" /> Tắt microphone
            </Button>
            {!recording ? (
              <Button variant="outline" onClick={startRecording}>
                <Play className="mr-2 h-4 w-4" /> Ghi âm thử
              </Button>
            ) : (
              <Button variant="outline" onClick={stopRecording}>
                <Square className="mr-2 h-4 w-4" /> Dừng ghi
              </Button>
            )}
          </>
        )}
        {recording && <Badge className="animate-pulse bg-red-600 text-white">REC</Badge>}
      </div>

      {error && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          {error}
        </div>
      )}

      {listening && (
        <p className="text-sm text-zinc-500">
          Hãy thử nói vào microphone — nếu sóng âm nhảy lên thì mic đang nhận tiếng bình thường.
        </p>
      )}

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-700">Sóng âm</p>
          {listening && (
            <div className="flex items-center gap-2">
              {/* Ngưỡng 2% để bỏ qua nhiễu nền, tránh báo "đã nhận" khi im lặng */}
              <span className={`text-xs font-medium ${volume > 2 ? "text-emerald-600" : "text-zinc-400"}`}>
                {volume > 2 ? "Đang nhận âm thanh" : "Chưa nghe thấy gì"}
              </span>
              <span className="relative flex h-2 w-2">
                {volume > 2 && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${volume > 2 ? "bg-emerald-500" : "bg-zinc-300"}`}
                />
              </span>
            </div>
          )}
        </div>
        <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <canvas ref={canvasRef} className="block h-[140px] w-full" />
          {!listening && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85 text-zinc-400">
              <MicOff className="h-8 w-8 opacity-40" />
              <span className="text-sm">Microphone chưa được bật</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs text-zinc-500">Âm lượng</span>
          <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
            <div
              className={`h-full rounded-full transition-[width] duration-75 ${volume > 2 ? "bg-emerald-500" : "bg-zinc-400"}`}
              style={{ width: `${Math.min(100, volume)}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-500">
            {Math.round(volume)}%
          </span>
        </div>

        {listening && (
          <div className="mt-2 flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-zinc-500">Đỉnh</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-zinc-900"
                style={{ width: `${Math.min(100, peak)}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-500">
              {Math.round(peak)}%
            </span>
          </div>
        )}

        {listening && peak > 2 && (
          <p className="mt-2.5 text-xs font-medium text-emerald-600">
            ✓ Microphone hoạt động — đã ghi nhận âm thanh (đỉnh {Math.round(peak)}%)
          </p>
        )}
      </div>

      {audioUrl && (
        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            <span className="text-sm font-medium">Phát lại</span>
          </div>
          <audio src={audioUrl} controls className="w-full" />
        </div>
      )}
    </div>
  );
}

/* ===================== PAGE ===================== */
export default function CameraMicPage() {
  const router = useRouter();
  // Kiểm tra sau khi mount (không phải lúc SSR) vì cần đọc window/navigator
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    const support = getMediaSupport();
    setBlocked(support.ok ? null : support.reason);
  }, []);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push("/test-laptop")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Quay lại
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Test Camera & Microphone</CardTitle>
          <CardDescription>
            Kiểm tra webcam (live preview) và microphone (ghi âm + phát lại)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {blocked && (
            <div className="mb-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm text-amber-900">
                <p className="mb-1 font-semibold">Không dùng được camera/microphone ở máy này</p>
                <p className="text-amber-800">{blocked}</p>
              </div>
            </div>
          )}
          <Tabs defaultValue="camera">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="camera">
                <Camera className="mr-2 h-4 w-4" /> Camera
              </TabsTrigger>
              <TabsTrigger value="mic">
                <Mic className="mr-2 h-4 w-4" /> Microphone
              </TabsTrigger>
            </TabsList>
            <TabsContent value="camera" className="mt-4">
              <CameraTab />
            </TabsContent>
            <TabsContent value="mic" className="mt-4">
              <MicTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
