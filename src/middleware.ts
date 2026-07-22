import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
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
