import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrg, requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/api/audit";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  phone: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  shop_id: z.string().uuid().nullable().optional(),
  role_id: z.string().uuid().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user: admin, supabase, orgId } = await requireOrg();
    await requirePermission("admin.manage_users");
    const adminClient = createAdminClient();

    const body = createUserSchema.parse(await req.json());

    // 1. Tạo auth user (service role) - auto confirm email
    const { data: authUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
    });
    if (createErr) throw createErr;
    if (!authUser.user) throw new Error("Không tạo được user");

    // 2. Tạo user_profile
    const { error: profileErr } = await (supabase as any).from("user_profiles").insert({
      id: authUser.user.id,
      organization_id: orgId,
      full_name: body.full_name,
      phone: body.phone ?? null,
      avatar_url: body.avatar_url ?? null,
    });
    if (profileErr) throw profileErr;

    // 3. Tuỳ chọn gán vào cửa hàng + role
    if (body.shop_id) {
      const { error: staffErr } = await (supabase as any).from("shop_staff").insert({
        shop_id: body.shop_id,
        user_id: authUser.user.id,
        role_id: body.role_id ?? null,
        is_active: true,
      });
      if (staffErr) throw staffErr;
    }

    // 4. Ghi audit
    await writeAuditLog({
      supabase,
      userId: admin.id,
      organizationId: orgId,
      entityType: "user_profiles",
      entityId: authUser.user.id,
      action: "create",
      afterData: { email: body.email, full_name: body.full_name, shop_id: body.shop_id },
      ipAddress: req.headers.get("x-forwarded-for"),
    });

    return ok({ id: authUser.user.id, email: body.email, full_name: body.full_name }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
