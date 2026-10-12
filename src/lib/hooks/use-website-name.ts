/**
 * useWebsiteName — lưu tên website vào localStorage + fallback env.
 *
 * Quy ước:
 *  - SSG/SSR: đọc từ env (NEXT_PUBLIC_APP_NAME) trong server components.
 *  - Client: đọc từ localStorage("laplap.website.name") với fallback
 *    từ useBrandName() (settings table cache) → cuối cùng là "LapLap".
 *
 * Cho phép admin/customer set nhanh tên hiển thị trong 1 phiên (vd đang test
 * brand mới) mà không cần đợi settings sync từ server.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useBrandName } from "@/lib/hooks/use-brand";

const STORAGE_KEY = "laplap.website.name";

export function getStoredWebsiteName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredWebsiteName(name: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // ignore quota / privacy mode
  }
}

export function clearStoredWebsiteName() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Hook trả về tên website hiện tại và setter.
 * Ưu tiên:
 *  1. localStorage (nếu có)
 *  2. brand từ settings table (useBrandName)
 *  3. fallback cuối cùng "LapLap"
 */
export function useWebsiteName() {
  const brand = useBrandName();
  const [stored, setStored] = useState<string | null>(null);

  useEffect(() => {
    setStored(getStoredWebsiteName());
    // Listen cho custom event để đồng bộ giữa các tab/component
    const onUpdate = (e: Event) => {
      const v = (e as CustomEvent<string | null>).detail;
      setStored(v);
    };
    window.addEventListener("laplap.website.name:update", onUpdate);
    return () => window.removeEventListener("laplap.website.name:update", onUpdate);
  }, []);

  const value = stored ?? brand;

  const update = useCallback((name: string) => {
    setStoredWebsiteName(name);
    setStored(name);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<string>("laplap.website.name:update", { detail: name }),
      );
    }
  }, []);

  const clear = useCallback(() => {
    clearStoredWebsiteName();
    setStored(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<string | null>("laplap.website.name:update", { detail: null }),
      );
    }
  }, []);

  return { name: value, set: update, clear };
}
