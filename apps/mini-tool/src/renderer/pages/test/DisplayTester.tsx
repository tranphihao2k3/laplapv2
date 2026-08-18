import * as React from "react";
import { X, Check } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/store";

type ColorKey = "R" | "G" | "B" | "W" | "K";
type ColorResult = "pass" | "fail" | null;
const COLORS: Record<ColorKey, { bg: string; label: string; description: string }> = {
  R: { bg: "bg-red-600", label: "Đỏ", description: "Tìm điểm chết màu xanh/vàng." },
  G: { bg: "bg-green-600", label: "Xanh lá", description: "Tìm điểm chết màu đỏ/xanh dương." },
  B: { bg: "bg-blue-600", label: "Xanh dương", description: "Tìm điểm chết màu đỏ/vàng." },
  W: { bg: "bg-white", label: "Trắng", description: "Phát hiện điểm tối hoặc line lạ." },
  K: { bg: "bg-black", label: "Đen", description: "Phát hiện điểm sáng (sub-pixel). Bấm ESC để thoát." },
};

const INITIAL_RESULTS: Record<ColorKey, ColorResult> = {
  R: null,
  G: null,
  B: null,
  W: null,
  K: null,
};

export function DisplayTester() {
  const { upsertTest } = useSessionStore();
  const [active, setActive] = React.useState<ColorKey | null>(null);
  const [results, setResults] = React.useState<Record<ColorKey, ColorResult>>(
    INITIAL_RESULTS,
  );

  React.useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActive(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const record = (key: ColorKey, result: "pass" | "fail") => {
    setResults((r) => ({ ...r, [key]: result }));
    upsertTest({
      type: "display",
      result,
      payload: { color: key, label: COLORS[key].label },
      capturedAt: new Date().toISOString(),
    });
    toast[result === "pass" ? "success" : "error"](
      `${COLORS[key].label}: ${result === "pass" ? "Màn hình OK" : "Có dead pixel"}`,
    );
  };

  const fillColor = active
    ? {
        R: "#dc2626",
        G: "#16a34a",
        B: "#2563eb",
        W: "#ffffff",
        K: "#000000",
      }[active]
    : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Test màn hình (dead pixel / màu)</CardTitle>
          <CardDescription>
            Bấm vào từng màu để phủ toàn màn hình. Quan sát kỹ rồi đánh dấu Có dead pixel hoặc Màn hình OK.
            Bấm ESC để thoát chế độ toàn màn hình.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.keys(COLORS) as ColorKey[]).map((key) => {
              const color = COLORS[key];
              return (
                <div
                  key={key}
                  className="flex flex-col items-stretch gap-2 rounded-lg border border-border/60 bg-card/40 p-3"
                >
                  <button
                    type="button"
                    onClick={() => setActive(key)}
                    className={`h-16 w-full rounded-md ${color.bg} text-xs font-semibold ${
                      key === "W" ? "text-black" : "text-white"
                    }`}
                  >
                    {color.label}
                  </button>
                  <p className="text-[10px] leading-tight text-muted-foreground">
                    {color.description}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={results[key] === "pass" ? "default" : "outline"}
                      className="flex-1 text-emerald-500"
                      onClick={() => record(key, "pass")}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant={results[key] === "fail" ? "destructive" : "outline"}
                      className="flex-1"
                      onClick={() => record(key, "fail")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {active && fillColor ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActive(null)}
          style={{ background: fillColor, position: "fixed", inset: 0, zIndex: 9999, cursor: "pointer" }}
        />
      ) : null}
    </>
  );
}