"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

// ---- Web Audio: tạo tiếng "click" cơ học khi bấm phím ----
// Không dùng file âm thanh, sinh hoàn toàn bằng oscillator + noise burst.
type SoundProfile = "mechanical" | "soft" | "typewriter";

function createKeyClickSound(
  ctx: AudioContext,
  profile: SoundProfile,
  volume: number,
) {
  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(volume, now);
  masterGain.connect(ctx.destination);

  if (profile === "mechanical") {
    // Tiếng click cơ học: noise burst ngắn + transient sắc
    const bufSize = ctx.sampleRate * 0.04;
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.15));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    noise.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.04);

    // Transient "tick" dùng oscillator pendek
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.015);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.02);

  } else if (profile === "soft") {
    // Tiếng bấm nhẹ (membrane / scissor switch)
    const bufSize = ctx.sampleRate * 0.025;
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.2));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3000, now);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.025);

  } else {
    // Typewriter: click sắc + tiếng "ding" nhẹ
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.03);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.7, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.03);
  }
}

// ---- Kiểu dữ liệu 1 phím ----
type Key = {
  code: string;
  label: string;
  /** class chiều rộng, mặc định w-11 */
  width?: string;
  /** ô trống để căn hàng (không phải phím thật) */
  spacer?: boolean;
  /** phím không phát sự kiện keydown (vd Fn) → không tính vào tổng */
  noCount?: boolean;
  /** class phụ (vd chữ nhỏ) */
  extra?: string;
};

type KbSection = Key[][];
type KbLayout = {
  id: string;
  name: string;
  /** khối phím chính */
  main: KbSection;
  /** cụm phím điều hướng (giữa) — full-size */
  nav?: KbSection;
  /** cụm phím số (phải) — full-size */
  numpad?: KbSection;
};

const S = (width = "w-11"): Key => ({ code: "", label: "", spacer: true, width });

// ======================= LAYOUT: LAPTOP FULL-SIZE (WINDOWS) =======================
const LAYOUT_FULL: KbLayout = {
  id: "full",
  name: "Laptop Full-size (Windows)",
  main: [
    [
      { code: "Escape", label: "Esc" },
      { code: "F1", label: "F1" }, { code: "F2", label: "F2" }, { code: "F3", label: "F3" }, { code: "F4", label: "F4" },
      { code: "F5", label: "F5" }, { code: "F6", label: "F6" }, { code: "F7", label: "F7" }, { code: "F8", label: "F8" },
      { code: "F9", label: "F9" }, { code: "F10", label: "F10" }, { code: "F11", label: "F11" }, { code: "F12", label: "F12" },
    ],
    [
      { code: "Backquote", label: "~" },
      { code: "Digit1", label: "1" }, { code: "Digit2", label: "2" }, { code: "Digit3", label: "3" }, { code: "Digit4", label: "4" },
      { code: "Digit5", label: "5" }, { code: "Digit6", label: "6" }, { code: "Digit7", label: "7" }, { code: "Digit8", label: "8" },
      { code: "Digit9", label: "9" }, { code: "Digit0", label: "0" }, { code: "Minus", label: "-" }, { code: "Equal", label: "=" },
      { code: "Backspace", label: "Backspace", width: "w-[4.5rem]", extra: "text-[10px]" },
    ],
    [
      { code: "Tab", label: "Tab", width: "w-14" },
      { code: "KeyQ", label: "Q" }, { code: "KeyW", label: "W" }, { code: "KeyE", label: "E" }, { code: "KeyR", label: "R" },
      { code: "KeyT", label: "T" }, { code: "KeyY", label: "Y" }, { code: "KeyU", label: "U" }, { code: "KeyI", label: "I" },
      { code: "KeyO", label: "O" }, { code: "KeyP", label: "P" }, { code: "BracketLeft", label: "[" }, { code: "BracketRight", label: "]" },
      { code: "Backslash", label: "\\", width: "w-12" },
    ],
    [
      { code: "CapsLock", label: "Caps", width: "w-16", extra: "text-[10px]" },
      { code: "KeyA", label: "A" }, { code: "KeyS", label: "S" }, { code: "KeyD", label: "D" }, { code: "KeyF", label: "F" },
      { code: "KeyG", label: "G" }, { code: "KeyH", label: "H" }, { code: "KeyJ", label: "J" }, { code: "KeyK", label: "K" },
      { code: "KeyL", label: "L" }, { code: "Semicolon", label: ";" }, { code: "Quote", label: "'" },
      { code: "Enter", label: "Enter", width: "w-[4.5rem]", extra: "text-[10px]" },
    ],
    [
      { code: "ShiftLeft", label: "Shift", width: "w-20", extra: "text-[10px]" },
      { code: "KeyZ", label: "Z" }, { code: "KeyX", label: "X" }, { code: "KeyC", label: "C" }, { code: "KeyV", label: "V" },
      { code: "KeyB", label: "B" }, { code: "KeyN", label: "N" }, { code: "KeyM", label: "M" },
      { code: "Comma", label: "," }, { code: "Period", label: "." }, { code: "Slash", label: "/" },
      { code: "ShiftRight", label: "Shift", width: "w-20", extra: "text-[10px]" },
    ],
    [
      { code: "ControlLeft", label: "Ctrl", width: "w-14", extra: "text-[10px]" },
      { code: "MetaLeft", label: "Win", width: "w-12", extra: "text-[10px]" },
      { code: "AltLeft", label: "Alt", width: "w-12", extra: "text-[10px]" },
      { code: "Space", label: "Space", width: "flex-1 min-w-[180px]" },
      { code: "AltRight", label: "Alt", width: "w-12", extra: "text-[10px]" },
      { code: "MetaRight", label: "Win", width: "w-12", extra: "text-[10px]" },
      { code: "ContextMenu", label: "☰", width: "w-12" },
      { code: "ControlRight", label: "Ctrl", width: "w-14", extra: "text-[10px]" },
    ],
  ],
  nav: [
    [{ code: "PrintScreen", label: "PrtSc", extra: "text-[9px]" }, { code: "ScrollLock", label: "ScrLk", extra: "text-[9px]" }, { code: "Pause", label: "Pause", extra: "text-[9px]" }],
    [{ code: "Insert", label: "Ins", extra: "text-[10px]" }, { code: "Home", label: "Home", extra: "text-[9px]" }, { code: "PageUp", label: "PgUp", extra: "text-[9px]" }],
    [{ code: "Delete", label: "Del", extra: "text-[10px]" }, { code: "End", label: "End", extra: "text-[10px]" }, { code: "PageDown", label: "PgDn", extra: "text-[9px]" }],
    [S(), S(), S()],
    [S(), { code: "ArrowUp", label: "▲" }, S()],
    [{ code: "ArrowLeft", label: "◀" }, { code: "ArrowDown", label: "▼" }, { code: "ArrowRight", label: "▶" }],
  ],
  numpad: [
    [S(), S(), S(), S()],
    [{ code: "NumLock", label: "Num", extra: "text-[10px]" }, { code: "NumpadDivide", label: "/" }, { code: "NumpadMultiply", label: "*" }, { code: "NumpadSubtract", label: "-" }],
    [{ code: "Numpad7", label: "7" }, { code: "Numpad8", label: "8" }, { code: "Numpad9", label: "9" }, { code: "NumpadAdd", label: "+" }],
    [{ code: "Numpad4", label: "4" }, { code: "Numpad5", label: "5" }, { code: "Numpad6", label: "6" }, S()],
    [{ code: "Numpad1", label: "1" }, { code: "Numpad2", label: "2" }, { code: "Numpad3", label: "3" }, { code: "NumpadEnter", label: "↵", extra: "text-[10px]" }],
    [{ code: "Numpad0", label: "0", width: "w-[5.75rem]" }, { code: "NumpadDecimal", label: "." }, S()],
  ],
};

// ======================= LAYOUT: MACBOOK =======================
const LAYOUT_MAC: KbLayout = {
  id: "mac",
  name: "MacBook",
  main: [
    [
      { code: "Escape", label: "esc", width: "w-14", extra: "text-[10px]" },
      { code: "F1", label: "F1" }, { code: "F2", label: "F2" }, { code: "F3", label: "F3" }, { code: "F4", label: "F4" },
      { code: "F5", label: "F5" }, { code: "F6", label: "F6" }, { code: "F7", label: "F7" }, { code: "F8", label: "F8" },
      { code: "F9", label: "F9" }, { code: "F10", label: "F10" }, { code: "F11", label: "F11" }, { code: "F12", label: "F12" },
      { code: "Power", label: "⏻", noCount: true },
    ],
    [
      { code: "Backquote", label: "`" },
      { code: "Digit1", label: "1" }, { code: "Digit2", label: "2" }, { code: "Digit3", label: "3" }, { code: "Digit4", label: "4" },
      { code: "Digit5", label: "5" }, { code: "Digit6", label: "6" }, { code: "Digit7", label: "7" }, { code: "Digit8", label: "8" },
      { code: "Digit9", label: "9" }, { code: "Digit0", label: "0" }, { code: "Minus", label: "-" }, { code: "Equal", label: "=" },
      { code: "Backspace", label: "delete", width: "w-16", extra: "text-[10px]" },
    ],
    [
      { code: "Tab", label: "tab", width: "w-16", extra: "text-[10px]" },
      { code: "KeyQ", label: "Q" }, { code: "KeyW", label: "W" }, { code: "KeyE", label: "E" }, { code: "KeyR", label: "R" },
      { code: "KeyT", label: "T" }, { code: "KeyY", label: "Y" }, { code: "KeyU", label: "U" }, { code: "KeyI", label: "I" },
      { code: "KeyO", label: "O" }, { code: "KeyP", label: "P" }, { code: "BracketLeft", label: "[" }, { code: "BracketRight", label: "]" },
      { code: "Backslash", label: "\\" },
    ],
    [
      { code: "CapsLock", label: "caps", width: "w-[4.5rem]", extra: "text-[10px]" },
      { code: "KeyA", label: "A" }, { code: "KeyS", label: "S" }, { code: "KeyD", label: "D" }, { code: "KeyF", label: "F" },
      { code: "KeyG", label: "G" }, { code: "KeyH", label: "H" }, { code: "KeyJ", label: "J" }, { code: "KeyK", label: "K" },
      { code: "KeyL", label: "L" }, { code: "Semicolon", label: ";" }, { code: "Quote", label: "'" },
      { code: "Enter", label: "return", width: "w-[5.25rem]", extra: "text-[10px]" },
    ],
    [
      { code: "ShiftLeft", label: "⇧ shift", width: "w-[6rem]", extra: "text-[10px]" },
      { code: "KeyZ", label: "Z" }, { code: "KeyX", label: "X" }, { code: "KeyC", label: "C" }, { code: "KeyV", label: "V" },
      { code: "KeyB", label: "B" }, { code: "KeyN", label: "N" }, { code: "KeyM", label: "M" },
      { code: "Comma", label: "," }, { code: "Period", label: "." }, { code: "Slash", label: "/" },
      { code: "ShiftRight", label: "⇧ shift", width: "w-[6rem]", extra: "text-[10px]" },
    ],
    [
      { code: "Fn", label: "fn", extra: "text-[10px]", noCount: true },
      { code: "ControlLeft", label: "⌃", extra: "text-sm" },
      { code: "AltLeft", label: "⌥", extra: "text-sm" },
      { code: "MetaLeft", label: "⌘", width: "w-14", extra: "text-sm" },
      { code: "Space", label: "", width: "flex-1 min-w-[200px]" },
      { code: "MetaRight", label: "⌘", width: "w-14", extra: "text-sm" },
      { code: "AltRight", label: "⌥", extra: "text-sm" },
      { code: "ArrowLeft", label: "◀", width: "w-9" },
      { code: "ArrowUp", label: "▲", width: "w-9" },
      { code: "ArrowDown", label: "▼", width: "w-9" },
      { code: "ArrowRight", label: "▶", width: "w-9" },
    ],
  ],
};

const LAYOUTS: KbLayout[] = [LAYOUT_FULL, LAYOUT_MAC];

/** Lấy tất cả code phím thật (tính điểm) của 1 layout. */
function countableCodes(layout: KbLayout): string[] {
  const codes: string[] = [];
  const sections = [layout.main, layout.nav ?? [], layout.numpad ?? []];
  for (const section of sections) {
    for (const row of section) {
      for (const key of row) {
        if (!key.spacer && !key.noCount && key.code) codes.push(key.code);
      }
    }
  }
  return codes;
}

export default function KeyboardPage() {
  const router = useRouter();
  const [layoutId, setLayoutId] = useState<string>("full");
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

  // --- Âm thanh ---
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundProfile, setSoundProfile] = useState<SoundProfile>("mechanical");
  const [soundVolume, setSoundVolume] = useState(0.7);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    // Resume nếu bị suspended (policy autoplay)
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playKeySound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioCtx();
      createKeyClickSound(ctx, soundProfile, soundVolume);
    } catch {
      // Bỏ qua lỗi AudioContext (một số trình duyệt block autoplay)
    }
  }, [soundEnabled, soundProfile, soundVolume, getAudioCtx]);

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  const layout = LAYOUTS.find((l) => l.id === layoutId) ?? LAYOUT_FULL;

  // Tự thu nhỏ bàn phím cho vừa bề ngang khung (tránh scroll ngang).
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [boardHeight, setBoardHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const board = boardRef.current;
    if (!wrap || !board) return;
    const recompute = () => {
      const available = wrap.clientWidth;
      // scrollWidth/scrollHeight KHÔNG bị transform:scale ảnh hưởng → luôn là kích thước tự nhiên.
      const naturalW = board.scrollWidth;
      const naturalH = board.scrollHeight;
      if (!naturalW) return;
      const next = naturalW > available ? available / naturalW : 1;
      setScale(next);
      setBoardHeight(naturalH * next);
    };
    recompute();
    // Theo dõi cả wrap (đổi bề ngang) lẫn board (font/layout ổn định muộn) để đo lại.
    const ro = new ResizeObserver(recompute);
    ro.observe(wrap);
    ro.observe(board);
    return () => ro.disconnect();
  }, [layoutId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      const code = e.code || e.key;
      // Chỉ phát âm thanh khi phím được bấm lần đầu (không repeat)
      if (!e.repeat) {
        playKeySound();
      }
      setPressedKeys((prev) => new Set(prev).add(code));
      setActiveKeys((prev) => new Set(prev).add(code));
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      const code = e.code || e.key;
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [playKeySound]);

  // Chỉ đếm phím thuộc layout hiện tại đã được bấm.
  const codes = useMemo(() => countableCodes(layout), [layout]);
  const totalKeys = codes.length;
  const pressedCount = useMemo(
    () => codes.filter((c) => pressedKeys.has(c)).length,
    [codes, pressedKeys],
  );

  const resetKeyboard = () => {
    setPressedKeys(new Set());
    setActiveKeys(new Set());
  };

  const renderKey = (key: Key, idx: number) => {
    if (key.spacer) {
      return <div key={`sp-${idx}`} className={cn("h-11 shrink-0", key.width ?? "w-11")} />;
    }
    const isPressed = pressedKeys.has(key.code);
    const isActive = activeKeys.has(key.code);

    let bgClass = "bg-white border-zinc-200 text-zinc-800";
    if (isPressed) bgClass = "bg-emerald-600 border-emerald-600 text-white shadow-[0_0_0_2px_rgba(16,185,129,0.25)]";
    if (isActive) bgClass = "bg-zinc-800 border-zinc-800 text-white scale-95 shadow-inner";

    return (
      <div
        key={key.code}
        className={cn(
          "flex h-11 shrink-0 items-center justify-center rounded-md border font-semibold shadow-sm transform-gpu transition-all duration-100 ease-out",
          key.width ?? "w-11",
          key.extra ?? "text-xs",
          bgClass,
        )}
      >
        {key.label}
      </div>
    );
  };

  const renderSection = (section: KbSection, keyPrefix: string) => (
    <div className="space-y-1.5">
      {section.map((row, i) => (
        <div key={`${keyPrefix}-${i}`} className="flex justify-center gap-1.5">
          {row.map((key, j) => renderKey(key, j))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Button variant="ghost" className="mb-4" onClick={() => router.push("/test-laptop")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Quay lại
      </Button>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Test Bàn phím</CardTitle>
            <CardDescription>
              Bấm các phím trên bàn phím vật lý để kiểm tra. Phím hoạt động tốt sẽ đổi màu xanh.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-semibold whitespace-nowrap">
              Đã bấm: {pressedCount}/{totalKeys} phím
            </div>
            <Button variant="outline" size="sm" onClick={resetKeyboard}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Bộ chọn layout */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Kiểu bàn phím:</span>
            <div className="inline-flex rounded-lg border bg-muted p-1">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setLayoutId(l.id);
                    resetKeyboard();
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                    layoutId === l.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>

          {/* Điều khiển âm thanh */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            {/* Toggle bật/tắt */}
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                soundEnabled
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400",
              )}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              {soundEnabled ? "Âm thanh: Bật" : "Âm thanh: Tắt"}
            </button>

            {/* Chọn kiểu tiếng */}
            {soundEnabled && (
              <>
                <div className="inline-flex rounded-lg border bg-white p-0.5 text-xs">
                  {(["mechanical", "soft", "typewriter"] as SoundProfile[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSoundProfile(p)}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 font-medium transition-all",
                        soundProfile === p
                          ? "bg-zinc-900 text-white shadow-sm"
                          : "text-zinc-500 hover:text-zinc-800",
                      )}
                    >
                      {p === "mechanical" ? "⚙ Cơ học" : p === "soft" ? "🤫 Nhẹ" : "🖨 Typewriter"}
                    </button>
                  ))}
                </div>

                {/* Volume slider */}
                <div className="flex items-center gap-2 ml-auto">
                  <Volume2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={soundVolume}
                    onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                    className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900"
                  />
                  <span className="text-xs text-zinc-500 w-8 text-right">
                    {Math.round(soundVolume * 100)}%
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Wrapper đo bề ngang; bàn phím tự scale cho vừa (không scroll ngang). */}
          <div ref={wrapRef} className="rounded-xl border border-zinc-200 bg-zinc-50 p-2 sm:p-4">
            <div style={{ height: boardHeight }} className="flex justify-center">
              <div
                ref={boardRef}
                style={{ transform: `scale(${scale})` }}
                className="w-max origin-top select-none transition-transform duration-150"
              >
                {layout.numpad || layout.nav ? (
                  // Full-size: 3 khối main | nav | numpad
                  <div className="flex items-start justify-center gap-4">
                    {renderSection(layout.main, "main")}
                    {layout.nav && <div className="pt-[3.375rem]">{renderSection(layout.nav, "nav")}</div>}
                    {layout.numpad && renderSection(layout.numpad, "numpad")}
                  </div>
                ) : (
                  // MacBook: chỉ khối main
                  <div className="mx-auto max-w-fit">{renderSection(layout.main, "main")}</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded border bg-white" />
              <span>Chưa bấm</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded bg-zinc-800" />
              <span>Đang đè</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded bg-emerald-600" />
              <span>Đã kiểm tra (Pass)</span>
            </div>
          </div>

          {layout.id === "mac" && (
            <p className="text-center text-xs text-muted-foreground">
              Lưu ý: phím <strong>fn</strong> và <strong>⏻</strong> (nguồn/Touch ID) trên macOS thường không gửi
              tín hiệu tới trình duyệt nên không tính điểm.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
