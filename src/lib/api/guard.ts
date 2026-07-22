import { createClient } from "@/lib/supabase/server";
import { Errors } from "@/lib/api/response";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DB = any;

/** Lấy user hiện tại — throw 401 nếu chưa login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw Errors.unauthorized();
  return { supabase, user };
}

/** Lấy user + organization_id. Throw 403 nếu chưa có profile/org. */
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
