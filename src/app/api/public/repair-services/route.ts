import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RepairServiceRow } from "@/types/database";

export type PublicRepairService = Pick<
  RepairServiceRow,
  | "id"
  | "category"
  | "name"
  | "slug"
  | "description"
  | "price_type"
  | "price_min"
  | "price_max"
  | "unit"
  | "warranty_text"
  | "is_featured"
>;

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("repair_services")
      .select(
        "id,category,name,slug,description,price_type,price_min,price_max,unit,warranty_text,is_featured,position",
      )
      .eq("is_active", true)
      .order("position", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    const items = (data ?? []) as (PublicRepairService & { position: number })[];
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
