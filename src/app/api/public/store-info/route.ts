import { NextResponse } from "next/server";
import { getStoreInfoCached } from "@/lib/store-info-cached";

// Use cached version for API routes
export const revalidate = 3600; // 1 hour

export async function GET() {
  return NextResponse.json(await getStoreInfoCached());
}
