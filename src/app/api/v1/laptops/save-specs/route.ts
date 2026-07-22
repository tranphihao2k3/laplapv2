import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, handleError, Errors } from "@/lib/api/response";
import { z } from "zod";

const saveSpecsSchema = z.object({
  laptop_id: z.string().uuid("laptop_id phải là UUID hợp lệ"),
  cpu_name: z.string().optional(),
  cpu_cores: z.number().int().optional(),
  cpu_threads: z.number().int().optional(),
  cpu_base_ghz: z.number().nonnegative().optional(),
  ram_gb: z.number().int().optional(),
  ram_brand: z.string().optional(),
  ram_speed_mhz: z.number().int().optional(),
  ram_type: z.string().optional(),
  ram_slots: z.number().int().optional(),
  storage_brand: z.string().optional(),
  storage_type: z.string().optional(),
  storage_gb: z.number().int().optional(),
  gpu_name: z.string().optional(),
  gpu_vendor: z.string().optional(),
  gpu_vram_gb: z.number().int().optional(),
  gpu_power_watts: z.number().int().optional(),
  mainboard: z.string().optional(),
  battery_design_mwh: z.number().int().optional(),
  battery_full_mwh: z.number().int().optional(),
  battery_health: z.number().nonnegative().optional(),
  battery_cycles: z.number().int().nonnegative().optional(),
  os_name: z.string().optional(),
  os_version: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = saveSpecsSchema.parse(await req.json());
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

    // Kiểm tra xem specs đã tồn tại chưa
    const { data: existing } = await supabase
      .from("laptop_specs")
      .select("id")
      .eq("laptop_id", body.laptop_id)
      .single();

    let data, error;

    if (existing) {
      // Update existing specs
      const result = await supabase
        .from("laptop_specs")
        .update({
          cpu_name: body.cpu_name,
          cpu_cores: body.cpu_cores,
          cpu_threads: body.cpu_threads,
          cpu_base_ghz: body.cpu_base_ghz,
          ram_gb: body.ram_gb,
          ram_brand: body.ram_brand,
          ram_speed_mhz: body.ram_speed_mhz,
          ram_type: body.ram_type,
          ram_slots: body.ram_slots,
          storage_brand: body.storage_brand,
          storage_type: body.storage_type,
          storage_gb: body.storage_gb,
          gpu_name: body.gpu_name,
          gpu_vendor: body.gpu_vendor,
          gpu_vram_gb: body.gpu_vram_gb,
          gpu_power_watts: body.gpu_power_watts,
          mainboard: body.mainboard,
          battery_design_mwh: body.battery_design_mwh,
          battery_full_mwh: body.battery_full_mwh,
          battery_health: body.battery_health,
          battery_cycles: body.battery_cycles,
          os_name: body.os_name,
          os_version: body.os_version,
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Insert new specs
      const result = await supabase
        .from("laptop_specs")
        .insert([
          {
            laptop_id: body.laptop_id,
            cpu_name: body.cpu_name,
            cpu_cores: body.cpu_cores,
            cpu_threads: body.cpu_threads,
            cpu_base_ghz: body.cpu_base_ghz,
            ram_gb: body.ram_gb,
            ram_brand: body.ram_brand,
            ram_speed_mhz: body.ram_speed_mhz,
            ram_type: body.ram_type,
            ram_slots: body.ram_slots,
            storage_brand: body.storage_brand,
            storage_type: body.storage_type,
            storage_gb: body.storage_gb,
            gpu_name: body.gpu_name,
            gpu_vendor: body.gpu_vendor,
            gpu_vram_gb: body.gpu_vram_gb,
            gpu_power_watts: body.gpu_power_watts,
            mainboard: body.mainboard,
            battery_design_mwh: body.battery_design_mwh,
            battery_full_mwh: body.battery_full_mwh,
            battery_health: body.battery_health,
            battery_cycles: body.battery_cycles,
            os_name: body.os_name,
            os_version: body.os_version,
          },
        ])
        .select("id")
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) throw error;
    if (!data) throw new Error("Không nhận được thông tin specs sau khi lưu");

    return ok({ specs_id: data.id });
  } catch (e) {
    return handleError(e);
  }
}
