/**
 * POST /api/v1/benchmarks/result
 *
 * .exe gui ket qua benchmark (diem + cau hinh) len -> luu draft -> tra ve { id }.
 * .exe se mo trinh duyet toi /test-laptop/benchmark/result/{id} de user xem va Luu.
 */
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, handleError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("benchmark_drafts")
      .insert([{ payload }])
      .select("id")
      .single();
    if (error) throw error;

    return ok({ id: data.id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
