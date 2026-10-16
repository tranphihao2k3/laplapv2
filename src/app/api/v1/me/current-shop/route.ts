/**
 * GET /api/v1/me/current-shop
 *
 * Single-shop mode: trả về 1 shop duy nhất của org hiện tại.
 * Dùng cho POS, report, mobile... những chỗ cần shop_id cụ thể mà không
 * cho user chọn (vì hệ thống chỉ có 1 cửa hàng).
 *
 * Lấy shop active đầu tiên trong org. Nếu user chưa gán shop_staff với
 * org này → vẫn fallback về active shop (giống logic `/v1/me/shops` cũ).
 */
import { requireOrg } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";

export async function GET() {
  try {
    const { supabase, orgId } = await requireOrg();

    const { data, error } = await supabase
      .from("shops")
      .select("id, name, code, address, phone")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return new Response(
        JSON.stringify({ ok: false, error: { message: "Chưa có cửa hàng nào trong tổ chức" } }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    return ok(data);
  } catch (e) {
    return handleError(e);
  }
}
