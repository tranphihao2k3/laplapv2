"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  normalizePagePath,
  shouldSkipPagePath,
} from "@/lib/analytics/page-view";

const DEDUP_MS = 30_000;
const STORAGE_PREFIX = "pv:";

function recentlyTracked(path: string): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + path);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DEDUP_MS;
  } catch {
    return false;
  }
}

function markTracked(path: string) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + path, String(Date.now()));
  } catch {
    /* private mode / quota */
  }
}

function sendView(path: string) {
  const body = JSON.stringify({ path });
  const url = "/api/public/analytics/view";
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    /* fall through */
  }
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

/**
 * Gửi 1 page view mỗi lần đổi route trên storefront.
 * Dedup 30s/path trong tab để tránh double-count Strict Mode.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    const path = normalizePagePath(pathname);
    if (!path || shouldSkipPagePath(path)) return;
    if (lastSent.current === path && recentlyTracked(path)) return;
    if (recentlyTracked(path)) {
      lastSent.current = path;
      return;
    }
    lastSent.current = path;
    markTracked(path);
    sendView(path);
  }, [pathname]);

  return null;
}
