import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Middleware: chỉ xử lý auth session refresh.
 *
 * Multi-shop đã được gỡ bỏ (xem scripts/migrate-single-shop.ts). Trước đây
 * middleware còn resolve shop từ `Host` header dựa trên `shops.primary_domain` /
 * `shops.allowed_domains`, set `x-shop-id` + `shop_id` cookie. Logic đó đã
 * được tắt vì hệ thống chỉ còn 1 cửa hàng.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Chỉ chạy middleware trên các route cần bảo vệ hoặc cần redirect auth:
     * - /dashboard và /quanly (admin panel)
     * - /account (trang tài khoản)
     * - /login và /signup (để redirect nếu đã đăng nhập)
     * - /api/* (trừ public API đã được skip bên trong updateSession)
     *
     * Các trang public (/, /products, /about, ...) sẽ KHÔNG đi qua middleware
     * → không có round-trip Supabase → navigation nhanh hơn đáng kể.
     */
    "/dashboard/:path*",
    "/quanly/:path*",
    "/account/:path*",
    "/login",
    "/signup",
    "/api/:path*",
  ],
};
