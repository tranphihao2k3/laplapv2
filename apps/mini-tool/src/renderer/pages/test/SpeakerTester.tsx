import * as React from "react";
import {
  Play,
  Pause,
  Loader2,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
  Speaker,
  FolderOpen,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store";
import type { AudioFileInfo } from "@/types/window";

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function SpeakerTester() {
  const { upsertTest } = useSessionStore();
  const [songs, setSongs] = React.useState<AudioFileInfo[]>([]);
  const [audioDir, setAudioDir] = React.useState<string>("");
  const [loadingSongs, setLoadingSongs] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [results, setResults] = React.useState<Record<string, "pass" | "fail">>({});
  const [busy, setBusy] = React.useState<"add" | "refresh" | null>(null);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Cache blob URLs theo fileName để tránh request IPC nhiều lần
  // và đảm bảo phát ổn định qua các lần chuyển tab / chọn lại.
  const blobUrlCache = React.useRef<Map<string, string>>(new Map());
  // Map từ current blob URL đang dùng → để revoke khi unmount
  const loadedUrlsRef = React.useRef<Set<string>>(new Set());

  const loadList = React.useCallback(async () => {
    try {
      setLoadingSongs(true);
      const res = await window.lap.audio.list();
      if (!res.ok || !res.data) {
        throw new Error(res.error ?? "Không tải được danh sách audio");
      }
      setSongs(res.data.items);
      setAudioDir(res.data.dir);
      setError(null);
      if (res.data.items.length === 0) {
        setError("Thư mục audio trống. Bấm 'Thêm file nhạc' để thêm MP3/WAV.");
      }
    } catch (err) {
      setError((err as Error).message);
      setSongs([]);
    } finally {
      setLoadingSongs(false);
    }
  }, []);

  React.useEffect(() => {
    void loadList();
  }, [loadList]);

  // Reset index if list shrank
  React.useEffect(() => {
    if (currentIdx >= songs.length && songs.length > 0) {
      setCurrentIdx(0);
    }
  }, [songs.length, currentIdx]);

  /**
   * Lấy blob URL cho 1 file audio. Cache lại để lần sau dùng ngay.
   * Nếu cache lỗi (file bị xóa), tự xóa cache và retry.
   */
  const getBlobUrl = React.useCallback(async (song: AudioFileInfo): Promise<string> => {
    const cached = blobUrlCache.current.get(song.fileName);
    if (cached) return cached;
    const res = await window.lap.audio.read(song.fileName);
    if (!res.ok || !res.data) {
      throw new Error(res.error ?? "Không đọc được file audio");
    }
    const blob = new Blob([res.data.buffer], { type: res.data.mime });
    const url = URL.createObjectURL(blob);
    blobUrlCache.current.set(song.fileName, url);
    loadedUrlsRef.current.add(url);
    return url;
  }, []);

  // Cleanup tất cả blob URLs khi unmount
  React.useEffect(() => {
    return () => {
      for (const url of loadedUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      loadedUrlsRef.current.clear();
      blobUrlCache.current.clear();
      audioRef.current?.pause();
    };
  }, []);

  const handleTogglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !songs[currentIdx]) return;
    const song = songs[currentIdx];
    try {
      if (playing) {
        audio.pause();
        setPlaying(false);
        return;
      }
      // Lấy blob URL (cache sẵn cho những lần sau)
      const url = await getBlobUrl(song);
      if (audio.src !== url) {
        audio.src = url;
        audio.load();
      }
      await audio.play();
      setPlaying(true);
    } catch (err) {
      toast.error(`Không phát được: ${(err as Error).message}`);
      setPlaying(false);
    }
  };

  const handleSelect = (idx: number) => {
    if (idx === currentIdx) return;
    setCurrentIdx(idx);
    setPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      // Xóa src để browser giải phóng buffer; sẽ set lại khi user bấm Phát.
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
  };

  const handleReveal = async () => {
    try {
      const res = await window.lap.audio.reveal();
      if (!res.ok) toast.error(res.error ?? "Không mở được thư mục");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleAdd = async () => {
    try {
      setBusy("add");
      const res = await window.lap.audio.add();
      if (!res.ok) {
        toast.error(res.error ?? "Thêm file thất bại");
        return;
      }
      if (res.data && res.data.added > 0) {
        toast.success(`Đã thêm ${res.data.added} file vào thư mục audio`);
        await loadList();
      } else {
        toast.info("Không có file nào được thêm");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleRefresh = async () => {
    try {
      setBusy("refresh");
      await loadList();
    } finally {
      setBusy(null);
    }
  };

  const recordResult = (song: AudioFileInfo, result: "pass" | "fail") => {
    setResults((r) => ({ ...r, [song.id]: result }));
    upsertTest({
      type: "speaker",
      result,
      payload: { songId: song.id, title: song.title, file: song.fileName },
      capturedAt: new Date().toISOString(),
    });
    toast[result === "pass" ? "success" : "error"](
      result === "pass" ? "Đã ghi nhận: Nghe rõ" : "Đã ghi nhận: Có vấn đề",
    );
  };

  const passCount = Object.values(results).filter((v) => v === "pass").length;
  const failCount = Object.values(results).filter((v) => v === "fail").length;
  const currentSong = songs[currentIdx];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {playing ? <Volume2 className="h-5 w-5 animate-pulse" /> : <VolumeX className="h-5 w-5" />}
          Test loa
        </CardTitle>
        <CardDescription>
          Phát từng bài và đánh dấu nghe rõ / có vấn đề. File nhạc được lưu cố định trong thư mục audio của
          app, bạn có thể copy thêm MP3/WAV vào đó bất kỳ lúc nào.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleAdd} disabled={busy !== null}>
            {busy === "add" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Thêm file nhạc
          </Button>
          <Button size="sm" variant="outline" onClick={handleReveal}>
            <FolderOpen className="h-4 w-4" />
            Mở thư mục audio
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={busy !== null || loadingSongs}
          >
            {busy === "refresh" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Tải lại
          </Button>
          {audioDir ? (
            <span
              className="truncate text-[10px] text-muted-foreground"
              title={audioDir}
            >
              {audioDir}
            </span>
          ) : null}
        </div>

        {loadingSongs ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : null}

        {error ? <p className="text-xs text-amber-500">{error}</p> : null}

        {!loadingSongs && songs.length > 0 ? (
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
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {song.title}
                    {song.source === "builtin" ? (
                      <Badge variant="outline" className="text-[9px] uppercase">
                        Mặc định
                      </Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {song.fileName} · {song.mime} · {fmtSize(song.sizeBytes)}
                  </p>
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

        {currentSong ? (
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <Button onClick={handleTogglePlay}>
              {playing ? <Pause className="h-4 w-4" /> : <Speaker className="h-4 w-4" />}
              {playing ? "Tạm dừng" : "Phát"}
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {currentSong.title}{" "}
                <span className="text-xs text-muted-foreground">
                  ({currentIdx + 1}/{songs.length})
                </span>
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {currentSong.fileName} · {currentSong.mime} · {fmtSize(currentSong.sizeBytes)}
              </p>
            </div>
            <audio
              ref={audioRef}
              preload="auto"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onError={() => {
                setPlaying(false);
                toast.error("Audio element lỗi - kiểm tra file trong thư mục audio");
              }}
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
