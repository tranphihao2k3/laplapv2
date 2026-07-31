import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FINANCING, normalizeFinancing, type FinancingSetting } from "@/lib/financing";

type SettingRow = {
  key: string | null;
  group_name: string | null;
  value: unknown;
};

// GET /api/public/financing — trả về cấu hình trả góp cho trang sản phẩm.
// Không yêu cầu auth (dùng admin client, chỉ đọc 1 key công khai).
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("settings")
      .select("key,group_name,value")
      .eq("key", "financing.providers")
      .single();

    if (error || !data) {
      return NextResponse.json(DEFAULT_FINANCING satisfies FinancingSetting);
    }

    const row = data as SettingRow;
    let raw: unknown = row.value;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = undefined;
      }
    }

    return NextResponse.json(normalizeFinancing(raw));
  } catch {
    return NextResponse.json(DEFAULT_FINANCING satisfies FinancingSetting);
  }
}
