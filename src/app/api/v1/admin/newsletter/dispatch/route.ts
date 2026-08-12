/**
 * POST /api/v1/admin/newsletter/dispatch
 * Body: {} hoac { outboxId?: string }
 *
 * Admin goi tay de dispatch ngay (thay vi doi cron). Co 2 mode:
 *   - {} (khong body): dispatch TAT CA outbox.pending (giong cron worker).
 *   - { outboxId: "uuid" }: dispatch 1 row cu the (khi admin muon retry 1 row failed).
 *
 * Re-use logic tu /api/v1/newsletter/dispatch (worker) nhung them auth admin.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, handleError } from "@/lib/api/response";
import { requirePermission } from "@/lib/api/guard";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/resend";
import { renderProductAlertEmail } from "@/lib/email/templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  outboxId: z.string().uuid().optional(),
});

const MAX_PER_RUN = 50;

export async function POST(req: NextRequest) {
  try {
    await requirePermission("newsletter.read");

    let raw: unknown = {};
    try {
      raw = await req.json();
    } catch {
      // Empty body OK
    }
    const parsed = Body.safeParse(raw);
    if (!parsed.success) return fail("INVALID_BODY", "Body không hợp lệ", 400);

    const supabase = createSupabaseServiceClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || req.nextUrl.origin;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from("newsletter_outbox") as any)
      .select("id, product_id, product_name, product_slug, product_brand_id, product_brand_name, product_price, product_url, attempts, status")
      .order("scheduled_at", { ascending: true })
      .limit(MAX_PER_RUN);

    if (parsed.data.outboxId) {
      // Single row dispatch - cho pép retry 1 row dang 'failed' hoac 'pending'.
      q = q.eq("id", parsed.data.outboxId).in("status", ["pending", "failed"]);
    } else {
      // Bulk dispatch - chi lay pending + da den scheduled_at.
      q = q.eq("status", "pending").lte("scheduled_at", new Date().toISOString());
    }

    const { data: rows, error: fetchErr } = await q;
    if (fetchErr) throw fetchErr;
    if (!rows || rows.length === 0) {
      return ok({ processed: 0, sent: 0 });
    }

    let totalSent = 0;
    const errors: string[] = [];

    for (const row of rows) {
      // Mark sending (race-safe).
      await supabase
        .from("newsletter_outbox")
        .update({ status: "sending", attempts: (row.attempts ?? 0) + 1 })
        .eq("id", row.id)
        .in("status", ["pending", "failed"]); // single-mode co the dispatch failed rows

      try {
        const sent = await processOne(row, appUrl, supabase);
        totalSent += sent;
        await supabase
          .from("newsletter_outbox")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", row.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown";
        console.error(`admin dispatch outbox ${row.id} failed:`, msg);
        errors.push(`${row.product_name}: ${msg}`);
        const attempts = (row.attempts ?? 0) + 1;
        const newStatus = attempts >= 3 ? "failed" : "pending";
        await supabase
          .from("newsletter_outbox")
          .update({ status: newStatus, last_error: msg.slice(0, 500) })
          .eq("id", row.id);
      }
    }

    return ok({
      processed: rows.length,
      sent: totalSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    return handleError(e);
  }
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subs, error: subErr } = await (supabase.from("newsletter_subscribers") as any)
    .select("id, email, unsubscribe_token")
    .eq("is_active", true)
    .eq("confirmed", true)
    .or(
      row.product_brand_id
        ? `brand_ids.eq.{},brand_ids.cs.{${row.product_brand_id}}`
        : "brand_ids.eq.{}",
    );

  if (subErr) throw new Error(`sub fetch: ${subErr.message}`);
  if (!subs || subs.length === 0) return 0;

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
        thumbnailUrl: null,
        unsubscribeUrl: unsubUrl,
      });
      const { messageId } = await sendEmail({ to: sub.email, subject, html, text });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("newsletter_send_log") as any).insert({
        outbox_id: row.id,
        subscriber_id: sub.id,
        email: sub.email,
        resend_message_id: messageId,
        status: "sent",
      });
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("newsletter_send_log") as any).insert({
        outbox_id: row.id,
        subscriber_id: sub.id,
        email: sub.email,
        status: "failed",
        error: msg.slice(0, 500),
      });
    }
  }
  return sent;
}