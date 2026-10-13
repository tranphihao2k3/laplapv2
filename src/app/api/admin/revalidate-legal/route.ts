/**
 * /api/admin/revalidate-legal
 *
 * Gọi sau khi admin lưu thông tin pháp lý ở /quanly/settings → tab Pháp lý.
 * Server-side revalidate cache "store-legal" / "store-info" / "footer-settings"
 * để lần render tiếp theo của footer + contact page lấy data mới.
 *
 * Auth: bắt buộc đăng nhập (cookie session) — không cho guest gọi.
 */

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireUser } from "@/lib/api/guard";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireUser();

    // Revalidate tất cả cache liên quan đến store/legal/contact/footer
    revalidateTag("store-legal");
    revalidateTag("store-info");
    revalidateTag("store-contact");
    revalidateTag("footer-settings");

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = (err as Error).message ?? "Internal error";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
