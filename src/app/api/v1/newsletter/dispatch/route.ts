/**
 * POST /api/v1/newsletter/dispatch
 *
 * Worker scan newsletter_outbox, voi moi row pending:
 *   - Tim subscribers da confirm + dang theo doi brand cua product (hoac all)
 *   - Gui email cho tung subscriber
 *   - Log vao newsletter_send_log
 *   - Update outbox.status = 'sent'
 *
 * Endpoint nay co the duoc goi tu:
 *   (A) Cron job ben ngoai (vd: Vercel Cron, GitHub Action) moi 1-5 phut
 *   (B) Trigger san pham moi (qua pg_net HTTP, neu co)
 *   (C) Admin bam nut "Gui mail ngay" trong dashboard admin
 *
 * Hien tai (B) chua implement - chi can (A) voi Vercel Cron.
 *
 * Auth: phai co CRON_SECRET header (hoac admin role) de tranh public abuse.
 */
import { NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/resend";
import { renderProductAlertEmail } from "@/lib/email/templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Gioi han: moi lan chi gui toi da N email (bao ve Resend quota + UI debug).
// So lan truy cap moi ngay = 24/24h * 60p/5p = 288 lan -> toi da 288 * 50 = 14k email/ngay.
const MAX_PER_RUN = 50;

export async function POST(req: NextRequest) {
  // Auth: chi cron job hoac admin moi goi duoc.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.replace(/^Bearer\s+/i, "");
  // Neu KHONG set CRON_SECRET -> tu cho phep (dev mode). Production bat buoc set.
  if (cronSecret && provided !== cronSecret) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  const supabase = createSupabaseServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || req.nextUrl.origin;

  // Lay cac outbox row pending, sap theo thoi gian (FIFO).
  const { data: outboxRows, error: outboxErr } = await supabase
    .from("newsletter_outbox")
    .select("id, product_id, product_name, product_slug, product_brand_id, product_brand_name, product_price, product_url, attempts")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (outboxErr) {
    console.error("dispatch outbox fetch error:", outboxErr);
    return Response.json({ ok: false, error: "DB_ERROR" }, { status: 500 });
  }
  if (!outboxRows || outboxRows.length === 0) {
    return Response.json({ ok: true, processed: 0, sent: 0 });
  }

  let totalSent = 0;
  const errors: string[] = [];

  for (const row of outboxRows) {
    // Mark sending (tranh 2 worker cung xu ly 1 row).
    await supabase
      .from("newsletter_outbox")
      .update({ status: "sending", attempts: (row.attempts ?? 0) + 1 })
      .eq("id", row.id)
      .eq("status", "pending"); // race-safe: chi update neu van con pending

    try {
      const sent = await processOne(row, appUrl, supabase);
      totalSent += sent;
      await supabase
        .from("newsletter_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown";
      console.error(`outbox ${row.id} failed:`, msg);
      errors.push(`${row.product_name}: ${msg}`);
      // Neu attempts < 3 -> rollback ve pending (retry). Neu >= 3 -> failed.
      const attempts = (row.attempts ?? 0) + 1;
      const newStatus = attempts >= 3 ? "failed" : "pending";
      await supabase
        .from("newsletter_outbox")
        .update({ status: newStatus, last_error: msg.slice(0, 500) })
        .eq("id", row.id);
    }
  }

  return Response.json({
    ok: true,
    processed: outboxRows.length,
    sent: totalSent,
    errors: errors.length > 0 ? errors : undefined,
  });
}

/**
 * Xu ly 1 outbox row: lay subscribers phu hop + gui email.
 * Tra ve so email da gui thanh cong.
 */
async function processOne(
  row: {
    id: string;
    product_id: string;
    product_name: string;
    product_slug: string | null;
    product_brand_id: string | null;
    product_brand_name: string | null;
    product_price: number | null;
    product_url: string;
  },
  appUrl: string,
  supabase: ReturnType<typeof createSupabaseServiceClient>,
): Promise<number> {
  // Query subscribers da confirmed + con active + match brand.
  // brand_ids = [] => nhan tat ca => OR brand_ids contains product_brand_id.
  // brand_ids = [X,Y] => AND (brand_ids contains X OR contains Y).
  // Don gian hoa: OR (brand_ids is empty) OR (brand_ids @> [product_brand_id])
  const { data: subs, error: subErr } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, unsubscribe_token")
    .eq("is_active", true)
    .eq("confirmed", true)
    // 2 nhanh:
    //   - brand_ids empty array
    //   - brand_ids chua product_brand_id (neu product co brand)
    .or(
      row.product_brand_id
        ? `brand_ids.eq.{},brand_ids.cs.{${row.product_brand_id}}`
        : "brand_ids.eq.{}",
    );

  if (subErr) throw new Error(`sub fetch: ${subErr.message}`);
  if (!subs || subs.length === 0) {
    return 0; // khong co ai nhan -> van mark sent (da xu ly)
  }

  let sent = 0;
  for (const sub of subs) {
    const unsubUrl = `${appUrl}/api/v1/newsletter/unsubscribe?token=${encodeURIComponent(sub.unsubscribe_token)}`;
    const productUrl = row.product_url.startsWith("http")
      ? row.product_url
      : `${appUrl.replace(/\/$/, "")}${row.product_url.startsWith("/") ? "" : "/"}${row.product_url}`;

    try {
      const { subject, html, text } = renderProductAlertEmail({
        productName: row.product_name,
        productUrl,
        brandName: row.product_brand_name,
        price: row.product_price,
        thumbnailUrl: null, // TODO: lookup thumbnail_url tu products neu can
        unsubscribeUrl: unsubUrl,
      });
      const { messageId } = await sendEmail({ to: sub.email, subject, html, text });

      await supabase.from("newsletter_send_log").insert({
        outbox_id: row.id,
        subscriber_id: sub.id,
        email: sub.email,
        resend_message_id: messageId,
        status: "sent",
      });
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown";
      await supabase.from("newsletter_send_log").insert({
        outbox_id: row.id,
        subscriber_id: sub.id,
        email: sub.email,
        status: "failed",
        error: msg.slice(0, 500),
      });
      // Tiep tuc qua subscriber tiep theo (1 that bai khong dung ca batch).
    }
  }
  return sent;
}
