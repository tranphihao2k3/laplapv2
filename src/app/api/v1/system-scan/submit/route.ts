import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api/response";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Trạng thái quét lưu trong bảng `system_scan_results` (migration 020),
// KHÔNG dùng biến global trong RAM: trên Cloudflare Workers mỗi request có thể
// chạy ở một isolate khác nhau, nên scanner POST vào isolate A còn trang web
// poll ở isolate B sẽ không bao giờ thấy kết quả — scanner báo "ĐÃ GỬI LÊN
// SERVER" mà web vẫn đứng mãi ở bước "Mở file".
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const token = sp.get("token");
    if (!token) {
      return Response.json({ error: "Missing token" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const now = new Date().toISOString();

    // Heartbeat ping (không có body): scanner báo đã kết nối và đang quét.
    // Không ghi đè kết quả "complete" nếu đã có.
    const phase = sp.get("status");
    if (phase === "scanning") {
      const { data: existing } = await supabase
        .from("system_scan_results")
        .select("status")
        .eq("token", token)
        .maybeSingle();

      if (existing?.status !== "complete") {
        const { error } = await supabase
          .from("system_scan_results")
          .upsert({ token, status: "scanning", updated_at: now }, { onConflict: "token" });
        if (error) throw error;
      }
      return ok({ success: true });
    }

    const body = await req.json();
    const { error } = await supabase
      .from("system_scan_results")
      .upsert(
        { token, status: "complete", payload: body, updated_at: now },
        { onConflict: "token" },
      );
    if (error) throw error;

    return ok({ success: true });
  } catch (e) {
    return handleError(e);
  }
}
