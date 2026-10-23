import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requirePermission } from "@/lib/api/guard";
import { ok, handleError } from "@/lib/api/response";

// Read-only view. Filter qua ?warehouse_id=&product_variant_id=
// Hỗ trợ thêm ?product_variant_id__in=id1,id2,id3 để lấy tồn của nhiều biến thể
// trong 1 request (dùng khi mở dialog sửa sản phẩm — cần tồn của tất cả variant).
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    await requirePermission("stock_levels.read");
    const supabase = await createClient();
    const sp = req.nextUrl.searchParams;
    let q = supabase.from("stock_levels").select("*", { count: "exact" });
    const w = sp.get("warehouse_id");
    const v = sp.get("product_variant_id");
    const vIn = sp.get("product_variant_id__in");
    if (w) q = q.eq("warehouse_id", w);
    if (v) q = q.eq("product_variant_id", v);
    if (vIn) {
      const ids = vIn
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      // `.in` yêu cầu mảng không rỗng — bỏ qua filter nếu không có id hợp lệ.
      if (ids.length > 0) q = q.in("product_variant_id", ids);
    }
    const { data, error, count } = await q.limit(500);
    if (error) throw error;
    return ok({ items: data ?? [], total: count ?? 0 });
  } catch (e) {
    return handleError(e);
  }
}
