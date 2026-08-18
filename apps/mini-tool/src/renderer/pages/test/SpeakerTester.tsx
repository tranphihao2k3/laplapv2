import * as React from "react";
import { Play, Pause, Loader2, CheckCircle2, XCircle, Volume2, VolumeX } from "lucide-react";
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
    id: "fallback-1",
    title: "Test Tone 440Hz (mặc định)",
    artist: null,
    file_url:
      "data:audio/wav;base64,UklGRiQFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YVgFAAB+f8CBAYH/gQGBgP+BgYGAP4GBgYA/gYGBgD+BgYGAP4GBgYB",
    duration_seconds: 1,
  },
];

export function SpeakerTester() {
  const { upsertTest } = useSessionStore();
  const [songs, setSongs] = React.useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [results, setResults] = React.useState<Record<string, "pass" | "fail">>({});

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

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
        setSongs(items.length > 0 ? items : FALLBACK_SONGS);
      } catch (err) {
        setError("Không tải được danh sách bài test. Sử dụng bài mặc định.");
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

  const handleTogglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (playing) {
        audio.pause();
        setPlaying(false);
      } else {
        await audio.play();
        setPlaying(true);
      }
    } catch (err) {
      toast.error((err as Error).message);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {playing ? <Volume2 className="h-5 w-5 animate-pulse" /> : <VolumeX className="h-5 w-5" />}
          Test loa
        </CardTitle>
        <CardDescription>
          Phát từng bài và đánh dấu nghe rõ / có vấn đề. Kết quả sẽ được lưu vào bản upload.
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
                  onClick={() => {
                    setCurrentIdx(i);
                    setPlaying(false);
                  }}
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
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
              src={songs[currentIdx].file_url}
              preload="metadata"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              controls
              className="h-8 max-w-[240px]"
            />
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