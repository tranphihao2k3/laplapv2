import { NextResponse } from "next/server";
import { getFooterSettingsCached } from "@/lib/footer-settings-cached";

// Use cached version for API routes
export const revalidate = 3600; // 1 hour

// PHẢI dynamic: đọc settings từ Supabase bằng service-role key. Nếu bị
// prerender lúc `next build` (Docker builder không có key) → giá trị default
// bị bake vào static output và phục vụ tới hết TTL.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getFooterSettingsCached());
}
