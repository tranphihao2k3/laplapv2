/**
 * API: PATCH  /api/admin/page-blocks/[id]  { data?, enabled? }
 *        DELETE /api/admin/page-blocks/[id]
 *
 * Cả 2 đều revalidate tag `page-blocks:<slug>` để bust cache sau khi sửa.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { deletePageBlock, updatePageBlock } from "@/lib/page-blocks";

const PatchSchema = z.object({
  data: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Lấy slug trước để revalidate sau.
  const supabase = createAdminClient();
  const { data: cur } = await supabase
    .from("page_blocks")
    .select("page_slug")
    .eq("id", id)
    .maybeSingle();
  const slug = (cur as { page_slug?: string } | null)?.page_slug;

  const block = await updatePageBlock({
    id,
    data: parsed.data.data as unknown as Parameters<typeof updatePageBlock>[0]["data"],
    enabled: parsed.data.enabled,
  });
  if (!block) {
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }
  if (slug) {
    try {
      revalidateTag(`page-blocks:${slug}`);
    } catch {
      // ignore
    }
  }
  return NextResponse.json({ block });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = createAdminClient();
  const { data: cur } = await supabase
    .from("page_blocks")
    .select("page_slug")
    .eq("id", id)
    .maybeSingle();
  const slug = (cur as { page_slug?: string } | null)?.page_slug;

  const ok = await deletePageBlock(id);
  if (!ok) {
    return NextResponse.json({ error: "DELETE_FAILED" }, { status: 500 });
  }
  if (slug) {
    try {
      revalidateTag(`page-blocks:${slug}`);
    } catch {
      // ignore
    }
  }
  return NextResponse.json({ ok: true });
}
