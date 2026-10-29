import { NextResponse } from "next/server";
import { getStoreInfoCached } from "@/lib/store-info-cached";
import { getShopIdFromRequest } from "@/lib/request-shop";

// Use cached version for API routes
export const revalidate = 3600; // 1 hour

// PHẢI dynamic: route này đọc settings từ Supabase bằng service-role key.
// Nếu để Next prerender lúc `next build` (Docker builder KHÔNG có
// SUPABASE_SERVICE_ROLE_KEY) → query fail → giá trị DEFAULTS bị bake vào
// static output và phục vụ tới hết TTL (1h), khiến admin đổi tên store không
// hiện lên. force-dynamic buộc render lúc runtime; phần đọc DB vẫn được
// cache 1h bởi getStoreInfoCached (unstable_cache).
export const dynamic = "force-dynamic";

export async function GET() {
  // Middleware đã set x-shop-id từ Host header. Nếu có, trả store-info
  // của shop đó (brand/phone/email/address theo từng domain).
  // Nếu không có (vd domain chưa cấu hình trong `shops`), fallback global.
  const shopId = await getShopIdFromRequest();
  return NextResponse.json(await getStoreInfoCached(shopId));
}
