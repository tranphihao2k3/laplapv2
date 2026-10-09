// dashboardCache.ts — Centralized loader + cache cho các info-block mới trên
// Dashboard: Battery, Display, System Info, Storage, WiFi profiles, HD Sentinel.
//
// Pattern lấy cảm hứng từ `hardwareCache.ts`:
//   • Promise cache (dedup) cho mỗi resource — nếu 2 component cùng gọi sẽ
//     share 1 IPC round-trip.
//   • Re-fetch helper có TTL ngắn (5-15s) cho các field cần freshness
//     (battery, wifi signal). Static info (system, display) có TTL dài hơn.
//   • Hỗ trợ `invalidate(key)` để Dashboard refresh từng card riêng nếu cần.
//
// Các lệnh gọi đều an toàn khi window.lap.dashboard.* chưa có (dev/HMR).

import type {
  BatterySnapshot,
  DisplaySnapshot,
  SystemInfoSnapshot,
  StorageDisk,
  WifiSnapshot,
  HdSentinelFindResult,
} from "@/types/window";

type ResourceKey =
  | "battery"
  | "display"
  | "system"
  | "storage"
  | "wifi"
  | "hdSentinel";

interface ResourceEntry<T> {
  fetchedAt: number;
  data: T;
}

const TTL_MS: Record<ResourceKey, number> = {
  battery: 8_000,      // Pin có thể đổi nhanh (charging) → refresh thường xuyên
  display: 30_000,      // Display thay đổi hiếm
  system: 60_000,       // Mainboard / OS rất hiếm khi đổi
  storage: 30_000,      // Disks có thể thay đổi khi plug USB
  wifi: 15_000,         // WiFi signal cần tương đối fresh
  hdSentinel: 60_000,   // Probe app có cài hay không — gần như không đổi
};

const cache = new Map<ResourceKey, ResourceEntry<unknown>>();
const inflight = new Map<ResourceKey, Promise<unknown>>();

async function fetchResource<K extends ResourceKey, T>(
  key: K,
  fetcher: () => Promise<T>,
): Promise<T> {
  // Có cache + còn fresh → trả ngay
  const existing = cache.get(key) as ResourceEntry<T> | undefined;
  if (existing && Date.now() - existing.fetchedAt < TTL_MS[key]) {
    return existing.data;
  }

  // Đang fetch rồi → share promise
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = (async () => {
    try {
      const data = await fetcher();
      cache.set(key, { fetchedAt: Date.now(), data });
      return data;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/**
 * Luôn luôn fetch mới (force), bỏ qua cache. Vẫn dedup nếu nhiều caller cùng
 * lúc gọi force — kết quả chỉ lưu 1 lần.
 */
async function refresh<K extends ResourceKey, T>(
  key: K,
  fetcher: () => Promise<T>,
): Promise<T> {
  cache.delete(key);
  return fetchResource(key, fetcher);
}

export function invalidateDashboardCache(key?: ResourceKey): void {
  if (key) {
    cache.delete(key);
    return;
  }
  cache.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback values when IPC fails (graceful degradation).
// ─────────────────────────────────────────────────────────────────────────────

export const EMPTY_BATTERY: BatterySnapshot = {
  hasBattery: false,
  name: null,
  percent: null,
  status: null,
  minutesRemaining: null,
  currentDrawMw: null,
  voltageMv: null,
  chemistry: null,
  designCapacityMwh: null,
  fullChargeCapacityMwh: null,
  healthPct: null,
};

export const EMPTY_DISPLAY: DisplaySnapshot = { monitors: [] };

export const EMPTY_SYSTEM: SystemInfoSnapshot = {
  mainboard: { manufacturer: null, product: null, serial: null, version: null },
  bios: { manufacturer: null, version: null, releaseDate: null, smbiosVersion: null },
  machine: { manufacturer: null, model: null, systemType: null, totalPhysicalMemoryGB: null, status: null },
  os: { caption: null, version: null, build: null, arch: null, hostname: null, installDate: null, lastBootTime: null },
  capturedAt: new Date().toISOString(),
};

export const EMPTY_HD_SENTINEL: HdSentinelFindResult = {
  found: false,
  path: null,
  version: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Public loaders
// ─────────────────────────────────────────────────────────────────────────────

export function loadBattery(opts: { force?: boolean } = {}): Promise<BatterySnapshot> {
  const fn = async (): Promise<BatterySnapshot> => {
    if (!window.lap?.dashboard) return EMPTY_BATTERY;
    const r = await window.lap.dashboard.battery();
    return r.ok && r.data ? r.data : EMPTY_BATTERY;
  };
  return opts.force ? refresh("battery", fn) : fetchResource("battery", fn);
}

export function loadDisplay(opts: { force?: boolean } = {}): Promise<DisplaySnapshot> {
  const fn = async (): Promise<DisplaySnapshot> => {
    if (!window.lap?.dashboard) return EMPTY_DISPLAY;
    const r = await window.lap.dashboard.display();
    return r.ok && r.data ? r.data : EMPTY_DISPLAY;
  };
  return opts.force ? refresh("display", fn) : fetchResource("display", fn);
}

export function loadSystemInfo(opts: { force?: boolean } = {}): Promise<SystemInfoSnapshot> {
  const fn = async (): Promise<SystemInfoSnapshot> => {
    if (!window.lap?.dashboard) return EMPTY_SYSTEM;
    const r = await window.lap.dashboard.system();
    return r.ok && r.data ? r.data : EMPTY_SYSTEM;
  };
  return opts.force ? refresh("system", fn) : fetchResource("system", fn);
}

export function loadStorageDetail(opts: { force?: boolean } = {}): Promise<StorageDisk[]> {
  const fn = async (): Promise<StorageDisk[]> => {
    if (!window.lap?.dashboard) return [];
    const r = await window.lap.dashboard.storage();
    return r.ok && r.data ? r.data : [];
  };
  return opts.force ? refresh("storage", fn) : fetchResource("storage", fn);
}

export function loadWifiProfiles(opts: { force?: boolean } = {}): Promise<WifiSnapshot> {
  const fn = async (): Promise<WifiSnapshot> => {
    if (!window.lap?.dashboard) return { currentInterface: null, profiles: [] };
    const r = await window.lap.dashboard.wifiProfiles();
    return r.ok && r.data ? r.data : { currentInterface: null, profiles: [] };
  };
  return opts.force ? refresh("wifi", fn) : fetchResource("wifi", fn);
}

export function loadHdSentinel(opts: { force?: boolean } = {}): Promise<HdSentinelFindResult> {
  const fn = async (): Promise<HdSentinelFindResult> => {
    if (!window.lap?.dashboard) return EMPTY_HD_SENTINEL;
    const r = await window.lap.dashboard.hdSentinel.find();
    return r.ok && r.data ? r.data : EMPTY_HD_SENTINEL;
  };
  return opts.force ? refresh("hdSentinel", fn) : fetchResource("hdSentinel", fn);
}

export async function launchHdSentinel(exePath: string): Promise<boolean> {
  try {
    const r = await window.lap.dashboard.hdSentinel.launch(exePath);
    return Boolean(r?.ok);
  } catch {
    return false;
  }
}
