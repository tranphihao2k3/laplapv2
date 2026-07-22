"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { Volume2, VolumeX, ArrowLeft, ArrowRight, Play, Square } from "lucide-react";

export default function SpeakersPage() {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeChannel, setActiveChannel] = useState<"left" | "right" | "both" | null>(null);
  const [volume, setVolume] = useState(0.8);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const pannerRef = useRef<StereoPannerNode | null>(null);

  const startTestTone = (channel: "left" | "right" | "both") => {
    stopTestTone();

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = audioCtx;

    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, audioCtx.currentTime); // Standard A4 tone
    oscRef.current = osc;

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNodeRef.current = gainNode;

    let destination: AudioNode = gainNode;

    if (channel !== "both" && "createStereoPanner" in audioCtx) {
      const panner = audioCtx.createStereoPanner();
      panner.pan.setValueAtTime(channel === "left" ? -1 : 1, audioCtx.currentTime);
      pannerRef.current = panner;
      gainNode.connect(panner);
      destination = panner;
    }

    destination.connect(audioCtx.destination);
    osc.connect(gainNode);

    osc.start();
    setIsPlaying(true);
    setActiveChannel(channel);
  };

  const stopTestTone = () => {
    if (oscRef.current) {
      try {
        oscRef.current.stop();
      } catch (e) {}
      oscRef.current.disconnect();
      oscRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    if (pannerRef.current) {
      pannerRef.current.disconnect();
      pannerRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
    setActiveChannel(null);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(val, audioCtxRef.current.currentTime);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
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
          <CardTitle>Test Loa</CardTitle>
          <CardDescription>
            Kiểm tra đầu ra âm thanh của kênh trái, kênh phải và loa kép.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 py-12">
            <Volume2 className={`h-16 w-16 mb-4 text-zinc-900 ${isPlaying ? "animate-bounce" : "opacity-30"}`} />
            {isPlaying ? (
              <span className="text-sm font-semibold">
                Đang phát âm thanh ở: {activeChannel === "left" ? "Loa TRÁI" : activeChannel === "right" ? "Loa PHẢI" : "CẢ HAI Loa"}
              </span>
            ) : (
              <span className="text-sm text-zinc-500">Nhấn chọn loa cần kiểm tra bên dưới</span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              variant={activeChannel === "left" ? "default" : "outline"}
              className={`h-14 ${activeChannel === "left" ? "bg-zinc-900 text-white" : "border-zinc-200"}`}
              onClick={() => startTestTone("left")}
            >
              <ArrowLeft className="mr-2 h-5 w-5" /> Loa Trái (Left)
            </Button>
            <Button
              variant={activeChannel === "right" ? "default" : "outline"}
              className={`h-14 ${activeChannel === "right" ? "bg-zinc-900 text-white" : "border-zinc-200"}`}
              onClick={() => startTestTone("right")}
            >
              Loa Phải (Right) <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant={activeChannel === "both" ? "default" : "outline"}
              className={`h-14 ${activeChannel === "both" ? "bg-zinc-900 text-white" : "border-zinc-200"}`}
              onClick={() => startTestTone("both")}
            >
              <Volume2 className="mr-2 h-5 w-5" /> Cả hai
            </Button>
          </div>

          {isPlaying && (
            <div className="flex justify-center">
              <Button variant="destructive" className="px-6" onClick={stopTestTone}>
                <Square className="mr-2 h-4 w-4" /> Dừng phát
              </Button>
            </div>
          )}

          <div className="space-y-2 border-t border-zinc-100 pt-4">
            <div className="flex items-center justify-between text-sm">
              <Label className="flex items-center gap-1.5">
                <Volume2 className="h-4 w-4" /> Âm lượng
              </Label>
              <span className="font-medium">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-zinc-900 dark:bg-zinc-700"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
