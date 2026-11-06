/**
 * Trích "cấu hình nhanh" (CPU / RAM / SSD / VGA / Màn hình) từ specs của variant.
 *
 * specs lưu ở product_variants.specs (jsonb, key tự do) nên tập key không nhất
 * quán giữa các sản phẩm ("display" vs "screen" vs "man_hinh", "gpu" vs "vga"...).
 * Ta TÁI SỬ DỤNG registry của trang /so-sanh (src/lib/compare/spec-registry.ts) —
 * nơi đã gom sẵn alias theo thứ tự ưu tiên — để mọi chỗ hiển thị đều đọc
 * cùng một nguồn sự thật, không hardcode lại danh sách key ở nhiều nơi.
 *
 * Module này thuần logic (không import React/lucide) nên dùng được cho cả
 * API route lẫn component client.
 */

import { METRIC_BY_ID, rawValueOf } from "@/lib/compare/spec-registry";

export type QuickSpec = {
  /** Canonical id: cpu | ram | storage | gpu | display */
  id: string;
  /** Nhãn hiển thị ngắn gọn. */
  label: string;
  /** Giá trị đã cắt ngắn để vừa 1–2 dòng trên mobile. */
  value: string;
  /** Giá trị gốc (chưa cắt) — dùng cho title/tooltip. */
  raw: string;
};

/**
 * Thứ tự hiển thị + nhãn. Chỉ lấy 5 mục quan trọng nhất cho POS.
 * "storage" lấy từ metric ổ cứng (key "ssd" / "storage") nhưng hiển thị là "SSD".
 */
const QUICK_SPEC_META: Array<{ id: string; label: string }> = [
  { id: "cpu", label: "CPU" },
  { id: "ram", label: "RAM" },
  { id: "storage", label: "SSD" },
  { id: "gpu", label: "VGA" },
  { id: "display", label: "Màn hình" },
];

/** Cắt ngắn giá trị để không vỡ layout trên màn hình hẹp. */
export function truncateSpecValue(value: string, maxLength = 24): string {
  const v = value.trim();
  if (v.length <= maxLength) return v;
  return v.slice(0, maxLength - 1).trimEnd() + "…";
}

/**
 * Gộp 2 nguồn jsonb của variant: `specs` (cấu hình) và `attributes` (thuộc tính).
 * `specs` được ưu tiên khi cùng một key xuất hiện ở cả hai.
 */
export function mergeSpecSources(
  specs: Record<string, unknown> | null | undefined,
  attributes?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  const a = attributes && typeof attributes === "object" ? attributes : null;
  const s = specs && typeof specs === "object" ? specs : null;
  if (!a) return s;
  if (!s) return a;
  return { ...a, ...s };
}

/**
 * Lấy cấu hình nhanh từ specs. Bỏ qua mục không có giá trị.
 * @param specs specs của variant/product (jsonb đã ép về Record<string, string>)
 */
export function extractQuickSpecs(
  specs: Record<string, unknown> | null | undefined,
  maxLength = 24,
): QuickSpec[] {
  if (!specs || typeof specs !== "object") return [];
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(specs)) {
    if (typeof v === "string" && v.trim()) flat[k] = v.trim();
  }
  if (Object.keys(flat).length === 0) return [];

  const out: QuickSpec[] = [];
  for (const meta of QUICK_SPEC_META) {
    const metric = METRIC_BY_ID.get(meta.id);
    if (!metric) continue;
    const raw = rawValueOf(metric, flat);
    if (!raw) continue;
    out.push({ id: meta.id, label: meta.label, value: truncateSpecValue(raw, maxLength), raw });
  }
  return out;
}
