/**
 * POST /api/v1/contact
 *
 * Public endpoint - tiếp nhận form liên hệ từ khách hàng.
 * Validate, lưu vào bảng contact_messages, gửi email thông báo cho CSKH.
 *
 * Rate limit: dựa vào IP — nếu có nhiều hơn 5 tin nhắn/giờ → fail.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/resend";
import { renderContactNotification } from "@/lib/email/contact-templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  full_name: z.string().min(2).max(120).trim(),
  email: z.string().email().max(254).trim(),
  phone: z
    .string()
    .max(20)
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  subject: z
    .string()
    .max(255)
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  message: z.string().min(10).max(5000).trim(),
});

export async function POST(req: NextRequest) {
  // 1. Parse body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("INVALID_JSON", "Body phải là JSON", 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return fail(
      "INVALID_BODY",
      "Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường.",
      422,
      flat,
      flat.fieldErrors,
    );
  }
  const { full_name, email, phone, subject, message } = parsed.data;

  // 2. Lấy IP + UA
  const ip_address =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const user_agent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  const supabase = createSupabaseServiceClient();

  // 3. Rate limit đơn giản: 5 tin nhắn / IP / giờ
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .eq("ip_address", ip_address ?? "0.0.0.0");
    if ((count ?? 0) >= 5) {
      return fail(
        "RATE_LIMITED",
        "Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau 1 giờ.",
        429,
      );
    }
  } catch {
    // Không chặn nếu không query được.
  }

  // 4. Lưu DB
  const { data: row, error: insertErr } = await supabase
    .from("contact_messages")
    .insert({
      full_name,
      email,
      phone,
      subject,
      message,
      ip_address,
      user_agent,
    })
    .select("id, created_at")
    .single();

  if (insertErr || !row) {
    console.error("[contact] insert error:", insertErr);
    return fail(
      "DB_ERROR",
      "Không thể lưu tin nhắn. Vui lòng thử lại sau.",
      500,
    );
  }

  // 5. Gửi email thông báo cho CSKH (không block response nếu fail)
  const recipient = process.env.CONTACT_NOTIFICATION_EMAIL ?? "cskh@laplap.vn";
  let emailWarning = false;
  try {
    const { subject: mailSubject, html, text } = renderContactNotification({
      full_name,
      email,
      phone,
      subject,
      message,
      ip_address,
      received_at: new Date(row.created_at).toISOString(),
    });
    await sendEmail({
      to: recipient,
      subject: mailSubject,
      html,
      text,
      replyTo: email,
    });
  } catch (e) {
    console.error("[contact] notification email failed:", e);
    emailWarning = true;
  }

  return ok({
    ok: true,
    message: "Đã gửi liên hệ. Chúng tôi sẽ phản hồi trong 24 giờ làm việc.",
    messageId: row.id,
    emailWarning,
  });
}

export async function GET() {
  return fail(
    "METHOD_NOT_ALLOWED",
    "Endpoint này chỉ chấp nhận POST.",
    405,
  );
}