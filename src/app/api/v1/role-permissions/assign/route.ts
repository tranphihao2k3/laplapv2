import { NextRequest } from "next/server";
import { requireUser, requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { rolePermissionAssignSchema } from "@/lib/validators/org";

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    await requirePermission("rbac.assign_permissions");
    const admin = createAdminClient();
    const body = rolePermissionAssignSchema.parse(await req.json());

    const { error: delErr } = await admin
      .from("role_permissions")
      .delete()
      .eq("role_id", body.role_id);
    if (delErr) throw delErr;

    const rows = body.permission_ids.map((pid) => ({
      role_id: body.role_id,
      permission_id: pid,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("role_permissions") as any).insert(rows).select();
    if (error) throw error;
    return ok({ role_id: body.role_id, permissions: data });
  } catch (e) {
    return handleError(e);
  }
}
