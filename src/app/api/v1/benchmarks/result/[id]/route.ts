/**
 * GET /api/v1/benchmarks/result/[id]  - web doc ket qua draft de hien thi
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, handleError, Errors } from "@/lib/api/response";

type DraftRow = {
  id: string;
  payload: unknown;
  saved: boolean;
  expires_at: string | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data } = await supabase
      .from("benchmark_drafts")
      .select("id, payload, saved, expires_at")
      .eq("id", id)
      .single();

    const draft = data as DraftRow | null;
    if (!draft) throw Errors.notFound("Ket qua benchmark");

    if (draft.expires_at && new Date(draft.expires_at).getTime() < Date.now()) {
      throw Errors.notFound("Ket qua benchmark (da het han)");
    }

    return ok({ id: draft.id, payload: draft.payload, saved: draft.saved });
  } catch (e) {
    return handleError(e);
  }
}
