// TouchpadTester.tsx — Test touchpad (mouse) functionality
import * as React from "react";
import { MousePointer, Move, MousePointerClick, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSessionStore } from "@/store";
import { cn } from "@/lib/utils";

type TestPhase = "idle" | "move" | "click" | "scroll" | "done";

export function TouchpadTester() {
  const { upsertTest } = useSessionStore();
  const [phase, setPhase] = React.useState<TestPhase>("idle");
  const [moveCount, setMoveCount] = React.useState(0);
  const [clickCount, setClickCount] = React.useState(0);
  const [scrollCount, setScrollCount] = React.useState(0);
  const [result, setResult] = React.useState<"pass" | "fail" | null>(null);

  const handleReset = () => {
    setPhase("idle");
      setMoveCount(0);
      setClickCount(0);
      setScrollCount(0);
    setResult(null);
  };

  const handleNextPhase = () => {
    if (phase === "idle") setPhase("move");
    else if (phase === "move") setPhase("click");
    else if (phase === "click") setPhase("scroll");
    else if (phase === "scroll") setPhase("done");
  };

  const recordResult = (verdict: "pass" | "fail") => {
    setResult(verdict);
    upsertTest({
      type: "touchpad",
      result: verdict,
      payload: {
        moveCount,
        clickCount,
        phasesCompleted: phase === "done" ? ["move", "click", "scroll"] : [],
      },
      capturedAt: new Date().toISOString(),
    });
    toast[verdict === "pass" ? "success" : "error"](
      verdict === "pass" ? "Touchpad OK" : "Touchpad co van de",
    );
  };

  const PHASE_CONFIG: Record<TestPhase, {
    title: string;
    description: string;
    icon: React.ReactNode;
    instruction: string;
    color: string;
  }> = {
    idle: {
      title: "Bat dau test Touchpad",
      description: "Nhan Nut Bat Dau de kiem tra touchpad.",
      icon: <MousePointer className="h-6 w-6" />,
      instruction: "Di chuyen, click, va cuon tren touchpad de test.",
      color: "text-muted-foreground",
    },
    move: {
      title: "Test di chuyen",
      description: "Di chuyen con tro chuot nhieu lan.",
      icon: <Move className="h-6 w-6" />,
      instruction: `Di chuyen touchpad (${moveCount}/10 lan)`,
      color: "text-sky-400",
    },
    click: {
      title: "Test click",
      description: "Click trai va click phai tren touchpad.",
      icon: <MousePointerClick className="h-6 w-6" />,
      instruction: `Click touchpad (${clickCount}/5 lan)`,
      color: "text-emerald-400",
    },
    scroll: {
      title: "Test cuon",
      description: "Cuon 2 ngon tay tren touchpad.",
      icon: <RotateCcw className="h-6 w-6" />,
      instruction: "Cuon 2 ngon tay tren touchpad",
      color: "text-amber-400",
    },
    done: {
      title: "Hoan tat",
      description: "Test touchpad hoan tat.",
      icon: <CheckCircle2 className="h-6 w-6" />,
      instruction: "Da hoan tat test touchpad.",
      color: "text-emerald-500",
    },
  };

  const cfg = PHASE_CONFIG[phase];
  const allDone = moveCount >= 10 && clickCount >= 5;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MousePointer className="h-5 w-5" /> Test Touchpad
        </CardTitle>
        <CardDescription>
          Test di chuyen, click trai/phai, va cuon tren touchpad.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phase indicator */}
        <div className={cn(
          "flex items-center gap-4 rounded-xl border-2 border-dashed p-6 text-center",
          phase === "idle" ? "border-border" :
          phase === "move" ? "border-sky-500/40 bg-sky-500/5" :
          phase === "click" ? "border-emerald-500/40 bg-emerald-500/5" :
          phase === "scroll" ? "border-amber-500/40 bg-amber-500/5" :
          "border-emerald-500/40 bg-emerald-500/5"
        )}>
          <div className={cn("mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted/50", cfg.color)}>
            {cfg.icon}
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold">{cfg.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{cfg.description}</p>
            <p className="mt-2 text-xs font-medium">{cfg.instruction}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 rounded-lg border border-border/40 bg-muted/20 p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{moveCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Di chuyen</p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-sky-500 transition-all duration-300"
                style={{ width: Math.min(100, (moveCount / 10) * 100) + '%' }}
              />
            </div>
          </div>
          <div className="space-y-1 rounded-lg border border-border/40 bg-muted/20 p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{clickCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Click</p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: Math.min(100, (clickCount / 5) * 100) + '%' }}
              />
            </div>
          </div>
        </div>

        {/* Manual test area */}
        {phase !== "done" && (
          <div
            className="flex min-h-[120px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground transition-colors hover:border-primary/40"
            onClick={() => {
              if (phase === "move") setMoveCount((n) => Math.min(10, n + 1));
              if (phase === "click") setClickCount((n) => Math.min(5, n + 1));
            }}
          >
            {phase === "move"
              ? "Di chuyen chuot tren day (click de dem)"
              : phase === "click"
                ? "Click tren day de dem"
                : "Click next de tiep tuc"}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={phase === "idle"}
          >
            <RotateCcw className="mr-1 h-4 w-4" /> Reset
          </Button>

          {phase !== "idle" && phase !== "done" && (
            <Button
              onClick={handleNextPhase}
              disabled={phase === "move" && moveCount < 3}
            >
              Tiep tuc
            </Button>
          )}

          {phase === "done" || allDone ? (
            <>
              <Button variant="outline" className="text-emerald-500" onClick={() => recordResult("pass")}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Touchpad OK
              </Button>
              <Button variant="outline" className="text-destructive" onClick={() => recordResult("fail")}>
                <XCircle className="mr-1 h-4 w-4" /> Co van de
              </Button>
            </>
          ) : null}

          {result && (
            <Badge variant={result === "pass" ? "secondary" : "destructive"}>
              {result === "pass" ? "Touchpad OK" : "Co loi"}
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Hoac ban co the su dung chuot vat ly de test. Nhan Reset de bat dau lai.
        </p>
      </CardContent>
    </Card>
  );
}
