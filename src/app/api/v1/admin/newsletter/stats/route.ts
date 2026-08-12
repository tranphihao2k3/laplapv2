/**
 * GET /api/v1/admin/newsletter/stats
 *
 * Thong ke nhanh cho dashboard header:
 *   - total_subscribers (active + confirmed)
 *   - pending_confirm
 *   - unsubscribed
 *   - outbox_pending
 *   - outbox_failed
 *   - emails_sent_24h (dem send_log status=sent trong 24h qua)
 */
import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api/response";
import { requirePermission } from "@/lib/api/guard";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    await requirePermission("newsletter.read");

    const supabase = createSupabaseServiceClient();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 5 query parallel (Supabase JS khong co multi-query, can Promise.all).
    const [
      activeRes,
      pendingConfirmRes,
      unsubscribedRes,
      outboxPendingRes,
      outboxFailedRes,
      sent24hRes,
    ] = await Promise.all([
      supabase
        .from("newsletter_subscribers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("confirmed", true),
      supabase
        .from("newsletter_subscribers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("confirmed", false),
      supabase
        .from("newsletter_subscribers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", false),
      supabase
        .from("newsletter_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("newsletter_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      supabase
        .from("newsletter_send_log")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("sent_at", since24h),
    ]);

    return ok({
      activeSubscribers: activeRes.count ?? 0,
      pendingConfirm: pendingConfirmRes.count ?? 0,
      unsubscribed: unsubscribedRes.count ?? 0,
      outboxPending: outboxPendingRes.count ?? 0,
      outboxFailed: outboxFailedRes.count ?? 0,
      emailsSent24h: sent24hRes.count ?? 0,
    });
  } catch (e) {
    return handleError(e);
  }
}