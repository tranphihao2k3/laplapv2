import { createClient } from "@/lib/supabase/server";
import { readBearerToken, createBearerClient } from "@/lib/supabase/bearer";
import { Errors } from "@/lib/api/response";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DB = any;

/** Client type chung cho cả cookie và bearer — cùng Database typing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<Database, "public", any>;

/**
 * Context xác thực dùng cho cả web (cookie) và desktop (Bearer).
 *
 * - `auth`: "cookie" | "bearer" — route có thể log/audit nguồn xác thực.
 * - `supabase`: client đã gắn session tương ứng. Mọi query sau đó chạy
 *   dưới danh nghĩa user đó → RLS theo organization vẫn áp dụng.
 */
export type AuthContext = {
  auth: "cookie" | "bearer";
  supabase: AnySupabase;
  user: User;
  orgId: string;
};

/**
 * Lấy auth context từ Request:
 *   - Nếu có `Authorization: Bearer <access_token>` → resolve qua Supabase.
 *   - Ngược lại → fallback về `createClient()` (cookie session của web).
 *
 * Trả `null` nếu không có cách nào xác thực được user, hoặc token không hợp lệ.
 * KHÔNG throw ở đây — caller (requireUserFromRequest...) tự quyết định code trả.
 */
export async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const token = readBearerToken(req);

  // --- Bearer (desktop) ---
  if (token) {
    const supabase = createBearerClient(token);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const { data: profile } = (await supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle()) as { data: { organization_id: string | null } | null };

    if (!profile?.organization_id) return null;

    return { auth: "bearer", supabase: supabase as AnySupabase, user, orgId: profile.organization_id };
  }

  // --- Cookie (web — không thay đổi luồng cũ) ---
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = (await supabase
      .from("user_profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle()) as { data: { organization_id: string | null } | null };

    if (!data?.organization_id) return null;

    return { auth: "cookie", supabase, user, orgId: data.organization_id };
  } catch {
    return null;
  }
}

/** Lấy user hiện tại (cookie). Throw 401 nếu chưa login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw Errors.unauthorized();
  return { supabase, user };
}

/** Lấy user hiện tại (Bearer hoặc Cookie). Throw 401 nếu cả hai cách đều fail. */
export async function requireUserFromRequest(req: Request) {
  const ctx = await getAuthContext(req);
  if (!ctx) throw Errors.unauthorized();
  return ctx;
}

/** Lấy user + organization_id (cookie). */
export async function requireOrg() {
  const { supabase, user } = await requireUser();
  const { data, error } = (await supabase
    .from("user_profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle()) as { data: { organization_id: string | null } | null; error: unknown };

  if (error) throw error;
  if (!data || !data.organization_id) throw Errors.forbidden("Tài khoản chưa thuộc tổ chức nào");

  return { supabase, user, orgId: data.organization_id };
}

/** Lấy user + organization_id (Bearer hoặc Cookie). */
export async function requireOrgFromRequest(req: Request) {
  const ctx = await requireUserFromRequest(req);
  return { ...ctx, user: ctx.user };
}

/** Kiểm tra user thuộc shop nào đó (qua bảng shop_staff). */
export async function requireShopAccess(shopId: string) {
  const { supabase, user, orgId } = await requireOrg();
  const { data, error } = (await supabase
    .from("shop_staff")
    .select("id, role_id, is_active")
    .eq("user_id", user.id)
    .eq("shop_id", shopId)
    .maybeSingle()) as { data: { id: string; role_id: string | null; is_active: boolean | null } | null; error: unknown };

  if (error) throw error;
  if (!data || data.is_active === false) throw Errors.forbidden("Không có quyền trên cửa hàng này");
  return { supabase, user, orgId, shopId, roleId: data.role_id ?? null };
}

/** Yêu cầu user có permission code (qua role → role_permissions → permissions). */
export async function requirePermission(code: string) {
  const { supabase, user, orgId } = await requireOrg();

  const { data, error } = await supabase
    .from("shop_staff")
    .select("role_id, roles!inner(id, role_permissions!inner(permission_id, permissions!inner(code)))")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (error) throw error;

  const hasIt = (data ?? []).some((row) => {
    const roles = (row as { roles?: { role_permissions?: { permissions?: { code: string } }[] } }).roles;
    return roles?.role_permissions?.some((rp) => rp.permissions?.code === code);
  });

  if (!hasIt) throw Errors.forbidden(`Thiếu quyền ${code}`);
  return { supabase, user, orgId };
}

/**
 * Yêu cầu user có permission code, hỗ trợ cả Bearer lẫn Cookie.
 * Dùng cho route `/api/v1/desktop-posting/*` — cả 40+ route web cũ vẫn xài
 * `requirePermission(code)` (cookie-only) mà không bị ảnh hưởng.
 */
export async function requirePermissionFromRequest(req: Request, code: string) {
  const ctx = await requireOrgFromRequest(req);

  const { data, error } = await ctx.supabase
    .from("shop_staff")
    .select("role_id, roles!inner(id, role_permissions!inner(permission_id, permissions!inner(code)))")
    .eq("user_id", ctx.user.id)
    .eq("is_active", true);

  if (error) throw error;

  const hasIt = (data ?? []).some((row) => {
    const roles = (row as { roles?: { role_permissions?: { permissions?: { code: string } }[] } }).roles;
    return roles?.role_permissions?.some((rp) => rp.permissions?.code === code);
  });

  if (!hasIt) throw Errors.forbidden(`Thiếu quyền ${code}`);
  return ctx;
}
