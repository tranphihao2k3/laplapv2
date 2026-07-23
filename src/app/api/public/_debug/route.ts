import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// TẠM THỜI để chẩn đoán deploy Cloudflare. XÓA sau khi xong.
export const dynamic = "force-dynamic";

export async function GET() {
  const info: Record<string, unknown> = {
    urlFromProcess: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    hasAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    serviceRoleLen: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length,
  };

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("brands")
      .select("id,name")
      .limit(1);
    info.querySuccess = !error;
    info.queryError = error ? { message: error.message, code: (error as { code?: string }).code } : null;
    info.sampleCount = data?.length ?? 0;
  } catch (e) {
    info.threw = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(info);
}
