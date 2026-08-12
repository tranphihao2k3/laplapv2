/**
 * DELETE /api/v1/admin/newsletter/subscribers/[id]
 *
 * Admin xoa subscriber (GDPR right-to-be-forgotten, hoac spam).
 */
import { NextRequest } from "next/server";
import { ok, handleError, fail } from "@/lib/api/response";
import { requirePermission } from "@/lib/api/guard";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("newsletter.read");
    const { id } = await ctx.params;
    if (!id) return fail("MISSING_ID", "Thieu subscriber id", 400);

    const supabase = createSupabaseServiceClient();
    // CASCADE se tu xoa newsletter_send_log lien quan (FK ON DELETE CASCADE).
    const { error } = await supabase
      .from("newsletter_subscribers")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}