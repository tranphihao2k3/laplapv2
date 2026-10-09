/**
 * Mã hoá/giải mã BuildState thành slug URL-safe (client-only, base64 + URL-safe).
 *
 * Đây là cơ chế chia sẻ NHẸ — không lưu DB. Dùng khi user muốn gửi nhanh link cho bạn bè.
 * Link đầy đủ với share_slug lưu trong DB vẫn là cách chính — hàm này chỉ là phương án
 * "encode state vào URL" khi chưa muốn save.
 */

import type { BuildState, SlotKey } from "./types";

const URL_SAFE = { "+": "-", "/": "_", "=": "" } as const;

/** Mã hoá BuildState → base64url string (compact). */
export function encodeBuildToSlug(state: BuildState): string {
  // JSON với replacer để giữ cấu trúc nhỏ gọn.
  const json = JSON.stringify(state);
  if (typeof window === "undefined") {
    // SSR: dùng Buffer nếu có (Node). Ở đây ta không cần encode trên server, throw để gợi nhớ.
    throw new Error("encodeBuildToSlug chỉ chạy trên client.");
  }
  // utf-8 safe base64
  const utf8 = unescape(encodeURIComponent(json));
  const b64 = window.btoa(utf8);
  return b64.replace(/[+/=]/g, (c) => URL_SAFE[c as "+" | "/" | "="] ?? "");
}

/** Giải mã base64url → BuildState. Trả về null nếu không hợp lệ. */
export function decodeBuildFromSlug(slug: string): BuildState | null {
  if (!slug || typeof slug !== "string") return null;
  try {
    const b64 = slug.replace(/[-_]/g, (c) => (c === "-" ? "+" : "/"));
    const utf8 = window.atob(b64);
    const json = decodeURIComponent(escape(utf8));
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    // Validate sơ bộ: mỗi key phải thuộc SlotKey
    const validSlots: ReadonlyArray<SlotKey> = [
      "cpu",
      "mainboard",
      "ram",
      "gpu",
      "ssd",
      "hdd",
      "psu",
      "case",
      "cooler",
      "monitor",
      "keyboard",
      "mouse",
      "headset",
    ];
    const out: BuildState = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!validSlots.includes(k as SlotKey)) continue;
      if (Array.isArray(v)) {
        out[k as SlotKey] = v as BuildState[SlotKey];
      }
    }
    return out;
  } catch {
    return null;
  }
}
