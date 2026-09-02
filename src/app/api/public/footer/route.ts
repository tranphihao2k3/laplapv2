import { NextResponse } from "next/server";
import { getFooterSettingsCached } from "@/lib/footer-settings-cached";

// Use cached version for API routes
export const revalidate = 3600; // 1 hour

export async function GET() {
  return NextResponse.json(await getFooterSettingsCached());
}
