/**
 * GET /api/v1/mini-tool/session?sid=X
 *
 * Tool gọi để verify sid còn hạn + lấy context (laptop_id?, requiredFields[]).
 *
 * Plan tham chiếu: MINI_TOOL_PLAN.md §5.2.2.
 *
 * Error codes (xem src/lib/mini-tool/session.ts + handleError):
 *  - SESSION_NOT_FOUND (404)
 *  - SESSION_EXPIRED  (410)
 *  - SESSION_CONSUMED (409)
 */
import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api/response";
import { verifySession } from "@/lib/mini-tool/session";

export const dynamic = "force-dynamic";

const SID_RE = /^[a-f0-9]{32}$/i;

export async function GET(req: NextRequest) {
  try {
    const sid = req.nextUrl.searchParams.get("sid")?.trim() ?? "";
    if (!SID_RE.test(sid)) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "INVALID_SID",
            message: "sid phải là 32 ký tự hex",
          },
        },
        { status: 400 },
      );
    }

    const info = await verifySession(sid);

    return ok({
      sessionId: sid,
      valid: info.valid,
      consumed: info.consumed,
      expiresAt: info.expiresAt,
      laptopId: info.laptopId,
      context: info.context,
      requiredFields: info.requiredFields,
    });
  } catch (e) {
    return handleError(e);
  }
}