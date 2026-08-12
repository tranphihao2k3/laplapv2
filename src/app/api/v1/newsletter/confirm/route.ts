/**
 * GET /api/v1/newsletter/confirm?token=X
 *
 * User bam link trong email confirm. Endpoint:
 *   1. Validate token
 *   2. Set subscribers.confirmed = true, confirmed_at = now()
 *   3. Redirect toi trang chu voi query ?newsletter=confirmed
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
    return NextResponse.redirect(`${appUrl}/?newsletter=invalid`);
  }

  const supabase = createSupabaseServiceClient();

  // Tim subscriber theo token (token la unique index -> luon tra ve 0 hoac 1 row).
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .update({
      confirmed: true,
      confirmed_at: new Date().toISOString(),
      confirm_token: null, // xoa token sau khi dung (khong the re-use)
      updated_at: new Date().toISOString(),
    })
    .eq("confirm_token", token)
    .eq("confirmed", false)
    .select("id")
    .single();

  if (error || !data) {
    // Token khong ton tai hoac da su dung -> redirect voi error.
    return NextResponse.redirect(`${appUrl}/?newsletter=invalid_token`);
  }

  return NextResponse.redirect(`${appUrl}/?newsletter=confirmed`);
}
