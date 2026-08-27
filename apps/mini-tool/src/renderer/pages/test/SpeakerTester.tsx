import * as React from "react";
import { Play, Pause, Loader2, CheckCircle2, XCircle, Volume2, VolumeX, Speaker } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store";

interface Song {
  id: string;
  title: string;
  artist: string | null;
  file_url: string;
  duration_seconds: number | null;
}

const FALLBACK_SONGS: Song[] = [
  {
    id: "tone-440",
    title: "Test Tone 440Hz",
    artist: "LapLap Tool",
    file_url: "generate:440",
    duration_seconds: 3,
  },
  {
    id: "tone-880",
    title: "Test Tone 880Hz",
    artist: "LapLap Tool",
    file_url: "generate:880",
    duration_seconds: 3,
  },
  {
    id: "chirp",
    title: "Chirp Test (20Hz-20kHz)",
    artist: "LapLap Tool",
    file_url: "generate:chirp",
    duration_seconds: 5,
  },
];

function generateTestTone(frequency: number, durationSec = 3, sampleRate = 44100): string {
  const numSamples = sampleRate * durationSec;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t * 10) * Math.min(1, (durationSec - t) * 10);
    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.8;
    view.setInt16(offset, Math.round(sample * 32767), true);
    offset += 2;
  }

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

function generateChirp(durationSec = 5, sampleRate = 44100): string {
  const numSamples = sampleRate * durationSec;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const ratio = t / durationSec;
    const freq = 20 + (20000 - 20) * ratio;
    const envelope = Math.min(1, t * 5) * Math.min(1, (durationSec - t) * 5);
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.6;
    view.setInt16(offset, Math.round(sample * 32767), true);
    offset += 2;
  }

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

export function SpeakerTester() {
  const { upsertTest } = useSessionStore();
  const [songs, setSongs] = React.useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [results, setResults] = React.useState<Record<string, "pass" | "fail">>({});

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    async function load() {
      try {
        setLoadingSongs(true);
        const res = await fetch(
          "https://laplapcantho.store/api/v1/speaker-songs?active_only=true&pageSize=10",
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data?: { items?: Song[] } };
        const items = json.data?.items ?? [];
        if (items.length > 0) {
          setSongs(items);
        } else {
          setSongs(FALLBACK_SONGS);
        }
      } catch {
        setError("Không tải được danh sách bài test. Dùng bài mặc định.");
        setSongs(FALLBACK_SONGS);
      } finally {
        setLoadingSongs(false);
      }
    }
    void load();
  }, []);

  React.useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const getAudioSrc = (song: Song): string => {
    if (song.file_url.startsWith("generate:")) {
      const type = song.file_url.replace("generate:", "");
      if (type === "440") return generateTestTone(440, 3);
      if (type === "880") return generateTestTone(880, 3);
      if (type === "chirp") return generateChirp(5);
      return generateTestTone(440, 3);
    }
    return song.file_url;
  };

  const handleTogglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !songs[currentIdx]) return;
    try {
      if (playing) {
        audio.pause();
        setPlaying(false);
      } else {
        // Revoke previous blob URL before creating new one
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        const src = getAudioSrc(songs[currentIdx]);
        if (src.startsWith("blob:")) {
          blobUrlRef.current = src;
        }
        audio.src = src;
        audio.load();
        await audio.play();
        setPlaying(true);
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleSelect = (idx: number) => {
    setCurrentIdx(idx);
    setPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const recordResult = (song: Song, result: "pass" | "fail") => {
    setResults((r) => ({ ...r, [song.id]: result }));
    upsertTest({
      type: "speaker",
      result,
      payload: { songId: song.id, title: song.title },
      capturedAt: new Date().toISOString(),
    });
    toast[result === "pass" ? "success" : "error"](
      result === "pass" ? "Đã ghi nhận: Nghe rõ" : "Đã ghi nhận: Có vấn đề",
    );
  };

  const passCount = Object.values(results).filter((v) => v === "pass").length;
  const failCount = Object.values(results).filter((v) => v === "fail").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {playing ? <Volume2 className="h-5 w-5 animate-pulse" /> : <VolumeX className="h-5 w-5" />}
          Test loa
        </CardTitle>
        <CardDescription>
          Phát từng bài và đánh dấu nghe rõ / có vấn đề. Dùng bài mặc định nếu API không tải được.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingSongs ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : null}

        {error ? <p className="text-xs text-amber-500">{error}</p> : null}

        {!loadingSongs ? (
          <div className="space-y-2">
            {songs.map((song, i) => (
              <div
                key={song.id}
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/40 p-3",
                  currentIdx === i && "ring-1 ring-primary/60",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{song.title}</p>
                  {song.artist ? (
                    <p className="truncate text-xs text-muted-foreground">{song.artist}</p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant={currentIdx === i && playing ? "default" : "outline"}
                  onClick={() => handleSelect(i)}
                >
                  {currentIdx === i && playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {currentIdx === i && playing ? "Đang phát" : "Chọn"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-emerald-500"
                  onClick={() => recordResult(song, "pass")}
                >
                  <CheckCircle2 className="h-4 w-4" /> Nghe rõ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => recordResult(song, "fail")}
                >
                  <XCircle className="h-4 w-4" /> Có vấn đề
                </Button>
                {results[song.id] ? (
                  <Badge variant={results[song.id] === "pass" ? "secondary" : "destructive"}>
                    {results[song.id] === "pass" ? "OK" : "Lỗi"}
                  </Badge>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {songs[currentIdx] ? (
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <Button onClick={handleTogglePlay} disabled={!songs[currentIdx]}>
              {playing ? <Pause className="h-4 w-4" /> : <Speaker className="h-4 w-4" />}
              {playing ? "Tạm dừng" : "Phát"}
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {songs[currentIdx].title}{" "}
                <span className="text-xs text-muted-foreground">
                  ({currentIdx + 1}/{songs.length})
                </span>
              </p>
            </div>
            <audio
              ref={audioRef}
              preload="metadata"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
          </div>
        ) : null}

        {passCount > 0 || failCount > 0 ? (
          <div className="flex items-center gap-3 text-xs">
            <Badge variant="secondary">{passCount} OK</Badge>
            <Badge variant="destructive">{failCount} lỗi</Badge>
          </div>
        ) : null}

        {loadingSongs ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải danh sách bài test...
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}