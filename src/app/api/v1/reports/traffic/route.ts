/**
 * GET /api/v1/reports/traffic
 * Báo cáo lượt xem trang: summary (today / 7d / 30d / range) + series theo ngày + top paths.
 * Query: from, to (YYYY-MM-DD, mặc định 30 ngày gần nhất theo TZ VN).
 */
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";

type DailyRow = { day: string; path: string; views: number };

function vnTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function sumViews(rows: DailyRow[], from: string, to: string): number {
  let n = 0;
  for (const r of rows) {
    if (r.day >= from && r.day <= to) n += r.views;
  }
  return n;
}

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    await requirePermission("reports.read");

    const today = vnTodayIso();
    const sp = req.nextUrl.searchParams;
    const to = (sp.get("to") || today).slice(0, 10);
    const from = (sp.get("from") || addDaysIso(to, -29)).slice(0, 10);

    const supabase = createAdminClient();

    // Lấy đủ cửa sổ 30 ngày để tính last7/last30 kể cả khi filter hẹp hơn.
    const fetchFrom = addDaysIso(today, -29);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("site_page_views_daily")
      .select("day, path, views")
      .gte("day", fetchFrom)
      .lte("day", today);

    if (error) throw error;

    const rows = ((data ?? []) as DailyRow[]).map((r) => ({
      day: String(r.day).slice(0, 10),
      path: r.path,
      views: Number(r.views) || 0,
    }));

    const last7From = addDaysIso(today, -6);
    const summary = {
      today: sumViews(rows, today, today),
      last7: sumViews(rows, last7From, today),
      last30: sumViews(rows, fetchFrom, today),
      rangeTotal: sumViews(rows, from, to),
    };

    // Series theo ngày trong khoảng filter
    const byDay = new Map<string, number>();
    let cursor = from;
    while (cursor <= to) {
      byDay.set(cursor, 0);
      cursor = addDaysIso(cursor, 1);
      if (byDay.size > 400) break; // safety
    }
    for (const r of rows) {
      if (r.day < from || r.day > to) continue;
      byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.views);
    }
    const series = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, views]) => ({ day, views }));

    // Top paths trong khoảng
    const byPath = new Map<string, number>();
    for (const r of rows) {
      if (r.day < from || r.day > to) continue;
      byPath.set(r.path, (byPath.get(r.path) ?? 0) + r.views);
    }
    const topPages = [...byPath.entries()]
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
      .slice(0, 20);

    return ok({
      filters: { from, to },
      generatedAt: new Date().toISOString(),
      summary,
      charts: { series },
      topPages,
    });
  } catch (e) {
    return handleError(e);
  }
}
