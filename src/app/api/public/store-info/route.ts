import { NextResponse } from "next/server";
import { getStoreInfoCached } from "@/lib/store-info-cached";
import { getShopIdFromRequest } from "@/lib/request-shop";

// Use cached version for API routes
export const revalidate = 3600; // 1 hour

export async function GET() {
  // Middleware đã set x-shop-id từ Host header. Nếu có, trả store-info
  // của shop đó (brand/phone/email/address theo từng domain).
  // Nếu không có (vd domain chưa cấu hình trong `shops`), fallback global.
  const shopId = await getShopIdFromRequest();
  return NextResponse.json(await getStoreInfoCached(shopId));
}
