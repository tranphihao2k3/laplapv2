import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type BrandRow = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  show_on_homepage: boolean;
};

export async function GET(req: NextRequest) {
  const showOnHomepage = req.nextUrl.searchParams.get("showOnHomepage") === "true";

  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("brands")
      .select("id,name,slug,logo_url,show_on_homepage")
      .order("name", { ascending: true });

    if (showOnHomepage) query = query.eq("show_on_homepage", true);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ items: data ?? [] });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
