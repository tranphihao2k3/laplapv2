/**
 * POST /api/v1/mini-tool/sessions
 *
 * Web gọi khi user bấm "Mở tool" trên trang /test-laptop/* — sinh session
 * token + trả về URL tuyệt đối để tool paste/open.
 *
 * Plan tham chiếu: MINI_TOOL_PLAN.md §5.2.1.
 */
import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api/response";
import { createSession } from "@/lib/mini-tool/session";
import { createSessionBodySchema } from "@/lib/mini-tool/schemas";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = createSessionBodySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "INVALID_BODY",
            message: "Body không hợp lệ",
            issues: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }

    // Dựng origin từ header (reverse proxy) hoặc URL tương đối.
    const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
    const origin = `${proto}://${host}`;

    const data = await createSession(
      {
        redirectAfterUpload: parsed.data.redirectAfterUpload,
        context: parsed.data.context,
      },
      origin,
    );

    return ok(data, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}