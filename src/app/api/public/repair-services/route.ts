import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type PublicRepairService = {
  id: string;
  category: string;
  name: string;
  slug: string;
  description: string | null;
  price_type: "fixed" | "range" | "contact";
  price_min: number | null;
  price_max: number | null;
  unit: string | null;
  warranty_text: string | null;
  is_featured: boolean;
};

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
