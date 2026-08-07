import { NextRequest, NextResponse } from "next/server";
import { getCompareProducts, parseCompareIds } from "@/lib/compare/fetch-products";

/**
 * GET /api/public/products/compare?ids=uuid1,uuid2,uuid3
 *
 * Trả dữ liệu các máy để dựng bảng so sánh. Id không hợp lệ / không tồn tại /
 * sản phẩm đã ẩn sẽ bị bỏ qua — client tự dọn khỏi URL và store.
 */
export async function GET(req: NextRequest) {
  const ids = parseCompareIds(req.nextUrl.searchParams.get("ids"));

  if (ids.length === 0) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await getCompareProducts(ids);
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json(
      { items: [], error: { message: `Không tải được dữ liệu so sánh: ${message}` } },
      { status: 500 },
    );
  }
}
