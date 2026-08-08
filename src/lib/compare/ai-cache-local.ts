/**
 * Lưu kết quả AI phân tích vào localStorage để F5 không mất.
 *
 * VÌ SAO CẦN dù server đã có cache: cache ở Supabase tiết kiệm quota Gemini,
 * nhưng mỗi lần F5 vẫn phải đi một vòng mạng. Lưu ở máy khách thì kết quả hiện
 * NGAY khi mở lại trang, không chờ gì cả.
 *
 * TTL ngắn (15 phút) chứ không dài như cache server (30 ngày): dữ liệu ở đây
 * nằm ngoài tầm kiểm soát, admin sửa giá hay thông số thì bản local vẫn cũ.
 * Hết 15 phút thì gọi lại — lúc đó cache server trả về gần như tức thì.
 *
 * KHÔNG dùng zustand/persist như compare-store: payload AI khá nặng và chỉ cần
 * ở đúng một trang, nhét vào store toàn cục sẽ tải kèm ở mọi trang khác.
 */

import type { CompareAiPayload } from "./types";

/** Đổi số này khi đổi shape payload → bản lưu cũ tự bị bỏ qua. */
const STORAGE_KEY = "laplap-compare-ai-v1";

/** Sống 15 phút. Đủ để F5/quay lại trang, đủ ngắn để không phục vụ dữ liệu ôi. */
export const LOCAL_TTL_MS = 15 * 60 * 1000;

/**
 * Giữ tối đa 5 bộ máy. Mỗi payload cỡ vài KB, không giới hạn thì người dùng so
 * qua lại chục bộ máy sẽ làm đầy quota localStorage và ném QuotaExceededError.
 */
const MAX_ENTRIES = 5;

type Entry = { data: CompareAiPayload; savedAt: number };
type Store = Record<string, Entry>;

/** Payload đúng hình dạng tối thiểu — chặn bản lưu hỏng do đổi schema. */
function isValidPayload(v: unknown): v is CompareAiPayload {
  if (!v || typeof v !== "object") return false;
  const p = v as CompareAiPayload;
  return Array.isArray(p.scores) && Array.isArray(p.machines) && p.scores.length > 0;
}

/**
 * Đọc cả store, bỏ các mục hỏng/hết hạn.
 *
 * localStorage có thể ném: chế độ riêng tư của Safari, người dùng chặn cookie,
 * hoặc JSON hỏng do phiên bản cũ. Mọi lỗi đều nuốt và coi như chưa có cache —
 * tính năng vẫn chạy, chỉ là phải gọi lại AI.
 */
function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || typeof parsed !== "object") return {};

    const now = Date.now();
    const out: Store = {};
    for (const [k, e] of Object.entries(parsed)) {
      if (!e || typeof e.savedAt !== "number") continue;
      if (now - e.savedAt >= LOCAL_TTL_MS) continue;
      if (!isValidPayload(e.data)) continue;
      out[k] = e;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Hết quota hoặc bị chặn ghi. Bỏ qua — mất cache local không phải lỗi chặn
    // người dùng, kết quả vẫn đang hiển thị trên màn hình.
  }
}

/** Kết quả đã lưu cho bộ máy này, kèm thời điểm lưu. null nếu chưa có/hết hạn. */
export function readLocalAi(key: string): { data: CompareAiPayload; savedAt: number } | null {
  return readStore()[key] ?? null;
}

export function writeLocalAi(key: string, data: CompareAiPayload): void {
  const store = readStore();
  store[key] = { data, savedAt: Date.now() };

  // Quá số mục cho phép → bỏ các bản CŨ NHẤT trước.
  const keys = Object.keys(store);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => store[b].savedAt - store[a].savedAt)
      .slice(MAX_ENTRIES)
      .forEach((k) => delete store[k]);
  }

  writeStore(store);
}

/** Xoá bản lưu của một bộ máy — dùng cho nút "Phân tích lại". */
export function clearLocalAi(key: string): void {
  const store = readStore();
  delete store[key];
  writeStore(store);
}

/** "3 phút trước" — cho biết kết quả đang xem cũ tới mức nào. */
export function formatSavedAgo(savedAt: number): string {
  const mins = Math.floor((Date.now() - savedAt) / 60_000);
  if (mins < 1) return "vừa xong";
  return `${mins} phút trước`;
}
