/**
 * Shared types + helpers cho phần admin PC Builder.
 *
 * - ListTable: danh sách build (lọc theo tên, khoảng ngày, user, search)
 * - Detail: hiện chi tiết 1 build + items (linh kiện đã chốt), in được A4
 * - SpecEditor: quản lý pc_components_specs (theo từng product)
 *
 * PC Builder dùng trực tiếp Supabase client (browser) — chưa có API route
 * /v1/pc-builds. Server component fetch initial data để hiển thị SSR,
 * client component dùng useQuery để refetch với filter/pagination.
 */
import type { Database } from "@/types/database";

export type PcBuildRow = Database["public"]["Tables"]["pc_builds"]["Row"];
export type PcBuildItemRow = Database["public"]["Tables"]["pc_build_items"]["Row"];
export type PcComponentsSpecRow = Database["public"]["Tables"]["pc_components_specs"]["Row"];

/** Định dạng tiền VND cho các bảng giá. Dùng Intl để có dấu phân cách + ký hiệu ₫. */
export function formatVnd(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Parse extras (jsonb) ra object — nếu đã là object thì trả về, nếu null thì {}. */
export function parseExtras(extras: unknown): Record<string, unknown> {
  if (!extras) return {};
  if (typeof extras === "object") return extras as Record<string, unknown>;
  if (typeof extras === "string") {
    try {
      const parsed = JSON.parse(extras);
      return typeof parsed === "object" && parsed ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Stringify extras cho <Textarea> — định dạng JSON đẹp 2-space. */
export function stringifyExtras(extras: Record<string, unknown>): string {
  const entries = Object.entries(extras ?? {});
  if (entries.length === 0) return "";
  return JSON.stringify(Object.fromEntries(entries), null, 2);
}

/** Định dạng ngày giờ kiểu Việt Nam dd/MM/yyyy HH:mm. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Định dạng ngày dd/MM/yyyy (không có giờ). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Slug thân thiện cho URL detail: dùng share_slug nếu có, fallback về id. */
export function buildHref(build: { id: string; share_slug: string | null }): string {
  return `/quanly/pc-builds/${build.id}`;
}

/** Helper: tính tổng giá từ danh sách items (đề phòng total_price trong build chưa đồng bộ). */
export function computeTotal(items: Array<{ qty: number | null; unit_price: number | null }>): number {
  return items.reduce((sum, it) => sum + (it.qty ?? 0) * (it.unit_price ?? 0), 0);
}