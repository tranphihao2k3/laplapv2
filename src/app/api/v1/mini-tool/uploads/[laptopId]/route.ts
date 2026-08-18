/**
 * GET /api/v1/mini-tool/uploads/[laptopId]
 *
 * Trả về lịch sử các lần upload từ Mini Tool cho 1 laptop. Dùng cho view mở
 * rộng trên ranking hoặc trang /test-laptop.
 *
 * Plan tham chiếu: MINI_TOOL_PLAN.md §5.2.4 (cuối bảng endpoints).
 */
import { NextRequest } from "next/server";
import { ok, handleError, ApiError } from "@/lib/api/response";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ laptopId: string }> },
) {
  try {
    const { laptopId } = await params;
    if (!UUID_RE.test(laptopId)) {
      throw new ApiError("INVALID_LAPTOP_ID", "laptopId không phải UUID", 400);
    }

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("mini_tool_uploads")
      .select(
        "id, session_id, device_id, device_name, payload_version, gpu_score, status, rejection_reason, os_info, source_ip, created_at, expires_at",
      )
      .eq("laptop_id", laptopId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return ok({
      laptopId,
      items: data ?? [],
      total: (data ?? []).length,
    });
  } catch (e) {
    return handleError(e);
  }
}