/**
 * Server-side helpers for the /test-laptop landing page.
 *
 * `getDashboardStats()` returns aggregate counts used by the hero section
 * of the command-center page. Lightweight queries against the public Supabase
 * tables — runs as a server component, so no auth needed.
 */
import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type DashboardStats = {
  totalLaptops: number;
  totalBenchmarks: number;
  uploadsLast24h: number;
  topGpuScore: number | null;
};

const DEFAULT_STATS: DashboardStats = {
  totalLaptops: 0,
  totalBenchmarks: 0,
  uploadsLast24h: 0,
  topGpuScore: null,
};

/**
 * Fetch aggregate stats for the /test-laptop hero.
 *
 * Uses service client to bypass RLS (the data is public but a small
 * "Lỗi tải thống kê" would be a poor UX). On any DB error, fall back
 * to zeros so the page still renders.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const supabase = createSupabaseServiceClient();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fire all 4 counts in parallel
    const [laptopsRes, benchmarksRes, uploadsRes, topScoreRes] = await Promise.all([
      supabase.from("laptops").select("id", { count: "exact", head: true }),
      supabase.from("gpu_benchmarks").select("id", { count: "exact", head: true }),
      supabase
        .from("mini_tool_uploads")
        .select("id", { count: "exact", head: true })
        .gt("created_at", cutoff),
      supabase
        .from("gpu_benchmarks")
        .select("gpu_score")
        .order("gpu_score", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      totalLaptops: laptopsRes.count ?? 0,
      totalBenchmarks: benchmarksRes.count ?? 0,
      uploadsLast24h: uploadsRes.count ?? 0,
      topGpuScore:
        topScoreRes.data && typeof topScoreRes.data.gpu_score === "number"
          ? topScoreRes.data.gpu_score
          : null,
    };
  } catch (err) {
    // Khong lam vo UI neu DB loi — tra ve 0 de trang van render.
    console.error("[test-laptop/stats] failed to load dashboard stats:", err);
    return DEFAULT_STATS;
  }
}
