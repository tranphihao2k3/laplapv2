"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music2,
  ArrowLeft,
  ArrowRight,
  X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
export type Song = {
  id: string;
  title: string;
  artist: string | null;
  file_url: string;
  duration_seconds: number | null;
};

export type Channel = "left" | "right" | "both";

type PlayerContextValue = {
  // Songs
  songs: Song[];
  loadingSongs: boolean;
  songsError: string | null;
  currentIdx: number;
  currentSong: Song | null;
  // Playback
  isPlaying: boolean;
  channel: Channel;
  volume: number;
  currentTime: number;
  duration: number;
  // Controls
  togglePlay: () => Promise<void>;
  stop: () => Promise<void>;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  setChannel: (c: Channel) => void;
  setVolume: (v: number) => void;
  setIdx: (i: number) => void;
  // UI
  collapsed: boolean;
  setCollapsed: (b: boolean) => void;
};

// ── Context ───────────────────────────────────────────────────────────────────
const PlayerContext = createContext<PlayerContextValue | null>(null);

export function useAudioPlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used within TestLaptopAudioProvider");
  return ctx;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Pause an toàn: chờ promise play() đang treo lắng xuống rồi mới pause.
 * Tránh AbortError "play() request was interrupted by a call to pause()".
 */
async function safePause(
  audio: HTMLAudioElement | null,
  pending: React.MutableRefObject<Promise<void> | null>,
) {
  if (!audio) return;
  if (pending.current) {
    await pending.current.catch(() => {});
    pending.current = null;
  }
  audio.pause();
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function TestLaptopAudioProvider({ children }: { children: React.ReactNode }) {
  // Songs
  const [songs, setSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [songsError, setSongsError] = useState<string | null>(null);

  // Player state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [channel, setChannel] = useState<Channel>("both");
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioInitRef = useRef(false);
  const gainRef = useRef<GainNode | null>(null);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // ── Fetch songs ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingSongs(true);
        const res = await fetch("/api/v1/speaker-songs?active_only=true&pageSize=10");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const items: Song[] = json?.data?.items ?? [];
        setSongs(items);
      } catch (e) {
        if (cancelled) return;
        setSongsError("Không thể tải danh sách bài nhạc.");
        console.error(e);
      } finally {
        if (!cancelled) setLoadingSongs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Setup Web Audio routing (chỉ 1 lần cho cả session) ──────────────────────
  const setupAudioGraph = useCallback((audio: HTMLAudioElement) => {
    if (audioInitRef.current) return; // MediaElementSource chỉ tạo được 1 lần/element
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    const ctx = audioCtxRef.current;

    const source = ctx.createMediaElementSource(audio);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);

    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(0, ctx.currentTime);

    source.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    sourceRef.current = source;
    gainRef.current = gain;
    pannerRef.current = panner;
    audioInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Đổi src của cùng 1 <audio> khi bài hát thay đổi ─────────────────────────
  useEffect(() => {
    if (songs.length === 0) return;
    const song = songs[currentIdx];
    if (!song) return;

    if (!audioRef.current) {
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.preload = "metadata";

      audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
      audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
      audio.addEventListener("ended", () => {
        setCurrentIdx((prev) => (prev + 1) % songs.length);
      });

      audioRef.current = audio;
      setupAudioGraph(audio);
    }

    const audio = audioRef.current;
    void safePause(audio, playPromiseRef).then(() => {
      audio.src = song.file_url;
      audio.load();
      setCurrentTime(0);
      setIsPlaying(false);
    });

    return () => {
      if (audioRef.current) {
        void safePause(audioRef.current, playPromiseRef);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx, songs, setupAudioGraph]);

  // ── Sync pan when channel changes ──────────────────────────────────────────
  useEffect(() => {
    if (!pannerRef.current || !audioCtxRef.current) return;
    pannerRef.current.pan.setValueAtTime(
      channel === "left" ? -1 : channel === "right" ? 1 : 0,
      audioCtxRef.current.currentTime,
    );
  }, [channel]);

  // ── Sync volume ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gainRef.current || !audioCtxRef.current) return;
    gainRef.current.gain.setValueAtTime(volume, audioCtxRef.current.currentTime);
  }, [volume]);

  // ── Controls ───────────────────────────────────────────────────────────────
  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const ctx = audioCtxRef.current;
    if (ctx?.state === "suspended") await ctx.resume();
    if (isPlaying) {
      setIsPlaying(false);
      await safePause(audio, playPromiseRef);
    } else {
      setIsPlaying(true);
      try {
        const p = audio.play();
        playPromiseRef.current = p;
        await p;
        playPromiseRef.current = null;
      } catch (e) {
        playPromiseRef.current = null;
        if ((e as DOMException)?.name === "AbortError") return;
        setIsPlaying(false);
        if ((e as DOMException)?.name === "NotSupportedError") {
          setSongsError("Không phát được file nhạc này (thiếu file trên Supabase Storage).");
        }
      }
    }
  }, [isPlaying]);

  const stop = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setIsPlaying(false);
    setCurrentTime(0);
    await safePause(audio, playPromiseRef);
    audio.currentTime = 0;
  }, []);

  const next = useCallback(() => {
    void stop();
    setCurrentIdx((i) => (i + 1) % Math.max(1, songs.length));
  }, [stop, songs.length]);

  const prev = useCallback(() => {
    void stop();
    setCurrentIdx((i) => (i - 1 + Math.max(1, songs.length)) % Math.max(1, songs.length));
  }, [stop, songs.length]);

  const seek = useCallback((t: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = t;
    setCurrentTime(t);
  }, []);

  const setIdx = useCallback((i: number) => {
    setCurrentIdx(i);
  }, []);

  const setVol = useCallback((v: number) => {
    setVolume(v);
  }, []);

  const currentSong = songs[currentIdx] ?? null;
  const hasSongs = songs.length > 0;

  // ── Context value ───────────────────────────────────────────────────────────
  const value = useMemo<PlayerContextValue>(
    () => ({
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
      setVolume: setVol,
      setIdx,
      collapsed,
      setCollapsed,
    }),
    [
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
      setVol,
      setIdx,
      collapsed,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <BottomPlayer hasSongs={hasSongs} loadingSongs={loadingSongs} />
    </PlayerContext.Provider>
  );
}

// ── Bottom sticky player ──────────────────────────────────────────────────────
function BottomPlayer({ hasSongs, loadingSongs }: { hasSongs: boolean; loadingSongs: boolean }) {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    channel,
    songs,
    currentIdx,
    collapsed,
    setCollapsed,
    togglePlay,
    stop,
    next,
    prev,
    seek,
    setChannel,
    setVolume,
    setIdx,
  } = useAudioPlayer();

  // Ẩn hoàn toàn nếu chưa có bài hoặc đang load
  if (loadingSongs || !hasSongs || !currentSong) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 pointer-events-none">
      <div
        className={`pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur-md transition-all`}
      >
        {collapsed ? (
          // ── Compact view ───────────────────────────────────────────────────
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
              <Music2 className={`h-4 w-4 text-white ${isPlaying ? "animate-pulse" : ""}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{currentSong.title}</p>
              <p className="truncate text-[10px] text-zinc-500">
                {currentSong.artist ?? "Đang phát"}
              </p>
            </div>
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 transition"
              aria-label={isPlaying ? "Tạm dừng" : "Phát"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition"
              aria-label="Mở rộng"
              title="Mở rộng trình phát"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
            </button>
          </div>
        ) : (
          // ── Expanded view ──────────────────────────────────────────────────
          <div className="px-4 py-3 space-y-2.5">
            {/* Row 1: title + close */}
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
                <Music2 className={`h-4 w-4 text-white ${isPlaying ? "animate-pulse" : ""}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">
                  {currentSong.title}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {currentSong.artist ?? "Đang phát"} · {currentIdx + 1}/{songs.length}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await stop();
                  setCollapsed(true);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-red-600 transition"
                aria-label="Đóng trình phát"
                title="Đóng trình phát"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Row 2: seek bar */}
            <div className="flex items-center gap-2">
              <span className="w-9 shrink-0 text-right font-mono text-[10px] text-zinc-500">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(e) => seek(parseFloat(e.target.value))}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900"
              />
              <span className="w-9 shrink-0 font-mono text-[10px] text-zinc-500">
                {formatTime(duration || currentSong.duration_seconds)}
              </span>
            </div>

            {/* Row 3: controls + volume + channel */}
            <div className="flex items-center gap-2">
              {/* Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prev}
                  disabled={songs.length < 2}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 transition"
                  aria-label="Bài trước"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 transition"
                  aria-label={isPlaying ? "Tạm dừng" : "Phát"}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={stop}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 transition"
                  aria-label="Dừng"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={songs.length < 2}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 transition"
                  aria-label="Bài tiếp"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>

              {/* Channel selector */}
              <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 p-0.5 ml-auto">
                {(["left", "both", "right"] as Channel[]).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    title={ch === "left" ? "Loa Trái" : ch === "right" ? "Loa Phải" : "Cả hai"}
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition ${
                      channel === ch
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {ch === "left" ? (
                      <ArrowLeft className="h-3 w-3" />
                    ) : ch === "right" ? (
                      <ArrowRight className="h-3 w-3" />
                    ) : (
                      <Volume2 className="h-3 w-3" />
                    )}
                  </button>
                ))}
              </div>

              {/* Volume */}
              <div className="flex w-28 items-center gap-1.5">
                {volume === 0 ? (
                  <VolumeX className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                )}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900"
                />
              </div>

              {/* Song list quick-pick */}
              {songs.length > 1 && (
                <select
                  value={currentIdx}
                  onChange={(e) => setIdx(parseInt(e.target.value, 10))}
                  className="hidden sm:block h-8 max-w-[120px] truncate rounded-md border border-zinc-200 bg-white px-2 text-xs"
                  title="Chọn bài"
                >
                  {songs.map((s, i) => (
                    <option key={s.id} value={i}>
                      {s.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
