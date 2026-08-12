/**
 * GET /api/v1/newsletter/unsubscribe?token=X
 *
 * User bam "Hủy đăng ký" trong email. Endpoint set is_active=false va redirect
 * toi trang unsubscribe xac nhan (frontend public route se hien thi thong bao).
 *
 * GET (khong POST) de user co the bam truc tiep tu email.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || req.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${appUrl}/?newsletter=unsub_invalid`);
  }

  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .update({
      is_active: false,
      unsubscribed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("unsubscribe_token", token)
    .eq("is_active", true)
    .select("id, email")
    .single();

  if (error || !data) {
    return NextResponse.redirect(`${appUrl}/?newsletter=unsub_invalid`);
  }

  return NextResponse.redirect(`${appUrl}/?newsletter=unsubscribed`);
}
