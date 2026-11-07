/**
 * POST /api/public/analytics/view
 * Body: { path: string }
 * Cộng +1 page view (daily aggregate). Không yêu cầu đăng nhập.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isBotUserAgent,
  normalizePagePath,
  shouldSkipPagePath,
} from "@/lib/analytics/page-view";

const bodySchema = z.object({
  path: z.string().min(1).max(300),
});

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent");
    if (isBotUserAgent(ua)) {
      return new NextResponse(null, { status: 204 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const path = normalizePagePath(parsed.data.path);
    if (!path || shouldSkipPagePath(path)) {
      return new NextResponse(null, { status: 204 });
    }

    const supabase = createAdminClient();
    // Bảng/RPC mới — chưa có trong generated Database types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("increment_site_page_view", {
      p_path: path,
    });
    if (error) {
      console.warn("[analytics/view]", error.message);
      // Không làm hỏng UX client — vẫn 204
      return new NextResponse(null, { status: 204 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.warn("[analytics/view] unexpected", e);
    return new NextResponse(null, { status: 204 });
  }
}
