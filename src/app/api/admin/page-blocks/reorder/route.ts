/**
 * API: POST /api/admin/page-blocks/reorder
 * Body: { slug: string, orderedIds: string[] }
 *
 * Set lại position cho tất cả block của slug theo thứ tự id trong mảng.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { reorderPageBlocks } from "@/lib/page-blocks";

const Schema = z.object({
  slug: z.string().min(1).max(64),
  orderedIds: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const ok = await reorderPageBlocks(parsed.data.slug, parsed.data.orderedIds);
  if (!ok) {
    return NextResponse.json({ error: "REORDER_FAILED" }, { status: 500 });
  }
  try {
    revalidateTag(`page-blocks:${parsed.data.slug}`);
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true });
}
