/**
 * GET /api/v1/me/shops
 * Trả về danh sách cửa hàng mà user đang đăng nhập được gán (qua shop_staff, is_active).
 * Nếu user không có bản ghi shop_staff nào (VD chủ tổ chức / admin) → fallback tất cả
 * cửa hàng đang hoạt động trong tổ chức. Dùng để form tự chọn cửa hàng + lọc kho theo cửa hàng.
 */
import { requireOrg } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";

type ShopLite = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
};

export async function GET() {
  try {
    const { supabase, user, orgId } = await requireOrg();

    // Cửa hàng user được gán trực tiếp
    const { data: staffRows, error: staffErr } = (await supabase
      .from("shop_staff")
      .select("shop_id")
      .eq("user_id", user.id)
      .eq("is_active", true)) as { data: { shop_id: string | null }[] | null; error: unknown };
    if (staffErr) throw staffErr;

    const shopIds = Array.from(
      new Set((staffRows ?? []).map((r) => r.shop_id).filter((id): id is string => Boolean(id))),
    );

    let query = supabase
      .from("shops")
      .select("id, name, code, address, phone")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    // Có gán cụ thể → giới hạn theo đó; không có → trả toàn bộ shop trong org (fallback admin)
    if (shopIds.length > 0) {
      query = query.in("id", shopIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ok((data ?? []) as ShopLite[]);
  } catch (e) {
    return handleError(e);
  }
}
