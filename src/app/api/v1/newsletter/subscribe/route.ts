/**
 * POST /api/v1/newsletter/subscribe
 * Body: { email: string, brandIds?: string[] }
 *
 * Luu subscriber moi vao DB + gui email confirm (double opt-in).
 *
 * Mode dang ky:
 *   - brandIds = [] hoac khong truyen -> subscriber nhan moi san pham moi
 *   - brandIds = [uuid, ...] -> chi nhan san pham cua cac brand trong list
 *
 * Tra ve 200 OK neu thanh cong, 4xx neu input khong hop le hoac email da ton tai.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/response";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/resend";
import { renderConfirmEmail } from "@/lib/email/templates";
import { randomToken, normalizeEmail } from "@/lib/newsletter/tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email().max(254),
  // Optional: array cac brand UUID user muon nhan thong bao.
  // Neu bo trong -> nhan moi san pham.
  brandIds: z.array(z.string().uuid()).max(50).optional(),
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("INVALID_JSON", "Body phai la JSON", 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_BODY", "Email hoặc brandIds không hợp lệ", 400, parsed.error.flatten());
  }

  const email = normalizeEmail(parsed.data.email);
  const brandIds = parsed.data.brandIds ?? [];
  const supabase = createSupabaseServiceClient();

  // Token moi (re-use neu resubscribe - upsert se update).
  const confirmToken = randomToken(32);

  // Upsert: neu email da ton tai -> cap nhat brandIds + re-confirm.
  // Neu user dang unsubscribed (is_active=false) -> reactivate + doi token.
  // Neu user da confirmed -> van cap nhat (cho phep user doi brandIds).
  const unsubToken = randomToken(32);

  const { data: row, error } = await supabase
    .from("newsletter_subscribers")
    .upsert(
      {
        email,
        brand_ids: brandIds,
        is_active: true,
        confirmed: false, // bat buoc xac nhan lai moi lan subscribe (hoac resubscribe)
        confirm_token: confirmToken,
        unsubscribe_token: unsubToken,
        unsubscribed_at: null,
        ip_address: getClientIp(req),
        user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    )
    .select("id, email, brand_ids, confirmed")
    .single();

  if (error || !row) {
    console.error("newsletter subscribe error:", error);
    return fail("DB_ERROR", "Không thể lưu đăng ký. Vui lòng thử lại sau.", 500);
  }

  // Neu co brand_ids -> validate chung co ton tai trong bang brands.
  let brandNames: string[] = [];
  if (brandIds.length > 0) {
    const { data: brands } = await supabase
      .from("brands")
      .select("id, name")
      .in("id", brandIds);
    brandNames = (brands ?? []).map((b) => b.name);
  }

  // Gui email confirm. Loi email KHONG rollback DB - user co the bam "resend"
  // de nhan lai email (TODO - chua implement endpoint resend).
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    `${req.nextUrl.protocol.replace(":", "")}://${req.headers.get("host")}`;
  const confirmUrl = `${baseUrl}/api/v1/newsletter/confirm?token=${encodeURIComponent(confirmToken)}`;

  try {
    const { subject, html, text } = renderConfirmEmail({
      email,
      confirmUrl,
      brandNames,
    });
    await sendEmail({ to: email, subject, html, text });
  } catch (e) {
    // Email fail nhung DB da ghi. Tra ve success nhung warning - user co the thu lai.
    console.error("newsletter confirm email failed:", e);
    return ok({
      ok: true,
      message: "Đã lưu đăng ký, nhưng gửi email xác nhận bị lỗi. Vui lòng thử lại sau.",
      emailWarning: true,
    });
  }

  return ok({
    ok: true,
    message: "Vui lòng kiểm tra email để xác nhận đăng ký.",
    subscriberId: row.id,
  });
}

function getClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip") ?? null;
}
