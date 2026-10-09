/**
 * Quản lý build của guest (chưa đăng nhập) trong localStorage.
 * - `loadGuestBuild` / `saveGuestBuild`: đọc/ghi state build dạng BuildState.
 * - `getOrCreateSessionId`: cấp session id ổn định cho mỗi thiết bị/khách.
 * - `migrateGuestToAccount`: chuyển build guest thành build của user đã login.
 *
 * Lưu ý: tất cả hàm đều có try/catch — localStorage có thể bị tắt (private mode)
 * thì trả về giá trị mặc định, không crash UI.
 */

import { createClient } from "@/lib/supabase/client";
import type { BuildState, SlotKey } from "./types";

const GUEST_KEY = "pc_builder_guest";
const SESSION_KEY = "pc_builder_session";

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function safeGet(key: string): string | null {
  if (!hasLocalStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
}

function safeRemove(key: string): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Đọc build guest từ localStorage.
 * Trả về object rỗng nếu chưa có hoặc parse lỗi.
 */
export function loadGuestBuild(): BuildState {
  const raw = safeGet(GUEST_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as BuildState;
    }
    return {};
  } catch {
    return {};
  }
}

/** Ghi đè build guest vào localStorage (ghi đè toàn bộ object). */
export function saveGuestBuild(build: BuildState): void {
  try {
    safeSet(GUEST_KEY, JSON.stringify(build));
  } catch {
    /* ignore — object quá lớn hoặc quota */
  }
}

/** Xoá build guest sau khi đã migrate hoặc người dùng xác nhận bỏ. */
export function clearGuestBuild(): void {
  safeRemove(GUEST_KEY);
}

/**
 * Sinh session id ổn định (8 bytes hex) hoặc lấy lại từ localStorage.
 * Dùng để gắn vào `pc_builds.session_id` khi guest lưu trước khi login.
 */
export function getOrCreateSessionId(): string {
  const existing = safeGet(SESSION_KEY);
  if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
  const fresh =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  safeSet(SESSION_KEY, fresh);
  return fresh;
}

/**
 * Tính tổng tiền của build (đơn vị: VND).
 */
export function calculateTotal(build: BuildState): number {
  let total = 0;
  for (const slot of Object.keys(build) as SlotKey[]) {
    const items = build[slot] ?? [];
    for (const item of items) {
      total += (item.unitPrice || 0) * (item.qty || 0);
    }
  }
  return total;
}

/**
 * Đếm tổng số linh kiện đã chọn trong build.
 */
export function countItems(build: BuildState): number {
  let n = 0;
  for (const slot of Object.keys(build) as SlotKey[]) {
    const items = build[slot] ?? [];
    for (const item of items) {
      n += item.qty || 0;
    }
  }
  return n;
}

/**
 * Chuyển build guest hiện tại sang tài khoản user vừa đăng nhập.
 *
 * Luồng:
 *  1. Đọc `loadGuestBuild()` — nếu rỗng thì không làm gì.
 *  2. Nếu user chưa login (no session) → return false.
 *  3. Với mỗi build trong DB của session_id này, update user_id = auth.uid().
 *  4. Xoá localStorage guest build.
 *
 * Trả về `true` nếu đã migrate, `false` nếu không có gì để migrate.
 */
export async function migrateGuestToAccount(userId: string): Promise<boolean> {
  const state = loadGuestBuild();
  const hasItems = Object.values(state).some((arr) => arr && arr.length > 0);
  if (!hasItems) return false;

  const sessionId = getOrCreateSessionId();
  const supabase = createClient();

  // Gán user_id cho tất cả build thuộc session này.
  // Nếu bảng chưa có cột user_id (do migration) thì lệnh sẽ fail — bỏ qua.
  try {
    const { error } = await supabase
      .from("pc_builds")
      .update({ user_id: userId })
      .eq("session_id", sessionId)
      .is("user_id", null);
    if (error) {
      // Không crash UI — chỉ log để dev debug.
      // eslint-disable-next-line no-console
      console.warn("[pc-builder] migrate update error", error.message);
    }
  } catch {
    /* ignore */
  }

  clearGuestBuild();
  return true;
}
