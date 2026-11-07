import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/api/guard";

export async function POST(req: NextRequest) {
  try {
    await requirePermission("warranties.create");
    const supabase = await createClient();
    const body = await req.json();
    const out: Record<string, unknown> = {};

    // Test 1: insert KHÔNG có warehouse_id
    const r1 = await supabase
      .from("serial_numbers")
      .insert({
        product_variant_id: null,
        serial: body.serial,
        imei: null,
        status: "sold",
        sold_at: "2026-11-06",
        imported_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    out.noWarehouse = r1.error
      ? { code: r1.error.code, message: r1.error.message }
      : { id: r1.data.id };

    // Test 2: insert CÓ warehouse_id
    const r2 = await supabase
      .from("serial_numbers")
      .insert({
        product_variant_id: null,
        warehouse_id: body.warehouse_id,
        serial: body.serial + "-WH",
        imei: null,
        status: "sold",
        sold_at: "2026-11-06",
        imported_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    out.withWarehouse = r2.error
      ? { code: r2.error.code, message: r2.error.message }
      : { id: r2.data.id };

    return Response.json(out);
  } catch (e) {
    return Response.json({ catch: String(e) }, { status: 500 });
  }
}
