import { NextResponse } from "next/server";
import { getTrustBadgesCached } from "@/lib/trust-badges-cached";

// Use cached version for API routes - already uses unstable_cache internally
export const revalidate = 3600; // 1 hour

export async function GET() {
  return NextResponse.json(await getTrustBadgesCached());
}
