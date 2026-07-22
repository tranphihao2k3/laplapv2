import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, handleError } from "@/lib/api/response";
import { z } from "zod";

const registerSchema = z.object({
  device_id: z.string().min(1, "device_id là bắt buộc"),
  device_name: z.string().min(1, "device_name là bắt buộc"),
});

export async function POST(req: NextRequest) {
  try {
    const body = registerSchema.parse(await req.json());
    const supabase = await createClient();

    // Kiểm tra xem device đã tồn tại chưa
    const { data: existing } = await supabase
      .from("laptops")
      .select("id")
      .eq("device_id", body.device_id)
      .single();

    if (existing) {
      return ok({ laptop_id: existing.id, message: "Device đã tồn tại" });
    }

    // Tạo mới laptop
    const { data, error } = await supabase
      .from("laptops")
      .insert([{ device_id: body.device_id, device_name: body.device_name }])
      .select("id")
      .single();

    if (error) throw error;

    return ok({ laptop_id: data.id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}