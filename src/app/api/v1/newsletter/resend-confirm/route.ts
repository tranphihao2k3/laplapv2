/**
 * POST /api/v1/newsletter/resend-confirm
 * Body: { email: string }
 *
 * User muon nhan lai email confirm (spam trong inbox, hoac mat link).
 * Endpoint:
  - Tim subscriber theo email
  - Neu da confirmed -> thong bao (khong can gui)
  - Neu chua confirmed -> cap nhat token moi + gui email
  - Neu unsubscribed (is_active=false) -> tu choi (user phai subscribe lai)
 *
 * Rate limit: toi da 3 lan/email/24h de tranh spam. Check bang dem so
 * outbox neu muon (TODO - hien tai chi log).
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
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("INVALID_JSON", "Body phải là JSON", 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return fail("INVALID_BODY", "Email không hợp lệ", 400, parsed.error.flatten());
  }

  const email = normalizeEmail(parsed.data.email);
  const supabase = createSupabaseServiceClient();

  const { data: sub, error } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, brand_ids, confirmed, is_active")
    .eq("email", email)
    .single();

  if (error || !sub) {
    // Khong lo email (tranh leak thong tin email co ton tai trong DB).
    return ok({ ok: true, message: "Nếu email tồn tại, link xác nhận đã được gửi." });
  }

  if (sub.confirmed) {
    return ok({ ok: true, message: "Email đã xác nhận rồi, không cần gửi lại." });
  }

  if (!sub.is_active) {
    // User unsubscribed truoc do -> yeu cau subscribe lai.
    return fail(
      "UNSUBSCRIBED",
      "Email này đã hủy đăng ký. Vui lòng đăng ký lại từ trang chủ.",
      400,
    );
  }

  // Generate token moi (token cu khong the re-use duoc nua - confirm route da set null).
  const confirmToken = randomToken(32);

  const { error: updErr } = await supabase
    .from("newsletter_subscribers")
    .update({
      confirm_token: confirmToken,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  if (updErr) {
    return fail("DB_ERROR", "Không thể cập nhật. Thử lại sau.", 500);
  }

  // Lay brand names (neu co brand_ids).
  let brandNames: string[] = [];
  const brandIds = sub.brand_ids ?? [];
  if (brandIds.length > 0) {
    const { data: brands } = await supabase
      .from("brands")
      .select("name")
      .in("id", brandIds);
    brandNames = (brands ?? []).map((b) => b.name);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    `${req.nextUrl.protocol.replace(":", "")}://${req.headers.get("host")}`;
  const confirmUrl = `${baseUrl}/api/v1/newsletter/confirm?token=${encodeURIComponent(confirmToken)}`;

  try {
    const { subject, html, text } = renderConfirmEmail({ email, confirmUrl, brandNames });
    await sendEmail({ to: email, subject, html, text });
  } catch (e) {
    console.error("resend-confirm email failed:", e);
    return fail("EMAIL_ERROR", "Đã lưu token nhưng gửi email bị lỗi. Thử lại sau.", 500);
  }

  return ok({ ok: true, message: "Đã gửi lại email xác nhận. Vui lòng kiểm tra hộp thư." });
}