"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  Volume2,
  VolumeX,
  ArrowLeft,
  ArrowRight,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Music2,
  Loader2,
} from "lucide-react";
import { useAudioPlayer } from "@/components/test-laptop/audio-player-provider";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SpeakersPage() {
  const router = useRouter();
  const {
    songs,
    loadingSongs,
    songsError,
    currentIdx,
    currentSong,
    isPlaying,
    channel,
    volume,
    currentTime,
    duration,
    togglePlay,
    stop,
    next,
    prev,
    seek,
    setChannel,
    setVolume,
    setIdx,
  } = useAudioPlayer();

  // Đảm bảo khi user rời tab / refresh, audio dừng lại (audio context cũng đóng)
  useEffect(() => {
    return () => {
      // cleanup is handled by provider (audio.src = "" in effect cleanup)
    };
  }, []);

  const hasSongs = songs.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Button variant="ghost" className="mb-4" onClick={() => router.push("/test-laptop")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Quay lại
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Test Loa</CardTitle>
          <CardDescription>
            Phát nhạc thực tế để kiểm tra loa trái, phải và âm thanh stereo. Khi bật nhạc,
            bạn có thể chuyển sang tab khác — nhạc vẫn chạy ở thanh phát dưới cùng màn hình.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ── Album art / status area ── */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 py-10 gap-3">
            {loadingSongs ? (
              <Loader2 className="h-10 w-10 animate-spin text-zinc-400" />
            ) : songsError ? (
              <>
                <VolumeX className="h-12 w-12 text-zinc-300" />
                <p className="text-sm text-red-500">{songsError}</p>
              </>
            ) : !hasSongs ? (
              <>
                <Music2 className="h-12 w-12 text-zinc-300" />
                <p className="text-sm text-zinc-500">
                  Chưa có bài nhạc nào. Admin hãy thêm bài nhạc trong phần quản lý.
                </p>
              </>
            ) : (
              <>
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-900 shadow-lg transition-transform ${
                    isPlaying ? "scale-105" : ""
                  }`}
                >
                  <Music2
                    className={`h-10 w-10 text-white ${isPlaying ? "animate-pulse" : ""}`}
                  />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold leading-tight">{currentSong?.title}</p>
                  {currentSong?.artist && (
                    <p className="text-sm text-zinc-500 mt-0.5">{currentSong.artist}</p>
                  )}
                  <p className="text-xs text-zinc-400 mt-1">
                    {currentIdx + 1} / {songs.length}
                  </p>
                </div>

                {/* ── Seek bar ── */}
                <div className="w-full max-w-xs space-y-1 px-2">
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={currentTime}
                    onChange={(e) => seek(parseFloat(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-zinc-900"
                  />
                  <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration || currentSong?.duration_seconds)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Playback controls ── */}
          {hasSongs && !loadingSongs && !songsError && (
            <div className="flex items-center justify-center gap-3">
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10"
                onClick={prev}
                disabled={songs.length < 2}
              >
                <SkipBack className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="default"
                className="h-12 w-12 rounded-full bg-zinc-900 hover:bg-zinc-700"
                onClick={togglePlay}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10"
                onClick={stop}
                disabled={!isPlaying && currentTime === 0}
              >
                <Square className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10"
                onClick={next}
                disabled={songs.length < 2}
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </div>
          )}

          {/* ── Song list ── */}
          {hasSongs && !loadingSongs && songs.length > 1 && (
            <div className="space-y-1 rounded-xl border border-zinc-200 overflow-hidden">
              {songs.map((song, i) => (
                <button
                  key={song.id}
                  onClick={() => {
                    if (i === currentIdx) {
                      void togglePlay();
                    } else {
                      void stop();
                      setIdx(i);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-zinc-50 ${
                    i === currentIdx ? "bg-zinc-100 font-medium" : ""
                  } ${i > 0 ? "border-t border-zinc-100" : ""}`}
                >
                  <span className="w-5 shrink-0 text-center text-xs text-zinc-400 font-mono">
                    {i === currentIdx && isPlaying ? (
                      <Volume2 className="h-3.5 w-3.5 text-zinc-900 animate-pulse" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{song.title}</p>
                    {song.artist && (
                      <p className="truncate text-xs text-zinc-400">{song.artist}</p>
                    )}
                  </div>
                  {song.duration_seconds && (
                    <span className="shrink-0 text-xs text-zinc-400 font-mono">
                      {formatTime(song.duration_seconds)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── Channel selector ── */}
          {hasSongs && !loadingSongs && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700">Kênh âm thanh</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["left", "both", "right"] as const).map((ch) => (
                  <Button
                    key={ch}
                    variant={channel === ch ? "default" : "outline"}
                    className={`h-11 gap-2 ${channel === ch ? "bg-zinc-900 text-white" : "border-zinc-200"}`}
                    onClick={() => setChannel(ch)}
                  >
                    {ch === "left" && (
                      <>
                        <ArrowLeft className="h-4 w-4" /> Loa Trái
                      </>
                    )}
                    {ch === "both" && (
                      <>
                        <Volume2 className="h-4 w-4" /> Cả hai
                      </>
                    )}
                    {ch === "right" && (
                      <>
                        Loa Phải <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* ── Volume ── */}
          <div className="space-y-2 border-t border-zinc-100 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium text-zinc-700">
                <Volume2 className="h-4 w-4" /> Âm lượng
              </span>
              <span className="font-medium tabular-nums">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-zinc-900"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
