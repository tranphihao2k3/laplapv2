/**
 * GET /api/v1/desktop-posting/products/:id
 *
 * Chi tiết 1 sản phẩm cho app Facebook Publisher:
 *   - product: thông tin hiển thị + plainTextDescription (HTML đã parse an toàn).
 *   - variants: SKU + giá + specs + tổng tồn kho các kho.
 *
 * Auth: Bearer (desktop) hoặc cookie (web), cần quyền `publisher.use`.
 * See: docs/FB-PUBLISHER-TASKS.md → Milestone 1 / API-005.
 */
import { ok, handleError } from "@/lib/api/response";
import { getPublishingProductDetail } from "@/server/services/desktop-posting-service";

export async function GET(req: Request, ctxParam: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctxParam.params;
    const detail = await getPublishingProductDetail(req, id);
    return ok(detail);
  } catch (e) {
    return handleError(e);
  }
}
