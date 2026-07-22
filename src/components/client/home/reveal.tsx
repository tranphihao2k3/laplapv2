"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

type RevealVariant =
  | "fade-up"
  | "fade-left"
  | "fade-right"
  | "scale-up"
  | "clip-up"
  | "flip-x"
  | "slide-split";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  variant?: RevealVariant;
  threshold?: number;
}

const INITIAL_STYLES: Record<RevealVariant, React.CSSProperties> = {
  "fade-up": { opacity: 0, transform: "translateY(48px)" },
  "fade-left": { opacity: 0, transform: "translateX(-48px)" },
  "fade-right": { opacity: 0, transform: "translateX(48px)" },
  "scale-up": { opacity: 0, transform: "scale(0.88)" },
  "clip-up": { clipPath: "inset(0 0 100% 0)", opacity: 0 },
  "flip-x": { opacity: 0, transform: "perspective(800px) rotateX(20deg)" },
  "slide-split": { opacity: 0, transform: "translateY(60px) skewY(4deg)" },
};

const VISIBLE_STYLES: Record<RevealVariant, React.CSSProperties> = {
  "fade-up": { opacity: 1, transform: "translateY(0)" },
  "fade-left": { opacity: 1, transform: "translateX(0)" },
  "fade-right": { opacity: 1, transform: "translateX(0)" },
  "scale-up": { opacity: 1, transform: "scale(1)" },
  "clip-up": { clipPath: "inset(0 0 0% 0)", opacity: 1 },
  "flip-x": { opacity: 1, transform: "perspective(800px) rotateX(0deg)" },
  "slide-split": { opacity: 1, transform: "translateY(0) skewY(0deg)" },
};

export function Reveal({
  children,
  className,
  delay = 0,
  duration = 700,
  variant = "fade-up",
  threshold = 0.1,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={cn("will-change-transform", className)}
      style={{
        ...(visible ? VISIBLE_STYLES[variant] : INITIAL_STYLES[variant]),
        transition: `opacity ${duration}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform ${duration}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, clip-path ${duration}ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
