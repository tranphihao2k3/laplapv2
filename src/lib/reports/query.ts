/**
 * Helpers dùng chung cho 8 trang báo cáo + 8 API Excel.
 * - fetchAll: lấy toàn bộ rows (giới hạn 50k) phục vụ export Excel
 * - fetchPage: phân trang phục vụ UI bảng
 * - summarize: tính tổng hợp (sum/count) từ rows
 * - parseFilters: parse URLSearchParams → ReportFilters
 *
 * Designed cho Next.js App Router + Supabase Server Client.
 */
import { createClient } from "@/lib/supabase/server";

export type ReportFilters = {
  from?: string;        // ISO date — áp dụng cho cột created_at / ngày bất kỳ
  to?: string;          // ISO date
  shop_id?: string;
  channel?: "pos" | "online" | "phone" | "in_store";
  status?: string;
  payment_status?: string;
  category_id?: string;
  brand_id?: string;
  tier?: string;
  /** Filter tuỳ ý thêm (key, value) cho route cụ thể — chỉ dùng cho báo cáo đặc biệt. */
  extra?: Record<string, string | number | undefined | null>;
  page?: number;
  pageSize?: number;    // mặc định 200 cho UI, 50000 cho Excel
};

/** Parse URLSearchParams → ReportFilters. Bỏ qua key rỗng. */
export function parseFilters(sp: URLSearchParams): ReportFilters {
  const get = (k: string) => {
    const v = sp.get(k);
    return v && v !== "" ? v : undefined;
  };
  const num = (k: string) => {
    const v = sp.get(k);
    if (!v || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const channel = get("channel");
  return {
    from: get("from"),
    to: get("to"),
    shop_id: get("shop_id"),
    channel: (channel === "pos" || channel === "online" || channel === "phone" || channel === "in_store")
      ? channel
      : undefined,
    status: get("status"),
    payment_status: get("payment_status"),
    category_id: get("category_id"),
    brand_id: get("brand_id"),
    tier: get("tier"),
    page: num("page"),
    pageSize: num("pageSize"),
  };
}

/** Lấy toàn bộ rows phục vụ report (giới hạn hardLimit mặc định 50k). */
export async function fetchAll<T extends Record<string, unknown>>(
  table: string,
  select: string,
  filters: ReportFilters,
  opts: { hardLimit?: number; orderBy?: string; ascending?: boolean } = {},
): Promise<T[]> {
  const supabase = await createClient();
  const { hardLimit = 50_000, orderBy, ascending = false } = opts;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from(table).select(select).limit(hardLimit);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  if (filters.shop_id) q = q.eq("shop_id", filters.shop_id);
  if (filters.channel) q = q.eq("channel", filters.channel);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.payment_status) q = q.eq("payment_status", filters.payment_status);
  if (filters.category_id) q = q.eq("category_id", filters.category_id);
  if (filters.brand_id) q = q.eq("brand_id", filters.brand_id);
  if (filters.tier) q = q.eq("tier", filters.tier);
  if (orderBy) q = q.order(orderBy, { ascending });
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as T[];
}

/** Lấy rows phân trang phục vụ UI bảng (mặc định 20/trang). */
export async function fetchPage<T extends Record<string, unknown>>(
  table: string,
  select: string,
  filters: ReportFilters,
  opts: { orderBy?: string; ascending?: boolean; defaultPageSize?: number } = {},
): Promise<{ items: T[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const supabase = await createClient();
  const { orderBy, ascending = false, defaultPageSize = 20 } = opts;
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : defaultPageSize;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from(table).select(select, { count: "exact" }).range(from, to);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  if (filters.shop_id) q = q.eq("shop_id", filters.shop_id);
  if (filters.channel) q = q.eq("channel", filters.channel);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.payment_status) q = q.eq("payment_status", filters.payment_status);
  if (filters.category_id) q = q.eq("category_id", filters.category_id);
  if (filters.brand_id) q = q.eq("brand_id", filters.brand_id);
  if (filters.tier) q = q.eq("tier", filters.tier);
  if (orderBy) q = q.order(orderBy, { ascending });
  const { data, error, count } = await q;
  if (error) throw error;
  const items = (data ?? []) as T[];
  const total = count ?? items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { items, total, page, pageSize, totalPages };
}

export type SummarizeRule = {
  key: string;
  /** Tên field để sum. Nếu không có, chỉ count. */
  sumField?: string;
  /** Nếu có, chỉ count các row pass filter. */
  countFilter?: (row: Record<string, unknown>) => boolean;
};

/** Tính tổng hợp từ rows: mỗi rule trả về { key: number }. */
export function summarize(
  rows: Record<string, unknown>[],
  rules: SummarizeRule[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rules) {
    if (r.sumField) {
      out[r.key] = rows.reduce((s, row) => {
        if (r.countFilter && !r.countFilter(row)) return s;
        const raw = row[r.sumField as keyof typeof row];
        const v = Number(raw ?? 0);
        return s + (Number.isFinite(v) ? v : 0);
      }, 0);
    } else if (r.countFilter) {
      out[r.key] = rows.filter(r.countFilter).length;
    } else {
      out[r.key] = rows.length;
    }
  }
  return out;
}

/** Bucket một ISO date thành key theo granularity. */
export function bucketDate(dateStr: string, granularity: "day" | "week" | "month"): string {
  const d = new Date(dateStr);
  if (granularity === "month") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "week") {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil(
      ((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
    return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
