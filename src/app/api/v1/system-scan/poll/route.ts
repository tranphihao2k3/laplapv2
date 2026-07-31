import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api/response";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Đọc trạng thái quét từ bảng `system_scan_results` (cùng nguồn với route
// submit). Xem chú thích ở submit/route.ts để biết vì sao không dùng
// biến global trong RAM — trên Cloudflare Workers cách đó không hoạt động.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const token = sp.get("token");
    if (!token) {
      return Response.json({ error: "Missing token" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: row, error } = await supabase
      .from("system_scan_results")
      .select("status, payload, updated_at")
      .eq("token", token)
      .maybeSingle();

    if (error) throw error;
    if (!row) return ok({ status: "waiting" });

    // Giữ nguyên shape mà client đang đọc (`payload.data`) để không phải sửa UI:
    // cột DB tên `payload`, còn client mong field `data`.
    return ok({
      status: row.status,
      data: row.payload ?? undefined,
      timestamp: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    });
  } catch (e) {
    return handleError(e);
  }
}
