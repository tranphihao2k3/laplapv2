"use client";

import { useEffect, useState } from "react";

/**
 * Top-of-page scroll progress bar — dải mỏng chạy theo % cuộn.
 * Hiển thị gradient primary → fuchsia → orange.
 */
export function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      const h = document.documentElement;
      const scrolled = h.scrollTop;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (scrolled / max) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, pct)));
      setVisible(scrolled > 80);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, []);

  return (
    <div
      className={`pointer-events-none fixed left-0 right-0 top-0 z-50 h-[3px] origin-left bg-gradient-to-r from-primary via-fuchsia-500 to-orange-500 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ transform: `scaleX(${progress / 100})` }}
      aria-hidden
    />
  );
}
