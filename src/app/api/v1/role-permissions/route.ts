import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    await requirePermission("permissions.read");
    const supabase = await createClient();
    const roleId = req.nextUrl.searchParams.get("role_id");
    let query = supabase.from("role_permissions").select("role_id, permission_id").limit(1000);
    if (roleId) query = query.eq("role_id", roleId);
    const { data, error } = await query;
    if (error) throw error;
    return ok({ items: data ?? [], total: (data ?? []).length, page: 1, pageSize: 1000, totalPages: 1 });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    await requirePermission("rbac.assign_permissions");
    const supabase = await createClient();
    const body = (await req.json()) as { role_id: string; permission_id: string };
    const rolePermissions = supabase.from("role_permissions") as unknown as {
      insert: (value: { role_id: string; permission_id: string }) => {
        select: () => { single: () => Promise<{ data: { role_id: string; permission_id: string } | null; error: unknown }> };
      };
    };
    const { data, error } = await rolePermissions
      .insert({ role_id: body.role_id, permission_id: body.permission_id })
      .select()
      .single();
    if (error) throw error;
    return ok(data, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
