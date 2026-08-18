import * as React from "react";
import { RotateCcw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSessionStore } from "@/store";
import { cn } from "@/lib/utils";

type Key = {
  code: string;
  label: string;
  width?: string;
  spacer?: boolean;
  noCount?: boolean;
};

type KbSection = Key[][];
type KbLayout = { id: string; name: string; main: KbSection; nav?: KbSection; numpad?: KbSection };

const S = (width = "w-11"): Key => ({ code: "", label: "", spacer: true, width });

const LAYOUT_FULL: KbLayout = {
  id: "full",
  name: "Laptop Full-size",
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
      { code: "Backspace", label: "Bksp", width: "w-16", noCount: true },
    ],
    [
      { code: "Tab", label: "Tab", width: "w-14" },
      { code: "KeyQ", label: "Q" }, { code: "KeyW", label: "W" }, { code: "KeyE", label: "E" }, { code: "KeyR", label: "R" },
      { code: "KeyT", label: "T" }, { code: "KeyY", label: "Y" }, { code: "KeyU", label: "U" }, { code: "KeyI", label: "I" },
      { code: "KeyO", label: "O" }, { code: "KeyP", label: "P" }, { code: "BracketLeft", label: "[" }, { code: "BracketRight", label: "]" },
      { code: "Backslash", label: "\\", width: "w-12" },
    ],
    [
      { code: "CapsLock", label: "Caps", width: "w-16" },
      { code: "KeyA", label: "A" }, { code: "KeyS", label: "S" }, { code: "KeyD", label: "D" }, { code: "KeyF", label: "F" },
      { code: "KeyG", label: "G" }, { code: "KeyH", label: "H" }, { code: "KeyJ", label: "J" }, { code: "KeyK", label: "K" },
      { code: "KeyL", label: "L" }, { code: "Semicolon", label: ";" }, { code: "Quote", label: "'" },
      { code: "Enter", label: "Enter", width: "w-16" },
    ],
    [
      { code: "ShiftLeft", label: "Shift", width: "w-20" },
      { code: "KeyZ", label: "Z" }, { code: "KeyX", label: "X" }, { code: "KeyC", label: "C" }, { code: "KeyV", label: "V" },
      { code: "KeyB", label: "B" }, { code: "KeyN", label: "N" }, { code: "KeyM", label: "M" },
      { code: "Comma", label: "," }, { code: "Period", label: "." }, { code: "Slash", label: "/" },
      { code: "ShiftRight", label: "Shift", width: "w-20" },
    ],
    [
      { code: "ControlLeft", label: "Ctrl", width: "w-14" },
      { code: "MetaLeft", label: "Win", width: "w-12" },
      { code: "AltLeft", label: "Alt", width: "w-12" },
      { code: "Space", label: "Space", width: "flex-1 min-w-[180px]" },
      { code: "AltRight", label: "Alt", width: "w-12" },
      { code: "MetaRight", label: "Win", width: "w-12" },
      { code: "ContextMenu", label: "Menu", width: "w-12" },
      { code: "ControlRight", label: "Ctrl", width: "w-14" },
    ],
  ],
  nav: [
    [{ code: "PrintScreen", label: "PrtSc" }, { code: "ScrollLock", label: "ScrLk" }, { code: "Pause", label: "Pause" }],
    [{ code: "Insert", label: "Ins" }, { code: "Home", label: "Home" }, { code: "PageUp", label: "PgUp" }],
    [{ code: "Delete", label: "Del" }, { code: "End", label: "End" }, { code: "PageDown", label: "PgDn" }],
    [S(), S(), S()],
    [S(), { code: "ArrowUp", label: "Up" }, S()],
    [{ code: "ArrowLeft", label: "Left" }, { code: "ArrowDown", label: "Down" }, { code: "ArrowRight", label: "Right" }],
  ],
  numpad: [
    [S(), S(), S(), S()],
    [{ code: "NumLock", label: "Num" }, { code: "NumpadDivide", label: "/" }, { code: "NumpadMultiply", label: "*" }, { code: "NumpadSubtract", label: "-" }],
    [{ code: "Numpad7", label: "7" }, { code: "Numpad8", label: "8" }, { code: "Numpad9", label: "9" }, { code: "NumpadAdd", label: "+" }],
    [{ code: "Numpad4", label: "4" }, { code: "Numpad5", label: "5" }, { code: "Numpad6", label: "6" }, S()],
    [{ code: "Numpad1", label: "1" }, { code: "Numpad2", label: "2" }, { code: "Numpad3", label: "3" }, { code: "NumpadEnter", label: "Ent" }],
    [{ code: "Numpad0", label: "0", width: "w-[5.75rem]" }, { code: "NumpadDecimal", label: "." }, S()],
  ],
};

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

export function KeyboardTester() {
  const { upsertTest } = useSessionStore();
  const [pressed, setPressed] = React.useState<Set<string>>(new Set());
  const [active, setActive] = React.useState<Set<string>>(new Set());

  const layout = LAYOUT_FULL;
  const codes = React.useMemo(() => countableCodes(layout), []);
  const totalKeys = codes.length;
  const pressedCount = codes.filter((c) => pressed.has(c)).length;
  const percent = totalKeys === 0 ? 0 : Math.round((pressedCount / totalKeys) * 100);

  React.useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      // Don't preventDefault for ESC so user can leave fullscreen tests.
      if (e.key === "Escape") return;
      const code = e.code || e.key;
      setPressed((prev) => {
        if (prev.has(code)) return prev;
        const next = new Set(prev);
        next.add(code);
        return next;
      });
      setActive((prev) => {
        const next = new Set(prev);
        next.add(code);
        return next;
      });
    };
    const onUp = (e: KeyboardEvent) => {
      const code = e.code || e.key;
      setActive((prev) => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  const reset = () => {
    setPressed(new Set());
    setActive(new Set());
  };

  const handleFinish = () => {
    upsertTest({
      type: "keyboard",
      result: pressedCount === totalKeys ? "pass" : "fail",
      payload: {
        pressedCount,
        totalKeys,
        percent,
        missing: codes.filter((c) => !pressed.has(c)),
      },
      capturedAt: new Date().toISOString(),
    });
    toast.success(
      pressedCount === totalKeys
        ? "Hoàn thành — toàn bộ phím đã phản hồi"
        : `Đã lưu: ${pressedCount}/${totalKeys} phím`,
    );
  };

  const renderKey = (key: Key) => {
    if (key.spacer) {
      return <div key={`sp-${key.code}`} className={cn("h-11 shrink-0", key.width ?? "w-11")} />;
    }
    const isPressed = pressed.has(key.code);
    const isActive = active.has(key.code);
    let bg = "bg-white border-zinc-200 text-zinc-800";
    if (isPressed) bg = "bg-emerald-600 border-emerald-600 text-white";
    if (isActive) bg = "bg-zinc-800 border-zinc-800 text-white scale-95";
    return (
      <div
        key={key.code}
        className={cn(
          "flex h-11 shrink-0 items-center justify-center rounded-md border font-semibold shadow-sm transition-all",
          key.width ?? "w-11",
          key.noCount ? "text-[10px]" : "text-xs",
          bg,
        )}
      >
        {key.label}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test bàn phím</CardTitle>
        <CardDescription>
          Bấm từng phím trên bàn phím vật lý. Phím hoạt động tốt sẽ đổi màu xanh. Khi bấm đủ hãy nhấn "Hoàn thành".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-medium">
            Đã bấm: {pressedCount}/{totalKeys} ({percent}%)
          </div>
          <Progress value={percent} className="h-2 w-40" />
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="mr-1 h-4 w-4" /> Reset
          </Button>
          <Button size="sm" onClick={handleFinish}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> Hoàn thành
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/60 bg-zinc-50 p-3">
          <div className="mx-auto w-max">
            <div className="flex items-start gap-3">
              <div className="space-y-1.5">
                {layout.main.map((row, i) => (
                  <div key={`main-${i}`} className="flex justify-center gap-1.5">
                    {row.map(renderKey)}
                  </div>
                ))}
              </div>
              {layout.nav ? (
                <div className="space-y-1.5 pt-[3.375rem]">
                  {layout.nav.map((row, i) => (
                    <div key={`nav-${i}`} className="flex gap-1.5">
                      {row.map(renderKey)}
                    </div>
                  ))}
                </div>
              ) : null}
              {layout.numpad ? (
                <div className="space-y-1.5">
                  {layout.numpad.map((row, i) => (
                    <div key={`num-${i}`} className="flex gap-1.5">
                      {row.map(renderKey)}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <Legend color="bg-white border-zinc-200" label="Chưa bấm" />
          <Legend color="bg-zinc-800" label="Đang giữ" />
          <Legend color="bg-emerald-600" label="Đã kiểm tra" />
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("inline-block h-4 w-4 rounded border", color)} />
      <span>{label}</span>
    </div>
  );
}