/**
 * Brand cache invalidation — khi admin lưu settings, các tab đang mở cần
 * refresh lại store-info. Dùng:
 *   1. localStorage event (cross-tab)
 *   2. Custom event (same-tab) — useStoreSettings sẽ re-fetch
 *   3. Gọi trực tiếp từ admin settings page sau khi PATCH/POST settings
 */
import { CACHE_KEY } from "./cache-constants";

const BRAND_CHANGED_EVENT = "brand-cache-changed";
const STORAGE_EVENT_KEY = "brand-cache-invalidation";

export function invalidateBrandCache(): void {
  if (typeof window === "undefined") return;
  // Same-tab notify
  window.dispatchEvent(new CustomEvent(BRAND_CHANGED_EVENT));
  // Cross-tab notify
  try {
    // bump một giá trị duy nhất để trigger 'storage' event ở tab khác
    const prev = window.localStorage.getItem(STORAGE_EVENT_KEY);
    window.localStorage.setItem(
      STORAGE_EVENT_KEY,
      `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    );
    // (nếu cần restore) — không cần, key này chỉ dùng để fire storage event
    void prev;
  } catch {
    // ignore
  }
}

export function clearStoreSettingsCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

/** Subscribe tới brand cache invalidation (same-tab + cross-tab). */
export function onBrandCacheInvalidated(handler: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onCustom = () => handler();
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_EVENT_KEY) handler();
  };
  window.addEventListener(BRAND_CHANGED_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(BRAND_CHANGED_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
