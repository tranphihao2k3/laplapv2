/**
 * POST /api/v1/newsletter/webhook
 *
 * Resend gọi webhook khi email delivery thay đổi trạng thái:
 *   - sent: Resend đã gửi đi (qua SMTP)
 *   - delivered: SMTP server của nhận (Gmail, Outlook...) nhận thành công
 *   - bounced: SMTP trả lỗi (mailbox full, address invalid...)
 *   - complained: user đánh "Spam" trong Gmail/Outlook
 *
 * Webhook chỉ gọi khi có sự kiện. Đọc thêm:
 *   https://resend.com/docs/dashboard/webhooks/introduction
 *
 * Auth: Resend ký mỗi request bằng HMAC-SHA256 (chuẩn Standard Webhooks / svix).
 *   Header: `svix-id`, `svix-timestamp`, `svix-signature`.
 *   Secret format: `whsec_<base64>`. Phần base64 decode ra bytes của HMAC key.
 *   Signed content = `${svix-id}.${svix-timestamp}.${rawBody}`.
 *   Signature format: `v1,<base64-hmac>` (có thể nhiều cách nhau bởi space — thử từng cái).
 *   Verify bằng Web Crypto API có sẵn trong Cloudflare Workers — KHÔNG cần `svix` SDK.
 *   Nếu RESEND_WEBHOOK_SECRET chưa set -> endpoint trả 503 (để không nhận nguyên request).
 *
 * Side effects:
 *   - bounced: set send_log.status='bounced' + deactivate subscriber (is_active=false)
 *   - complained: same as bounced
 *   - delivered: chỉ update send_log.status='delivered'
 *
 * Idempotent: Resend có thể gửi lại webhook nhiều lần (retry). Update theo
 * resend_message_id -> 0 hoặc 1 row -> upsert.
 */
import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ResendEvent = {
  type: "email.sent" | "email.delivered" | "email.bounced" | "email.complained" | "email.opened" | "email.clicked";
  created_at: string;
  data: {
    email_id: string; // = resend_message_id (Resend's message ID)
    from: string;
    to: string[];
    subject?: string;
    bounce?: { type: string; message?: string };
    complaint?: { type?: string };
  };
};

/**
 * Verify webhook signature theo Standard Webhooks spec.
 * Trả về true nếu signature hợp lệ, false nếu không.
 *
 * Reference: https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md
 */
async function verifyWebhookSignature(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string,
): Promise<boolean> {
  // Secret format: "whsec_<base64>". Decode phần base64 để lấy HMAC key bytes.
  if (!secret.startsWith("whsec_")) return false;
  const encoded = secret.slice("whsec_".length);
  const keyBytes = base64ToBytes(encoded);
  if (!keyBytes) return false;

  // Signed content: `${id}.${timestamp}.${body}`
  const content = `${svixId}.${svixTimestamp}.${rawBody}`;

  // Compute HMAC-SHA256 bằng Web Crypto API (có sẵn trong Workers).
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(content)),
  );
  const expected = bytesToBase64(sigBytes);

  // Header format: "v1,<sig1> v1,<sig2> ...". Thử từng cái (constant-time compare).
  const candidates = svixSignature
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice("v1,".length));

  for (const candidate of candidates) {
    if (constantTimeEqual(expected, candidate)) return true;
  }
  return false;
}

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "Webhook secret not configured" },
      { status: 503 },
    );
  }

  // Svix headers theo Resend convention.
  const svixId = req.headers.get("svix-id");
  const svixTs = req.headers.get("svix-timestamp");
  const svixSig = req.headers.get("svix-signature");
  if (!svixId || !svixTs || !svixSig) {
    return Response.json(
      { ok: false, error: "Missing svix headers" },
      { status: 400 },
    );
  }

  // Verify HMAC signature. Raw body cần giữ nguyên (string, không JSON.parse).
  const rawBody = await req.text();
  let evt: ResendEvent;
  try {
    const valid = await verifyWebhookSignature(rawBody, svixId, svixTs, svixSig, secret);
    if (!valid) {
      return Response.json(
        { ok: false, error: "Invalid signature" },
        { status: 401 },
      );
    }
    evt = JSON.parse(rawBody) as ResendEvent;
  } catch (e) {
    console.error("webhook signature verify failed:", e);
    return Response.json(
      { ok: false, error: "Invalid signature" },
      { status: 401 },
    );
  }

  // Chỉ quan tâm 4 loại event (delivery status), bỏ qua opened/clicked.
  if (
    evt.type !== "email.delivered" &&
    evt.type !== "email.bounced" &&
    evt.type !== "email.complained" &&
    evt.type !== "email.sent"
  ) {
    // Trả 200 để Resend không retry (event không liên quan).
    return Response.json({ ok: true, ignored: true });
  }

  const messageId = evt.data.email_id;
  const toEmail = evt.data.to?.[0];
  if (!messageId || !toEmail) {
    return Response.json({ ok: false, error: "Missing message_id/email" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  // Map event -> send_log.status.
  let newStatus: string;
  let deactivateSubscriber = false;
  switch (evt.type) {
    case "email.sent":
      newStatus = "sent";
      break;
    case "email.delivered":
      newStatus = "delivered";
      break;
    case "email.bounced":
      newStatus = "bounced";
      deactivateSubscriber = true;
      break;
    case "email.complained":
      newStatus = "complained";
      deactivateSubscriber = true;
      break;
  }

  // Update send_log theo resend_message_id. Nếu không có row (vd: email test
  // không qua dispatch), bỏ qua (200 OK).
  const { data: logRows, error: logErr } = await supabase
    .from("newsletter_send_log")
    .update({ status: newStatus })
    .eq("resend_message_id", messageId)
    .select("subscriber_id");

  if (logErr) {
    console.error("webhook send_log update error:", logErr);
    return Response.json({ ok: false, error: "DB error" }, { status: 500 });
  }

  // Nếu bounce/complaint -> deactivate subscriber.
  if (deactivateSubscriber && logRows && logRows.length > 0) {
    const subscriberIds = Array.from(new Set(logRows.map((r) => r.subscriber_id)));
    await supabase
      .from("newsletter_subscribers")
      .update({
        is_active: false,
        unsubscribed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("id", subscriberIds);
  }

  return Response.json({ ok: true, updated: logRows?.length ?? 0, status: newStatus });
}
