/**
 * GET /api/v1/account/me
 *   Trả về thông tin account hiện tại (auth + customer + profile merged).
 *
 * PATCH /api/v1/account/me
 *   Body: { fullName?, phone?, birthday?, gender?, avatarUrl? }
 *   Update profile của customer + user_profiles.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import {
  getCurrentCustomer,
  upsertCustomerProfile,
} from "@/lib/account/customer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PatchSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z
    .string()
    .max(20)
    .regex(/^[0-9+\-\s()]*$/, "Số điện thoại không hợp lệ")
    .optional()
    .nullable(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày sinh phải có định dạng YYYY-MM-DD")
    .optional()
    .nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

export async function GET() {
  const me = await getCurrentCustomer();
  if (!me) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);
  return ok({
    user: {
      id: me.id,
      email: me.email,
      fullName: me.fullName,
      phone: me.phone,
      avatarUrl: me.avatarUrl,
      customerId: me.customerId,
      customer: me.customer,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const me = await getCurrentCustomer();
  if (!me) return fail("UNAUTHENTICATED", "Bạn cần đăng nhập", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("INVALID_JSON", "Body phải là JSON", 400);
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "INVALID_BODY",
      "Dữ liệu không hợp lệ",
      422,
      parsed.error.flatten(),
    );
  }

  const result = await upsertCustomerProfile({
    ...parsed.data,
    gender: parsed.data.gender ?? null,
  });
  if (!result.ok) return fail("UPDATE_FAILED", result.error, 500);

  const fresh = await getCurrentCustomer();
  return ok({ user: fresh });
}
