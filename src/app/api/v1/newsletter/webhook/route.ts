/**
 * POST /api/v1/newsletter/webhook
 *
 * Resend goi webhook khi email delivery thay doi trang thai:
 *   - sent: Resend da gui di (qua SMTP)
 *   - delivered: SMTP server cua nhan (Gmail, Outlook...) nhan thanh cong
 *   - bounced: SMTP tra loi loi (mailbox full, address invalid...)
 *   - complained: user danh "Spam" trong Gmail/Outlook
 *
 * Webhook chi goi khi co su kien. Doc them:
 *   https://resend.com/docs/dashboard/webhooks/introduction
 *
 * Auth: Resend ky moi request bang HMAC-SHA256 voi secret trong header
 *   `svix-id`, `svix-timestamp`, `svix-signature`. SU DUNG svix package de verify.
 * Neu RESEND_WEBHOOK_SECRET chua set -> endpoint tra 503 (de khong nhan nguyen request).
 *
 * Side effects:
 *   - bounced: set send_log.status='bounced' + deactivate subscriber (is_active=false)
 *   - complained: same as bounced
 *   - delivered: chi update send_log.status='delivered'
 *
 * Idempotent: Resend co the gui lai webhook nhieu lan (retry). Update theo
 * resend_message_id -> 0 hoac 1 row -> upsert.
 */
import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { Webhook } from "svix";

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

  // Verify HMAC signature. Raw body can giu nguyen (svix parse "svix-signature" v1=base64).
  const rawBody = await req.text();
  let evt: ResendEvent;
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTs,
      "svix-signature": svixSig,
    }) as ResendEvent;
  } catch (e) {
    console.error("webhook signature verify failed:", e);
    return Response.json(
      { ok: false, error: "Invalid signature" },
      { status: 401 },
    );
  }

  // Chi quan tam 4 loai event (delivery status), bo qua opened/clicked.
  if (
    evt.type !== "email.delivered" &&
    evt.type !== "email.bounced" &&
    evt.type !== "email.complained" &&
    evt.type !== "email.sent"
  ) {
    // Tra 200 de Resend khong retry (event khong lien quan).
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

  // Update send_log theo resend_message_id. Neu ko co row (vd: email test
  // khong qua dispatch), bo qua (200 OK).
  const { data: logRows, error: logErr } = await supabase
    .from("newsletter_send_log")
    .update({ status: newStatus })
    .eq("resend_message_id", messageId)
    .select("subscriber_id");

  if (logErr) {
    console.error("webhook send_log update error:", logErr);
    return Response.json({ ok: false, error: "DB error" }, { status: 500 });
  }

  // Neu bounce/complaint -> deactivate subscriber.
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