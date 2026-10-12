/**
 * DELETE /api/v1/account/settings/account
 *   Soft-delete tài khoản: set customers.deleted_at + sign out.
 *   Body: { reason?: string }
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { softDeleteAccount } from "@/lib/account/customer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({ reason: z.string().max(500).optional() });

export async function DELETE(req: NextRequest) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return fail("INVALID_BODY", "Dữ liệu không hợp lệ", 422, parsed.error.flatten());
  }

  const result = await softDeleteAccount(parsed.data.reason ?? "user_request");
  if (!result.ok) return fail("DELETE_FAILED", result.error, 500);

  return ok({ ok: true, message: "Tài khoản đã được vô hiệu hoá" });
}
