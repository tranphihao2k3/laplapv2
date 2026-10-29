/**
 * POST /api/admin/revalidate-store
 *
 * Xoá cache server-side của store-info / legal / contact / footer / trust-badges.
 *
 * Dùng khi admin sửa settings TRỰC TIẾP trong DB (ví dụ qua script
 * `scripts/update-store-name.ts`) — các script này ghi thẳng bảng `settings`
 * nên KHÔNG đi qua `settingsService`, do đó không trigger `revalidateTag`.
 * Không có endpoint này thì tên store mới chỉ hiện sau khi cache TTL (1h) hết hạn.
 *
 * Auth: chấp nhận 1 trong 2 —
 *   1. Bearer token khớp `CRON_SECRET` (dùng cho script/CI).
 *   2. Session cookie của admin đã đăng nhập (dùng cho UI).
 */

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireUser } from "@/lib/api/guard";

export const dynamic = "force-dynamic";

/** Tất cả tag cache liên quan tới thông tin hiển thị công khai. */
const TAGS = [
  "store-info",
  "store-legal",
  "store-contact",
  "footer-settings",
  "trust-badges",
];

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.replace(/^Bearer\s+/i, "");

  const hasValidSecret = Boolean(cronSecret) && provided === cronSecret;
  if (!hasValidSecret) {
    // Fallback: cho admin đã đăng nhập (cookie session) gọi từ UI.
    try {
      await requireUser();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  for (const tag of TAGS) revalidateTag(tag);

  return NextResponse.json({ ok: true, tags: TAGS });
}
