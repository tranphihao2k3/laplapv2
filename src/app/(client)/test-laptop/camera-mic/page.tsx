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
  RefreshCw,
  ArrowLeft,
} from "lucide-react";

/* ===================== CAMERA ===================== */
function CameraTab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const getDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    const cams = all.filter((d) => d.kind === "videoinput");
    setDevices(cams);
    if (cams.length > 0 && !selectedDevice) setSelectedDevice(cams[0].deviceId);
  }, [selectedDevice]);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: selectedDevice ? { exact: selectedDevice } : undefined },
      });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      setActive(true);
      setError(null);
      await getDevices();
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "Không thể truy cập camera");
    }
  };

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    setStream(null);
    setActive(false);
  };

  useEffect(() => {
    return () => { if (stream) stream.getTracks().forEach((t) => t.stop()); };
  }, [stream]);

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
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawWaveform = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw visual soundwave lines
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    analyser.getByteFrequencyData(dataArray);

    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i] / 2;

      // Gradient color for soundwave
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
      gradient.addColorStop(0, "#27272a");
      gradient.addColorStop(0.5, "#a1a1aa");
      gradient.addColorStop(1, "#18181b");

      ctx.fillStyle = gradient;
      
      // Center the sound bars vertically
      const y = (canvas.height - barHeight) / 2;
      ctx.fillRect(x, y, barWidth - 1, barHeight);

      x += barWidth;
    }

    // Volume level calculation
    const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
    setVolume(Math.min(100, (avg / 128) * 100));

    animRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  const startRecording = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(s);
      setError(null);

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(s);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      chunksRef.current = [];
      const recorder = new MediaRecorder(s);
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      animRef.current = requestAnimationFrame(drawWaveform);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "Không thể truy cập microphone");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current) recorderRef.current.stop();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(animRef.current);
    setRecording(false);
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {!recording ? (
          <Button onClick={startRecording} className="bg-zinc-900 text-white hover:bg-zinc-700">
            <Mic className="mr-2 h-4 w-4" /> Ghi âm (10 giây)
          </Button>
        ) : (
          <Button variant="outline" onClick={stopRecording}>
            <Square className="mr-2 h-4 w-4" /> Dừng
          </Button>
        )}
        {recording && (
          <Badge className="animate-pulse bg-red-600 text-white">REC</Badge>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-700">Waveform</p>
          {recording && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </div>
        <div className="relative overflow-hidden rounded-lg bg-zinc-950/5 p-2">
          <canvas ref={canvasRef} width={600} height={120} className="w-full rounded-lg" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-zinc-500">Volume:</span>
          <div className="h-2 flex-1 rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-zinc-900 transition-all"
              style={{ width: `${volume}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500">{Math.round(volume)}%</span>
        </div>
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
