import { NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ok, handleError } from "@/lib/api/response";
import { getServerEnv } from "@/lib/env";

// Public read-only client — bypass RLS/JWT bằng service role key
// Ranking là dữ liệu công khai, không cần auth
function createPublicClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  const key = SUPABASE_SERVICE_ROLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createSupabaseClient(NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createPublicClient();
    const { searchParams } = new URL(req.url);

    const sortBy = searchParams.get("sort_by") || "gpu_score";
    const limit = parseInt(searchParams.get("limit") || "20");
    const gpuFilter = searchParams.get("gpu") || "";
    const cpuFilter = searchParams.get("cpu") || "";
    const ramFilter = searchParams.get("ram") || "";

    // Query laptop rankings
    let query = supabase
      .from("laptops")
      .select(`
        id,
        device_name,
        laptop_specs (
          cpu_name,
          cpu_cores,
          cpu_threads,
          ram_gb,
          ram_type,
          gpu_name,
          gpu_vram_gb,
          storage_gb,
          storage_type
        ),
        gpu_benchmarks (
          gpu_score,
          gpu_rank,
          benchmark_tool,
          test_width,
          test_height,
          test_preset,
          test_duration_seconds,
          test_date
        )
      `)
      .not("gpu_benchmarks", "is", null);

    // Apply filters
    if (gpuFilter) {
      query = query.ilike("laptop_specs.gpu_name", `%${gpuFilter}%`);
    }
    if (cpuFilter) {
      query = query.ilike("laptop_specs.cpu_name", `%${cpuFilter}%`);
    }
    if (ramFilter) {
      query = query.eq("laptop_specs.ram_gb", parseInt(ramFilter));
    }

    const { data, error } = await query;

    if (error) throw error;

    // Process data: get latest benchmark for each laptop
    const processedData = (data || []).map((laptop) => {
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

      return {
        laptop_id: laptop.id,
        device_name: laptop.device_name,
        cpu_name: specs?.cpu_name || "N/A",
        cpu_cores: specs?.cpu_cores || 0,
        ram_gb: specs?.ram_gb || 0,
        ram_type: specs?.ram_type || "N/A",
        gpu_name: specs?.gpu_name || "N/A",
        gpu_vram_gb: specs?.gpu_vram_gb || 0,
        gpu_score: latestBenchmark?.gpu_score || 0,
        gpu_rank: latestBenchmark?.gpu_rank || "N/A",
        benchmark_tool: latestBenchmark?.benchmark_tool || null,
        test_width: latestBenchmark?.test_width || null,
        test_height: latestBenchmark?.test_height || null,
        test_preset: latestBenchmark?.test_preset || null,
        test_duration_seconds: latestBenchmark?.test_duration_seconds || null,
        test_date: latestBenchmark?.test_date || null,
      };
    });

    // Sort by the specified field
    processedData.sort((a, b) => {
      switch (sortBy) {
        case "gpu_score":
          return b.gpu_score - a.gpu_score;
        case "cpu_name":
          return (a.cpu_name || "").localeCompare(b.cpu_name || "");
        case "ram_gb":
          return b.ram_gb - a.ram_gb;
        default:
          return b.gpu_score - a.gpu_score;
      }
    });

    // Limit results
    const limitedData = processedData.slice(0, limit);

    // Add rank number
    const rankedData = limitedData.map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

    return ok({
      data: rankedData,
      total: processedData.length,
    });
  } catch (e) {
    return handleError(e);
  }
}
