import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, handleError, Errors } from "@/lib/api/response";
import { z } from "zod";

const saveBenchmarkSchema = z.object({
  laptop_id: z.string().uuid("laptop_id phải là UUID hợp lệ"),
  gpu_score: z.number().int().min(0).max(10000, "GPU score phải từ 0-10000"),
  benchmark_tool: z.string().optional(),
  test_width: z.number().int().nonnegative().optional(),
  test_height: z.number().int().nonnegative().optional(),
  test_preset: z.string().optional(),
  test_duration_seconds: z.number().int().optional().default(0),
});

function calculateGpuRank(score: number): string {
  if (score >= 8000) return "Excellent";
  if (score >= 6000) return "Good";
  if (score >= 4000) return "Fair";
  return "Poor";
}

async function calculatePercentile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  laptopId: string
): Promise<number> {
  // Lấy GPU score của laptop hiện tại
  const { data: currentBenchmark } = await supabase
    .from("gpu_benchmarks")
    .select("gpu_score")
    .eq("laptop_id", laptopId)
    .order("test_date", { ascending: false })
    .limit(1)
    .single();

  if (!currentBenchmark) return 0;

  const myScore = currentBenchmark.gpu_score;

  // Đếm tổng số laptop đã test
  const { count: totalCount } = await supabase
    .from("gpu_benchmarks")
    .select("laptop_id", { count: "exact", head: true });

  if (!totalCount || totalCount <= 1) return 100;

  // Đếm số laptop có GPU score thấp hơn
  const { count: lowerCount } = await supabase
    .from("gpu_benchmarks")
    .select("laptop_id", { count: "exact", head: true })
    .lt("gpu_score", myScore);

  const percentile = Math.round(((lowerCount ?? 0) / (totalCount - 1)) * 100);
  return Math.max(0, Math.min(100, percentile));
}

export async function POST(req: NextRequest) {
  try {
    const body = saveBenchmarkSchema.parse(await req.json());
    const supabase = await createClient();

    // Kiểm tra laptop_id có tồn tại không
    const { data: laptop } = await supabase
      .from("laptops")
      .select("id")
      .eq("id", body.laptop_id)
      .single();

    if (!laptop) {
      throw Errors.notFound("Laptop");
    }

    const gpu_rank = calculateGpuRank(body.gpu_score);

    // Lưu benchmark
    const { data, error } = await supabase
      .from("gpu_benchmarks")
      .insert([
        {
          laptop_id: body.laptop_id,
          gpu_score: body.gpu_score,
          gpu_rank,
          benchmark_tool: body.benchmark_tool,
          test_width: body.test_width,
          test_height: body.test_height,
          test_preset: body.test_preset,
          test_duration_seconds: body.test_duration_seconds,
        },
      ])
      .select("id")
      .single();

    if (error) throw error;

    // Tính percentile
    const percentile = await calculatePercentile(supabase, body.laptop_id);

    return ok({
      benchmark_id: data.id,
      gpu_rank,
      percentile,
    });
  } catch (e) {
    return handleError(e);
  }
}
