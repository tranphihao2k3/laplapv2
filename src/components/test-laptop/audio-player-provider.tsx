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
  X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
export type Song = {
  id: string;
  title: string;
  artist: string | null;
  file_url: string;
  duration_seconds: number | null;
  source?: "builtin" | "remote";
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

// ── Built-in test audio (served by Next.js API route) ────────────────────────
const BUILTIN_SONGS: Song[] = [
  {
    id: "test-tone-440",
    title: "Test Tone 440 Hz",
    artist: "LapLap Test",
    file_url: "/api/v1/test-audio/440",
    duration_seconds: 3,
    source: "builtin",
  },
  {
    id: "test-tone-880",
    title: "Test Tone 880 Hz",
    artist: "LapLap Test",
    file_url: "/api/v1/test-audio/880",
    duration_seconds: 3,
    source: "builtin",
  },
  {
    id: "test-tone-1000",
    title: "Test Tone 1 kHz",
    artist: "LapLap Test",
    file_url: "/api/v1/test-audio/1000",
    duration_seconds: 3,
    source: "builtin",
  },
  {
    id: "test-chirp",
    title: "Chirp 20 Hz → 20 kHz",
    artist: "LapLap Test",
    file_url: "/api/v1/test-audio/chirp",
    duration_seconds: 5,
    source: "builtin",
  },
  // ── Real music files (served from /public/Music/) ──────────────────────────
  {
    id: "music-hong-nhan-remix",
    title: "Hồng Nhan Remix 2025",
    artist: "Jack - J97 x Ness Remix",
    file_url: "/Music/hong-nhan-remix-ness.mp3",
    duration_seconds: 713,
    source: "builtin",
  },
  {
    id: "music-khuon-mat-dang-thuong",
    title: "Khuôn Mặt Đáng Thương (Synthwave)",
    artist: "Sơn Tùng M-TP",
    file_url: "/Music/khuon-mat-dang-thuong-sontung-synthwave.mp3",
    duration_seconds: 540,
    source: "builtin",
  },
  {
    id: "music-nhac-nay-nay",
    title: "Nhạc Này Nẩy (Rap Việt Mix)",
    artist: "HIEUTHUHAI, 24K.Right, Obito, Gill, Wxrdie, Tazle...",
    file_url: "/Music/nhac-nay-nay-rap-viet-mix.mp3",
    duration_seconds: 2625,
    source: "builtin",
  },
];

const CACHE_NAME = "laplap-test-audio-v1";

/**
 * Pre-fetch & cache all built-in test audio into Cache Storage so subsequent
 * plays are instant and survive offline. Fire-and-forget — failures are
 * silently logged because the network fetch itself is the fallback path.
 */
async function precacheBuiltinAudio(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const urls = BUILTIN_SONGS.map((s) => s.file_url);
    await Promise.all(
      urls.map(async (url) => {
        const cached = await cache.match(url);
        if (cached) return;
        try {
          const res = await fetch(url, { cache: "reload" });
          if (res.ok) await cache.put(url, res.clone());
        } catch {
          // ignore — first play will still work via direct fetch
        }
      }),
    );
  } catch (err) {
    console.warn("[audio] precache failed", err);
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function TestLaptopAudioProvider({ children }: { children: React.ReactNode }) {
  // Songs
  const [songs, setSongs] = useState<Song[]>(BUILTIN_SONGS);
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

  // ── Pre-cache built-in audio + fetch remote songs ───────────────────────────
  useEffect(() => {
    let cancelled = false;

    // Kick off cache pre-fetch in parallel; do not block UI
    void precacheBuiltinAudio();

    (async () => {
      try {
        setLoadingSongs(true);
        const res = await fetch("/api/v1/speaker-songs?active_only=true&pageSize=10");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const items: Song[] = (json?.data?.items ?? []).map((s: Song) => ({
          ...s,
          source: "remote",
        }));
        // Built-in first, then remote
        setSongs([...BUILTIN_SONGS, ...items]);
        setSongsError(null);
      } catch (e) {
        if (cancelled) return;
        // Keep built-in list, show a friendly notice
        setSongsError(
          "Không tải được danh sách bài nhạc từ máy chủ. Vẫn dùng được các bài test mặc định.",
        );
        console.warn("[audio] remote song fetch failed", e);
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
      audio.preload = "auto";

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
          setSongsError("Không phát được file nhạc này (thiếu file hoặc server chưa sẵn sàng).");
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
const STORAGE_KEY = "audio-player-position-v1";

interface Position {
  x: number;
  y: number;
}

function loadPosition(): Position {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Position;
  } catch {
    // ignore
  }
  return { x: 0, y: 0 };
}

function savePosition(pos: Position) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

function BottomPlayer({ hasSongs, loadingSongs }: { hasSongs: boolean; loadingSongs: boolean }) {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
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
  } = useAudioPlayer();

  // Drag state
  const [position, setPosition] = useState<Position>(loadPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<Position>({ x: 0, y: 0 });
  const hasRestoredRef = useRef(false);

  // Restore position from localStorage after hydration
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    setPosition(loadPosition());
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag if clicking on the drag handle area (top part)
    const target = e.target as HTMLElement;
    if (!target.closest("[data-drag-handle]")) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    };

    const handleMouseUp = () => {
      if (!isDragging) return;
      setIsDragging(false);
      // Save position when drag ends
      savePosition(position);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, position]);

  // Ẩn hoàn toàn nếu chưa có bài hoặc đang load
  if (loadingSongs || !hasSongs || !currentSong) return null;

  const isBuiltin = currentSong.source === "builtin";

  return (
    <div
      className={`fixed right-4 bottom-4 z-50 pointer-events-none ${isDragging ? "select-none" : ""}`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      <div
        className={`pointer-events-auto w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur-md transition-all ${isDragging ? "shadow-3xl ring-2 ring-zinc-400/50" : ""}`}
        onMouseDown={handleMouseDown}
      >
        {/* Drag handle */}
        <div
          data-drag-handle
          className="flex items-center justify-center py-1.5 cursor-grab active:cursor-grabbing hover:bg-zinc-50 rounded-t-2xl select-none"
          title="Kéo để di chuyển"
        >
          <div className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-zinc-400"
              />
            ))}
          </div>
        </div>

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
                {isBuiltin ? " · local" : ""}
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
          <div className="px-3 py-2.5 space-y-1.5">
            {/* Row 1: title + close */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
                <Music2 className={`h-3.5 w-3.5 text-white ${isPlaying ? "animate-pulse" : ""}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">
                  {currentSong.title}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {currentSong.artist ?? "Đang phát"} · {currentIdx + 1}/{songs.length}
                  {isBuiltin ? " · local" : ""}
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

            {/* Row 3: controls + volume */}
            <div className="flex items-center gap-2">
              {/* Controls */}
              <div className="flex items-center gap-1 mr-auto">
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
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700 transition"
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

              {/* Volume */}
              <div className="flex items-center gap-1.5">
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
                  className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}