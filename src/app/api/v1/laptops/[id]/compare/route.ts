import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, handleError, Errors } from "@/lib/api/response";

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

async function getAverageStats(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  // Tính trung bình GPU score
  const { data: avgData } = await supabase
    .from("gpu_benchmarks")
    .select("gpu_score");

  const avgGpuScore =
    avgData && avgData.length > 0
      ? Math.round(
          avgData.reduce((sum, item) => sum + item.gpu_score, 0) / avgData.length
        )
      : 0;

  // Tính trung bình RAM
  const { data: ramData } = await supabase
    .from("laptop_specs")
    .select("ram_gb");

  const avgRam =
    ramData && ramData.length > 0
      ? Math.round(
          ramData.reduce((sum, item) => sum + (item.ram_gb || 0), 0) /
            ramData.length
        )
      : 0;

  // Đếm số lượng GPU và CPU phổ biến
  const { data: gpuData } = await supabase
    .from("laptop_specs")
    .select("gpu_name");

  const gpuCounts: Record<string, number> = {};
  gpuData?.forEach((item) => {
    if (item.gpu_name) {
      gpuCounts[item.gpu_name] = (gpuCounts[item.gpu_name] || 0) + 1;
    }
  });

  const { data: cpuData } = await supabase
    .from("laptop_specs")
    .select("cpu_name");

  const cpuCounts: Record<string, number> = {};
  cpuData?.forEach((item) => {
    if (item.cpu_name) {
      cpuCounts[item.cpu_name] = (cpuCounts[item.cpu_name] || 0) + 1;
    }
  });

  return {
    avg_gpu_score: avgGpuScore,
    avg_ram: avgRam,
    total_laptops: avgData?.length || 0,
    popular_gpus: Object.entries(gpuCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    popular_cpus: Object.entries(cpuCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: laptopId } = await params;
    const supabase = await createClient();

    // Lấy thông tin laptop
    const { data: laptop, error: laptopError } = await supabase
      .from("laptops")
      .select(`
        id,
        device_name,
        device_id,
        created_at,
        laptop_specs (
          cpu_name,
          cpu_cores,
          cpu_threads,
          ram_gb,
          ram_type,
          storage_type,
          storage_gb,
          gpu_name,
          gpu_vram_gb,
          os_name,
          os_version
        ),
        gpu_benchmarks (
          gpu_score,
          gpu_rank,
          test_date,
          test_duration_seconds
        )
      `)
      .eq("id", laptopId)
      .single();

    if (laptopError || !laptop) {
      throw Errors.notFound("Laptop");
    }

    const specs = Array.isArray(laptop.laptop_specs)
      ? laptop.laptop_specs[0]
      : laptop.laptop_specs;
    const benchmarks = Array.isArray(laptop.gpu_benchmarks)
      ? laptop.gpu_benchmarks
      : [];

    // Get latest benchmark
    const latestBenchmark = benchmarks
      .sort(
        (a, b) =>
          new Date(b.test_date).getTime() - new Date(a.test_date).getTime()
      )[0];

    // Tính percentile
    const percentile = await calculatePercentile(supabase, laptopId);

    // Lấy thống kê trung bình
    const avgStats = await getAverageStats(supabase);

    return ok({
      laptop: {
        id: laptop.id,
        device_name: laptop.device_name,
        device_id: laptop.device_id,
        created_at: laptop.created_at,
        specs: {
          cpu_name: specs?.cpu_name || "N/A",
          cpu_cores: specs?.cpu_cores || 0,
          cpu_threads: specs?.cpu_threads || 0,
          ram_gb: specs?.ram_gb || 0,
          ram_type: specs?.ram_type || "N/A",
          storage_type: specs?.storage_type || "N/A",
          storage_gb: specs?.storage_gb || 0,
          gpu_name: specs?.gpu_name || "N/A",
          gpu_vram_gb: specs?.gpu_vram_gb || 0,
          os_name: specs?.os_name || "N/A",
          os_version: specs?.os_version || "N/A",
        },
        benchmark: latestBenchmark
          ? {
              gpu_score: latestBenchmark.gpu_score,
              gpu_rank: latestBenchmark.gpu_rank,
              test_date: latestBenchmark.test_date,
              test_duration_seconds: latestBenchmark.test_duration_seconds,
            }
          : null,
      },
      comparison: {
        percentile,
        avg_gpu_score: avgStats.avg_gpu_score,
        avg_ram: avgStats.avg_ram,
        total_laptops: avgStats.total_laptops,
        your_gpu_score: latestBenchmark?.gpu_score || 0,
        your_ram: specs?.ram_gb || 0,
        gpu_rank: latestBenchmark?.gpu_rank || "N/A",
        popular_gpus: avgStats.popular_gpus,
        popular_cpus: avgStats.popular_cpus,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
