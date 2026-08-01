/**
 * GET /api/v1/desktop-posting/products
 *
 * List sản phẩm đang active cho app Facebook Publisher.
 * Hỗ trợ search theo tên/slug, pagination, và `updatedSince` để desktop
 * đồng bộ incremental.
 *
 * Auth: Bearer (desktop) hoặc cookie (web), yêu cầu quyền `publisher.use`.
 * See: docs/FB-PUBLISHER-TASKS.md → Milestone 1 / API-004.
 */
import { z } from "zod";
import { ok, handleError } from "@/lib/api/response";
import { listPublishingProducts } from "@/server/services/desktop-posting-service";

const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  updatedSince: z.string().datetime({ offset: true }).optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return handleError(parsed.error);
    }
    const result = await listPublishingProducts(req, parsed.data);
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
