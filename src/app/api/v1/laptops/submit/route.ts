/**
 * POST /api/v1/laptops/submit
 *
 * Endpoint tổng hợp: 1 call duy nhất để:
 * 1. Register device (upsert)
 * 2. Save / update hardware specs
 * 3. Save benchmark score (nếu có)
 * 4. Lưu ghi chú lỗi / tình trạng máy
 *
 * Dùng cho desktop app sau khi scan + benchmark xong.
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, handleError } from "@/lib/api/response";
import { z } from "zod";

const submitSchema = z.object({
  // ── Device identity ──────────────────────────────────────
  device_id: z.string().min(1),
  device_name: z.string().min(1),

  // ── Hardware specs ───────────────────────────────────────
  cpu_name: z.string().optional(),
  cpu_cores: z.coerce.number().int().nonnegative().optional(),
  cpu_threads: z.coerce.number().int().nonnegative().optional(),
  cpu_base_ghz: z.coerce.number().nonnegative().optional(),

  ram_gb: z.coerce.number().int().nonnegative().optional(),
  ram_brand: z.string().optional(),
  ram_speed_mhz: z.coerce.number().int().nonnegative().optional(),
  ram_type: z.string().optional(),
  ram_slots: z.coerce.number().int().nonnegative().optional(),

  gpu_name: z.string().optional(),
  gpu_vendor: z.string().optional(),
  gpu_vram_gb: z.coerce.number().int().nonnegative().optional(),
  gpu_power_watts: z.coerce.number().int().nonnegative().optional(),

  mainboard: z.string().optional(),

  storage_brand: z.string().optional(),
  storage_type: z.string().optional(),   // SSD / HDD / NVMe
  storage_gb: z.coerce.number().int().nonnegative().optional(),

  battery_design_mwh: z.coerce.number().int().nonnegative().optional(),
  battery_full_mwh: z.coerce.number().int().nonnegative().optional(),
  battery_health: z.coerce.number().nonnegative().optional(),  // % sức khoẻ pin
  battery_cycles: z.coerce.number().int().nonnegative().optional(),

  os_name: z.string().optional(),
  os_version: z.string().optional(),

  // ── Benchmark ────────────────────────────────────────────
  gpu_score: z.coerce.number().int().nonnegative().optional(),
  fps_avg: z.coerce.number().nonnegative().optional(),
  fps_min: z.coerce.number().nonnegative().optional(),
  fps_max: z.coerce.number().nonnegative().optional(),
  benchmark_tool: z.string().optional(),
  test_width: z.coerce.number().int().nonnegative().optional(),
  test_height: z.coerce.number().int().nonnegative().optional(),
  test_preset: z.string().optional(),
  test_duration_seconds: z.coerce.number().int().nonnegative().optional().default(0),

  // ── Notes ────────────────────────────────────────────────
  note: z.string().max(2000).optional(),        // lỗi, tình trạng máy, ghi chú
  condition: z.enum(["new", "good", "fair", "poor"]).optional(),
  tech_name: z.string().optional(),             // tên kỹ thuật viên kiểm tra
});

function calcGpuRank(score: number): string {
  if (score >= 8000) return "Excellent";
  if (score >= 6000) return "Good";
  if (score >= 4000) return "Fair";
  return "Poor";
}

export async function POST(req: NextRequest) {
  try {
    const body = submitSchema.parse(await req.json());
    const supabase = await createClient();

    // ── 1. Upsert laptop ─────────────────────────────────────────────
    let laptopId: string;
    const { data: existing } = await supabase
      .from("laptops")
      .select("id")
      .eq("device_id", body.device_id)
      .single();

    if (existing) {
      // Update device name nếu thay đổi
      await supabase
        .from("laptops")
        .update({ device_name: body.device_name })
        .eq("id", existing.id);
      laptopId = existing.id;
    } else {
      const { data, error } = await supabase
        .from("laptops")
        .insert([{ device_id: body.device_id, device_name: body.device_name }])
        .select("id")
        .single();
      if (error) throw error;
      laptopId = data.id;
    }

    // ── 2. Upsert laptop_specs ───────────────────────────────────────
    const specsPayload = {
      laptop_id: laptopId,
      cpu_name: body.cpu_name,
      cpu_cores: body.cpu_cores,
      cpu_threads: body.cpu_threads,
      cpu_base_ghz: body.cpu_base_ghz,
      ram_gb: body.ram_gb,
      ram_brand: body.ram_brand,
      ram_speed_mhz: body.ram_speed_mhz,
      ram_type: body.ram_type,
      ram_slots: body.ram_slots,
      gpu_name: body.gpu_name,
      gpu_vendor: body.gpu_vendor,
      gpu_vram_gb: body.gpu_vram_gb,
      gpu_power_watts: body.gpu_power_watts,
      mainboard: body.mainboard,
      storage_brand: body.storage_brand,
      storage_type: body.storage_type,
      storage_gb: body.storage_gb,
      battery_design_mwh: body.battery_design_mwh,
      battery_full_mwh: body.battery_full_mwh,
      battery_health: body.battery_health,
      battery_cycles: body.battery_cycles,
      os_name: body.os_name,
      os_version: body.os_version,
    };

    const { data: existingSpecs } = await supabase
      .from("laptop_specs")
      .select("id")
      .eq("laptop_id", laptopId)
      .single();

    if (existingSpecs) {
      await supabase
        .from("laptop_specs")
        .update(specsPayload)
        .eq("id", existingSpecs.id);
    } else {
      await supabase.from("laptop_specs").insert([specsPayload]);
    }

    // ── 3. Insert benchmark (nếu có score) ───────────────────────────
    let benchmarkResult: {
      benchmark_id: string | null;
      gpu_rank: string | null;
      percentile: number;
    } = { benchmark_id: null, gpu_rank: null, percentile: 0 };

    if (body.gpu_score != null && body.gpu_score > 0) {
      const gpu_rank = calcGpuRank(body.gpu_score);

      const { data: bm, error: bmErr } = await supabase
        .from("gpu_benchmarks")
        .insert([
          {
            laptop_id: laptopId,
            gpu_score: body.gpu_score,
            gpu_rank,
            fps_avg: body.fps_avg,
            fps_min: body.fps_min,
            fps_max: body.fps_max,
            benchmark_tool: body.benchmark_tool,
            test_width: body.test_width,
            test_height: body.test_height,
            test_preset: body.test_preset,
            test_duration_seconds: body.test_duration_seconds,
            note: body.note,
            condition: body.condition,
            tech_name: body.tech_name,
          },
        ])
        .select("id")
        .single();

      if (bmErr) throw bmErr;

      // Tính percentile
      const { count: total } = await supabase
        .from("gpu_benchmarks")
        .select("laptop_id", { count: "exact", head: true });

      const { count: lower } = await supabase
        .from("gpu_benchmarks")
        .select("laptop_id", { count: "exact", head: true })
        .lt("gpu_score", body.gpu_score);

      const percentile =
        total && total > 1
          ? Math.max(0, Math.min(100, Math.round(((lower ?? 0) / (total - 1)) * 100)))
          : 100;

      benchmarkResult = { benchmark_id: bm.id, gpu_rank, percentile };
    }

    return ok({
      laptop_id: laptopId,
      ...benchmarkResult,
      message: "Lưu thành công",
    });
  } catch (e) {
    return handleError(e);
  }
}
