// hardwareCache.ts — singleton cache chia sẻ giữa Dashboard và trang Phần cứng.
//
// Mục tiêu:
// 1. Tránh gọi scan 2 lần khi user mở Dashboard rồi mở Phần cứng.
// 2. Dedup: nếu nhiều component cùng gọi `getHardware()` cùng lúc → chỉ chạy
//    một PowerShell scan, mọi caller share cùng một Promise.
// 3. Subscribe pattern: component đăng ký listener để nhận data mới khi mỗi
//    part stream về (không cần tự subscribe IPC).
// 4. Module-level state sống cùng vòng đời renderer → cache còn qua các lần
//    remount do Radix `TabsContent` unmount không active.
//
// Cache "nóng" được khởi tạo từ `primeHardwareCache()` (gọi 1 lần từ
// `SessionStoreProvider`) lấy dữ liệu đã persist trong localStorage.

import type { CollectedHardware, HardwarePart } from "@/types/window";

export type ScanMode = "fast" | "full";

export type HardwareListener = (
  snapshot: CollectedHardware,
  mode: ScanMode | null,
  inFlight: boolean,
) => void;

const EMPTY_SNAPSHOT: CollectedHardware = {
  cpu: null,
  memory: null,
  disks: [],
  gpu: [],
  mainboard: null,
  bios: null,
  battery: null,
  os: null,
  network: [],
  collectedAt: "",
  source: "pending",
};

let snapshot: CollectedHardware = EMPTY_SNAPSHOT;
let inFlight = false;
let inFlightMode: ScanMode | null = null;
let pending: Promise<CollectedHardware> | null = null;
let activeUnsub: (() => void) | null = null;

const listeners = new Set<HardwareListener>();

function emit(): void {
  for (const l of listeners) {
    l(snapshot, inFlightMode, inFlight);
  }
}

function applyPart(key: string, data: unknown): void {
  // PowerShell ConvertTo-Json có thể trả array / object lẻ / {value:[...]} tùy
  // số phần tử. Normalize về array cho các field disks/gpu/network.
  let normalized = data;
  if (key === "disks" || key === "gpu" || key === "network") {
    const d = data as { value?: unknown } | unknown[] | null;
    if (Array.isArray(d)) {
      normalized = d;
    } else if (d && typeof d === "object" && Array.isArray((d as { value?: unknown }).value)) {
      normalized = (d as { value: unknown[] }).value;
    } else if (d && typeof d === "object") {
      normalized = [d];
    } else {
      normalized = [];
    }
  }
  (snapshot as unknown as Record<string, unknown>)[key] = normalized;
}

function resetSnapshot(): void {
  snapshot = {
    cpu: null,
    memory: null,
    disks: [],
    gpu: [],
    mainboard: null,
    bios: null,
    battery: null,
    os: null,
    network: [],
    collectedAt: "",
    source: "pending",
  };
}

function killActiveStream(): void {
  if (activeUnsub) {
    try {
      activeUnsub();
    } catch {
      /* ignore */
    }
    activeUnsub = null;
  }
  // Yêu cầu main process hủy PowerShell child nếu còn chạy.
  void window.lap.hardware.cancel().catch(() => undefined);
  inFlight = false;
  inFlightMode = null;
  pending = null;
}

function startScan(mode: ScanMode): Promise<CollectedHardware> {
  inFlight = true;
  inFlightMode = mode;
  emit();

  return new Promise<CollectedHardware>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      killActiveStream();
      snapshot = {
        ...snapshot,
        collectedAt: new Date().toISOString(),
        source: mode === "fast" ? "powershell-fast" : "powershell-enhanced",
      };
      emit();
      resolve(snapshot);
    };

    activeUnsub = window.lap.hardware.onPart((part: HardwarePart) => {
      if (part.key === "__done__") {
        finish();
        return;
      }
      if (part.key === "__error__") {
        // Partial data vẫn hữu ích; coi như kết thúc để caller đọc được.
        finish();
        return;
      }
      if (!part.ok) return;
      applyPart(part.key, (part as { data: unknown }).data);
      emit();
    });

    const starter =
      mode === "fast"
        ? window.lap.hardware.fastCollect()
        : window.lap.hardware.collect();

    starter
      .then((res) => {
        if (!res.ok) {
          console.warn(`[hardwareCache] ${mode} scan failed to start:`, res.error);
          if (mode === "full") {
            // Fallback về fast nếu full không start được.
            window.lap.hardware
              .fastCollect()
              .then((r) => {
                if (!r.ok) finish();
              })
              .catch(() => finish());
          } else {
            finish();
          }
        }
      })
      .catch((e) => {
        console.error("[hardwareCache] start threw:", e);
        finish();
      });
  });
}

export interface GetHardwareOptions {
  /** Bỏ qua cache, buộc scan lại. Mặc định `false`. */
  force?: boolean;
  /** Chọn loại scan. Mặc định `"fast"` (~2-3s, parallel PowerShell jobs). */
  mode?: ScanMode;
}

/**
 * Lấy hardware data. Trả về cache nếu đã có; nếu không → bắt đầu scan.
 * Caller có thể `await` để chờ data về, hoặc `subscribeHardware()` để nhận
 * từng phần stream realtime.
 */
export function getHardware(opts: GetHardwareOptions = {}): Promise<CollectedHardware> {
  const { force = false, mode = "fast" } = opts;

  // Cùng một scan đang chạy → chia sẻ promise.
  if (!force && pending) return pending;

  // Có cache và không ép rescan → trả thẳng.
  if (!force && snapshot && (snapshot.cpu || snapshot.memory || snapshot.disks.length > 0 || snapshot.gpu.length > 0)) {
    return Promise.resolve(snapshot);
  }

  if (force) {
    killActiveStream();
    resetSnapshot();
    emit();
  }

  pending = startScan(mode);
  return pending;
}

/** Đọc cache hiện tại (không trigger scan). */
export function getCachedHardware(): CollectedHardware {
  return snapshot;
}

/** Có đang scan không? */
export function isHardwareCollecting(): boolean {
  return inFlight;
}

/**
 * Subscribe lắng nghe cập nhật. Listener được gọi NGAY với state hiện tại,
 * sau đó gọi mỗi khi có part mới về hoặc trạng thái in-flight đổi.
 * Trả về hàm cleanup để unsubscribe.
 */
export function subscribeHardware(listener: HardwareListener): () => void {
  listeners.add(listener);
  // Phát snapshot hiện tại ngay để caller không cần tự poll.
  listener(snapshot, inFlightMode, inFlight);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Seed cache từ dữ liệu đã persist (localStorage). Gọi 1 lần lúc mount app.
 * Bỏ qua nếu input rỗng hoặc không có field nào "có dữ liệu".
 */
export function primeHardwareCache(initial: CollectedHardware | null | undefined): void {
  if (!initial) return;
  const hasAny =
    initial.cpu ||
    initial.memory ||
    initial.disks.length > 0 ||
    initial.gpu.length > 0 ||
    initial.mainboard ||
    initial.bios ||
    initial.battery ||
    initial.os ||
    initial.network.length > 0;
  if (!hasAny) return;
  snapshot = initial;
  emit();
}
