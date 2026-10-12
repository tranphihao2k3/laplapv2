import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createAdminClient } from "@/lib/supabase/admin";
import { hostKeyFromHeader, resolveShopByHostKey } from "@/lib/shop-domain";

/**
 * Cache kết quả resolve shop theo host, TTL 60s.
 *
 * Lý do cần cache:
 *  - Middleware chạy trên MỌI request khớp `config.matcher` (bao gồm API).
 *  - DB round-trip mỗi request là không chấp nhận được ở hot path.
 *  - Domain mapping gần như không đổi trong 1 phút — TTL 60s là đủ an toàn.
 *
 * Giới hạn size: 256 entries tránh memory leak. Map dùng insertion order nên
 * khi đầy sẽ drop phần tử cũ nhất (LRU-ish — không perfect nhưng đủ dùng).
 */
const SHOP_CACHE_TTL_MS = 60_000;
const SHOP_CACHE_MAX = 256;
const shopCache = new Map<string, { shopId: string | null; expiresAt: number }>();

function getCachedShopId(hostKey: string): string | null | undefined {
  const entry = shopCache.get(hostKey);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    shopCache.delete(hostKey);
    return undefined;
  }
  return entry.shopId;
}

function setCachedShopId(hostKey: string, shopId: string | null): void {
  if (shopCache.size >= SHOP_CACHE_MAX) {
    // Xoá entry cũ nhất (Map giữ insertion order)
    const oldestKey = shopCache.keys().next().value;
    if (oldestKey !== undefined) shopCache.delete(oldestKey);
  }
  shopCache.set(hostKey, { shopId, expiresAt: Date.now() + SHOP_CACHE_TTL_MS });
}

export async function middleware(request: NextRequest) {
  const res = await updateSession(request);

  // === Multi-shop: resolve shop từ Host header ===
  // Bỏ qua cho Next internals + static assets để khỏi lãng phí cache lookup.
  const pathname = request.nextUrl.pathname;
  const skipShopResolve =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/") || // /auth/v1/* proxy — không cần shop
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml";

  if (!skipShopResolve) {
    const host = request.headers.get("host");
    const hostKey = hostKeyFromHeader(host);

    if (hostKey) {
      let shopId = getCachedShopId(hostKey);
      if (shopId === undefined) {
        try {
          const supabase = createAdminClient();
          shopId = await resolveShopByHostKey(supabase, hostKey);
        } catch {
          // Không throw — middleware không được phép chặn request. Fallback:
          // request vẫn chạy, các API tự quyết định default shop.
          shopId = null;
        }
        setCachedShopId(hostKey, shopId);
      }

      if (shopId) {
        // Set header để API route / server component đọc lại nhanh.
        res.headers.set("x-shop-id", shopId);
        // Set cookie (Lax) để client fetch cũng pick up được khi cần.
        // Không HttpOnly — server components + API mới cần đọc.
        res.cookies.set("shop_id", shopId, {
          path: "/",
          sameSite: "lax",
          // 7 ngày. Host mapping gần như không đổi; khi admin đổi domain
          // thì cookie cũ vẫn tồn tại 1 thời gian ngắn — không sao, server
          // vẫn check lại qua header.
          maxAge: 60 * 60 * 24 * 7,
        });
      }
    }
  }

  return res;
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

// Middleware cần truy cập `process.env.SUPABASE_SERVICE_ROLE_KEY` (server-only)
// để tạo admin client cho shop resolution. Edge runtime mặc định KHÔNG expose
// non-NEXT_PUBLIC env vars → bắt buộc dùng Node runtime.
// Lưu ý: Node runtime có cold start chậm hơn Edge, nhưng:
//  1. Cache 60s trong `shopCache` giảm 99% DB hit.
//  2. Cùng Node runtime với `updateSession` đang chạy.
//  3. Shop lookup chỉ fail-throws khi thiếu service role key — fail-soft.
export const runtime = "nodejs";
