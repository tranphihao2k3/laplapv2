/**
 * Helper áp dụng object `filters` vào Supabase PostgrestFilterBuilder.
 *
 * Hỗ trợ các operator suffix (rất giống Django ORM):
 * - `__in`     → `.in(col, csv)`  – match 1 trong nhiều giá trị (vd category_id__in=id1,id2,id3)
 * - `__neq`    → `.neq(col, v)`
 * - `__gt`     → `.gt(col, v)`
 * - `__gte`    → `.gte(col, v)`
 * - `__lt`     → `.lt(col, v)`
 * - `__lte`    → `.lte(col, v)`
 * - `__ilike`  → `.ilike(col, v)` (cho full-text đơn giản)
 *
 * Không có suffix → `.eq(col, v)` (mặc định).
 *
 * Trả về cùng builder để chain tiếp.
 *
 * Lưu ý: kiểu `any` vì supabase-js builder rất khó generic hoá (chainable + filter methods).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export function applyFilters<Q>(q: Q, filters: Record<string, unknown> | null | undefined): Q {
  if (!filters) return q;
  const builder = q as any;
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined || v === "") continue;

    if (k.endsWith("__in")) {
      const col = k.slice(0, -4);
      const arr = String(v)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (arr.length === 0) continue;
      if (arr.length === 1) {
        return builder.eq(col, arr[0]) as Q;
      }
      return builder.in(col, arr) as Q;
    }
    if (k.endsWith("__neq")) {
      return builder.neq(k.slice(0, -5), String(v)) as Q;
    }
    if (k.endsWith("__gt")) {
      return builder.gt(k.slice(0, -4), String(v)) as Q;
    }
    if (k.endsWith("__gte")) {
      return builder.gte(k.slice(0, -5), String(v)) as Q;
    }
    if (k.endsWith("__lt")) {
      return builder.lt(k.slice(0, -3), String(v)) as Q;
    }
    if (k.endsWith("__lte")) {
      return builder.lte(k.slice(0, -4), String(v)) as Q;
    }
    if (k.endsWith("__ilike")) {
      return builder.ilike(k.slice(0, -7), String(v)) as Q;
    }

    return builder.eq(k, v as string | number | boolean) as Q;
  }
  return q;
}
